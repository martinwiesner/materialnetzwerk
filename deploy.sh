#!/bin/bash
# Deploy to Hetzner Server + Git commit
# Usage: ./deploy.sh "optionale commit message"

SERVER="root@91.99.228.92"
REMOTE_PATH="/opt/material-library"
COMMIT_MSG="${1:-deploy: $(date '+%Y-%m-%d %H:%M')}"

echo "🚀 Deploying to $SERVER..."

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
  --exclude 'certbot' \
  --exclude '.DS_Store' \
  . $SERVER:$REMOTE_PATH/

# 3. Auf dem Server: neu bauen und starten
echo "🔨 Building and restarting on server..."
ssh $SERVER "cd $REMOTE_PATH && docker compose up -d --build --force-recreate"

echo "✅ Done! App is live at https://materialien.reallabor-zekiwa-zeitz.de"
