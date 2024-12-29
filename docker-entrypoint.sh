#!/usr/bin/env bash
set -e

# If ADMIN_USERNAME and ADMIN_PASSWORD are set, add an admin user
# with role "admin" = ["read", "write", "manageUsers"] in /app/users.json.
if [[ -n "$ADMIN_USERNAME" && -n "$ADMIN_PASSWORD" ]]; then
  echo "Creating 'admin' role [read, write, manageUsers] if not already existing..."
  enstore-server user add-role admin read write manageUsers --users /app/users.json || true

  echo "Adding admin user '$ADMIN_USERNAME'..."
  # 'enstore-server user add <username> <role>' prompts for password,
  # so we provide it via echo/pipeline:
  echo "$ADMIN_PASSWORD" | enstore-server user add "$ADMIN_USERNAME" admin --users /app/users.json || true
fi

echo "Starting Enstore server..."
exec enstore-server start -p "$PORT" -d /app/uploads --users /app/users.json
