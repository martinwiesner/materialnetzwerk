#!/bin/sh
set -e

DB_PATH="${DB_PATH:-/usr/src/app/data/material_library.db}"
SEED_DB="/usr/src/app/seed/seed.db"
SEED_UPLOADS="/usr/src/app/seed/uploads"

# ── INIT_DB: force-reset the database (env flag, explicit opt-in) ────────────
if [ "$INIT_DB" = "true" ]; then
  echo "Removing old database..."
  rm -f "$DB_PATH"
  echo "Initializing database..."
  npm run db:init
fi

# ── SEED: first-install only (no DB on the volume yet) ───────────────────────
if [ ! -f "$DB_PATH" ]; then
  if [ -f "$SEED_DB" ]; then
    echo "Fresh install detected — seeding database from backup..."
    mkdir -p "$(dirname "$DB_PATH")"
    cp "$SEED_DB" "$DB_PATH"
    echo "Database seeded."
  else
    echo "Fresh install detected — initializing database..."
    npm run db:init
  fi
fi

# ── SEED uploads: copy from image seed dir if present (optional, not required)
# Upload files are NOT stored in git. Copy them manually via Coolify terminal:
#   cp -r /path/to/uploads/. /usr/src/app/uploads/
if [ -d "$SEED_UPLOADS" ]; then
  cp -rn "$SEED_UPLOADS/." /usr/src/app/uploads/ 2>/dev/null || true
fi

# ── MIGRATIONS: always run on startup (safe — uses try/catch per column) ─────
echo "Running database migrations..."
npm run db:migrate

# ── Generate swagger docs if needed ──────────────────────────────────────────
if [ "$GENERATE_SWAGGER" = "true" ]; then
  echo "Generating Swagger documentation..."
  npm run swagger
fi

# Execute the main command
exec "$@"
