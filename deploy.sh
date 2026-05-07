#!/bin/bash
# Deploy to Hetzner Server + Git commit
# Usage: ./deploy.sh "optionale commit message"

SERVER="root@91.99.228.92"
REMOTE_PATH="/opt/material-library"
COMMIT_MSG="${1:-deploy: $(date '+%Y-%m-%d %H:%M')}"
BACKUP_DIR="$(dirname "$0")/db-backups"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')

echo "🚀 Deploying to $SERVER..."

# 0. Produktionsdatenbank lokal sichern (VOR allem anderen)
echo "💾 Backing up production database..."
mkdir -p "$BACKUP_DIR"
if scp "$SERVER:$REMOTE_PATH/data/material_library.db" "$BACKUP_DIR/material_library_$TIMESTAMP.db" 2>/dev/null; then
  echo "   ✅ Backup saved: db-backups/material_library_$TIMESTAMP.db"
  # Nur die letzten 100 Backups behalten
  ls -t "$BACKUP_DIR"/material_library_*.db 2>/dev/null | tail -n +101 | xargs rm -f 2>/dev/null
  echo "   (ältere Backups bereinigt, max. 100 werden behalten)"
else
  echo "   ⚠️  Backup fehlgeschlagen — Deploy wird trotzdem fortgesetzt"
fi

# 0b. Hochgeladene Dateien inkrementell sichern (rsync + Hard-Links)
echo "🖼️  Backing up uploaded files..."
UPLOADS_BACKUP_DIR="$(dirname "$0")/uploads-backups"
mkdir -p "$UPLOADS_BACKUP_DIR"
LATEST_LINK="$UPLOADS_BACKUP_DIR/latest"
NEW_UPLOADS_BACKUP="$UPLOADS_BACKUP_DIR/uploads_$TIMESTAMP"
if rsync -az --link-dest="$LATEST_LINK" "$SERVER:$REMOTE_PATH/backend/uploads/" "$NEW_UPLOADS_BACKUP/" 2>/dev/null; then
  rm -f "$LATEST_LINK" && ln -sf "$NEW_UPLOADS_BACKUP" "$LATEST_LINK"
  echo "   ✅ Uploads backed up: uploads-backups/uploads_$TIMESTAMP"
  # Nur die letzten 25 Snapshots behalten
  ls -dt "$UPLOADS_BACKUP_DIR"/uploads_* 2>/dev/null | tail -n +26 | xargs rm -rf 2>/dev/null
  echo "   (ältere Uploads-Backups bereinigt, max. 25 werden behalten)"
else
  echo "   ⚠️  Uploads-Backup fehlgeschlagen — Deploy wird trotzdem fortgesetzt"
fi

# 1. Git commit (ohne .env)
if git rev-parse --git-dir > /dev/null 2>&1; then
  echo "📝 Committing to git..."
  git add -A
  git commit -m "$COMMIT_MSG" 2>/dev/null || echo "   (nothing new to commit)"
  git push 2>/dev/null || echo "   (no remote configured or push failed)"
else
  echo "   (kein git repo — überspringe)"
fi

# 2. Dateien übertragen (inkl. .env, aber nicht ins git)
echo "📦 Transferring files..."
rsync -avz --progress \
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
  . $SERVER:$REMOTE_PATH/

# 3. Auf dem Server: neu bauen und starten
echo "🔨 Building and restarting on server..."
ssh $SERVER "cd $REMOTE_PATH && docker compose up -d --build --force-recreate"

echo "✅ Done! App is live at https://materialien.reallabor-zekiwa-zeitz.de"
