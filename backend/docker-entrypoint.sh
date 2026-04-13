#!/bin/sh
set -e

# Initialize database if needed
if [ "$INIT_DB" = "true" ]; then
  echo "Removing old database..."
  rm -f /usr/src/app/data/material_library.db
  echo "Initializing database..."
  npm run db:init
fi

# Generate swagger docs if needed
if [ "$GENERATE_SWAGGER" = "true" ]; then
  echo "Generating Swagger documentation..."
  npm run swagger
fi

# Execute the main command
exec "$@"
