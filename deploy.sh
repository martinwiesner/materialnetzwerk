#!/bin/bash
# Deploy to Hetzner Server + Git commit
# Usage: ./deploy.sh "optionale commit message"
#
# SSH ControlMaster: Passwort nur EINMAL eingeben — alle Verbindungen nutzen den Tunnel.
# Sicherheitsregeln:
#   - Kein Deploy ohne erfolgreiches DB-Backup
#   - Build-/Restart-Fehler brechen ab (kein falsches "Done!")
#   - Migration-Fehler brechen ab und zeigen klare Meldung
#   - SSH-Socket wird vorher bereinigt damit kein Stale-Socket hängt

set -euo pipefail

SERVER="root@91.99.228.92"
REMOTE_PATH="/opt/material-library"
COMMIT_MSG="${1:-deploy: $(date '+%Y-%m-%d %H:%M')}"
BACKUP_DIR="$(dirname "$0")/db-backups"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
SSH_CTRL="/tmp/ssh_deploy_ctrl_matbib"
SSH_OPTS="-o ControlMaster=no -o ControlPath=$SSH_CTRL -o StrictHostKeyChecking=no"

# ── Stale SSH-Socket bereinigen ───────────────────────────────────────────────
rm -f "$SSH_CTRL"

cleanup() {
  ssh -o ControlPath="$SSH_CTRL" -O exit "$SERVER" 2>/dev/null || true
}
trap cleanup EXIT

# ── SSH-Tunnel öffnen (hier nur EINMAL Passwort eingeben) ─────────────────────
echo "🔑 SSH-Verbindung aufbauen (einmalige Passwortabfrage)..."
ssh -o ControlMaster=yes -o ControlPath="$SSH_CTRL" -o ControlPersist=600 \
    -o StrictHostKeyChecking=no -N -f "$SERVER"
echo "   ✅ Verbunden (Tunnel aktiv)"

# ── 0. Produktionsdatenbank sichern — bei Fehler: ABBRUCH ─────────────────────
echo "💾 Backing up production database..."
mkdir -p "$BACKUP_DIR"
if ! scp $SSH_OPTS \
    "$SERVER:$REMOTE_PATH/data/material_library.db" \
    "$BACKUP_DIR/material_library_$TIMESTAMP.db" 2>/dev/null; then
  echo ""
  echo "❌ BACKUP FEHLGESCHLAGEN — Deploy wird ABGEBROCHEN."
  echo "   Die Produktionsdatenbank konnte nicht gesichert werden."
  echo "   Bitte Verbindung und Pfad prüfen, dann erneut ausführen."
  exit 1
fi
echo "   ✅ Backup saved: db-backups/material_library_$TIMESTAMP.db"
ls -t "$BACKUP_DIR"/material_library_*.db 2>/dev/null | tail -n +101 | xargs rm -f 2>/dev/null
echo "   (ältere Backups bereinigt, max. 100)"

# ── 0b. Uploads sichern (unkritisch — kein Abbruch bei Fehler) ───────────────
echo "🖼️  Backing up uploaded files..."
UPLOADS_BACKUP_DIR="$(dirname "$0")/uploads-backups"
mkdir -p "$UPLOADS_BACKUP_DIR"
LATEST_LINK="$UPLOADS_BACKUP_DIR/latest"
NEW_UPLOADS_BACKUP="$UPLOADS_BACKUP_DIR/uploads_$TIMESTAMP"
if rsync -az -e "ssh $SSH_OPTS" --link-dest="$LATEST_LINK" \
    "$SERVER:$REMOTE_PATH/backend/uploads/" "$NEW_UPLOADS_BACKUP/" 2>/dev/null; then
  rm -f "$LATEST_LINK" && ln -sf "$NEW_UPLOADS_BACKUP" "$LATEST_LINK"
  echo "   ✅ Uploads backed up"
  ls -dt "$UPLOADS_BACKUP_DIR"/uploads_* 2>/dev/null | tail -n +26 | xargs rm -rf 2>/dev/null
else
  echo "   ⚠️  Uploads-Backup fehlgeschlagen — wird ignoriert (kein Abbruch)"
fi

# ── 1. Git commit (nur explizit gelistete Dateien, kein -A wegen .env-Risiko) ─
if git rev-parse --git-dir > /dev/null 2>&1; then
  echo "📝 Committing to git..."

  # Stash unstaged changes so they don't block rebase if remote has diverged
  STASH_NEEDED=false
  if ! git diff --quiet; then
    git stash push -m "deploy-script auto-stash" 2>/dev/null && STASH_NEEDED=true
  fi

  # Pull remote changes first (rebase avoids merge commits)
  if git remote get-url origin &>/dev/null; then
    echo "   ↓ Syncing with remote..."
    if ! git pull --rebase origin main 2>&1; then
      echo "   ⚠️  git pull --rebase fehlgeschlagen — lokale Konflikte? Bitte manuell prüfen."
      echo "      (Deploy wird fortgesetzt, Push ggf. nicht möglich)"
      git rebase --abort 2>/dev/null || true
    fi
  fi

  # Restore stash
  if [ "$STASH_NEEDED" = true ]; then
    git stash pop 2>/dev/null || true
  fi

  git add \
    backend/src/ backend/scripts/ \
    frontend/src/ frontend/public/ \
    docker-compose.yml deploy.sh \
    2>/dev/null || true

  if git commit -m "$COMMIT_MSG" 2>/dev/null; then
    echo "   ✅ Committed: $COMMIT_MSG"
  else
    echo "   (nichts neues zu committen)"
  fi

  # Push — sichtbare Fehlermeldung statt stilles Scheitern
  echo "   ↑ Pushing to GitHub..."
  if git push origin main 2>&1; then
    echo "   ✅ GitHub aktuell"
  else
    echo "   ⚠️  Push fehlgeschlagen — Code wurde NICHT auf GitHub aktualisiert."
    echo "      Mögliche Ursachen: Token abgelaufen, Branch-Konflikt, kein Netz."
    echo "      Bitte manuell prüfen: git push origin main"
    echo "      (Deploy wird trotzdem fortgesetzt)"
  fi
fi

# ── 2. Dateien übertragen — bei Fehler: ABBRUCH ───────────────────────────────
echo "📦 Transferring files..."
rsync -avz --progress -e "ssh $SSH_OPTS" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'frontend/dist' \
  --exclude 'backend/database.sqlite' \
  --exclude 'backend/data' \
  --exclude 'backend/logs' \
  --exclude 'backend/uploads' \
  --exclude 'data' \
  --exclude 'db-backups' \
  --exclude 'certbot' \
  --exclude '.DS_Store' \
  --exclude '.env' \
  . $SERVER:$REMOTE_PATH/ || {
    echo "❌ Dateiübertragung fehlgeschlagen — Deploy abgebrochen."
    exit 1
  }

# ── 2b. IDEMAT-Datenbasis übertragen (liegt im Volume-Pfad, daher separat) ────
# Das Docker-Volume mappt ./data → /usr/src/app/data im Container.
# idemat.json wird deshalb direkt in den Volume-Pfad auf dem Server kopiert,
# nicht über das Backend-Build-Verzeichnis.
echo "📊 Transferring idemat.json to data volume..."
scp $SSH_OPTS \
  backend/data/idemat.json \
  "$SERVER:$REMOTE_PATH/data/idemat.json" || {
    echo "❌ idemat.json Transfer fehlgeschlagen — Deploy abgebrochen."
    exit 1
  }
echo "   ✅ idemat.json übertragen"

# ── 3. Build & Restart — bei Fehler: ABBRUCH ─────────────────────────────────
echo "🔨 Building and restarting on server..."
ssh $SSH_OPTS "$SERVER" \
  "cd $REMOTE_PATH && \
   docker compose build --build-arg CACHEBUST=\$(date +%s) frontend backend && \
   docker compose up -d --force-recreate" || {
    echo "❌ Build oder Neustart fehlgeschlagen — bitte Server prüfen."
    exit 1
  }

# ── 4. Auf Backend-Start warten, dann Migration ───────────────────────────────
echo "⏳ Warte auf Backend-Start..."
ssh $SSH_OPTS "$SERVER" "
  for i in \$(seq 1 24); do
    if docker compose -f $REMOTE_PATH/docker-compose.yml exec -T backend \
        node -e 'process.exit(0)' 2>/dev/null; then
      echo \"   ✅ Backend bereit (nach \${i}x2s = \$((i*2))s)\"
      break
    fi
    sleep 2
    if [ \$i -eq 24 ]; then
      echo '❌ Backend nicht gestartet nach 48s — Migration übersprungen'
      exit 1
    fi
  done
  cd $REMOTE_PATH
  docker compose exec -T backend node scripts/migrate.js && echo '✅ Migration erfolgreich'
" || {
  echo "❌ Migration fehlgeschlagen — bitte manuell prüfen:"
  echo "   ssh $SERVER 'cd $REMOTE_PATH && docker compose exec -T backend node scripts/migrate.js'"
  exit 1
}

echo ""
echo "✅ Deploy erfolgreich! App ist live: https://materialien.reallabor-zekiwa-zeitz.de"
