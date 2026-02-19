#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="$ROOT_DIR/.env.dev.example"
TARGET="$ROOT_DIR/.env.local"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "[ERROR] Missing template: $TEMPLATE"
  exit 1
fi

if [[ -f "$TARGET" ]]; then
  echo "[INFO] .env.local already exists: $TARGET"
else
  cp "$TEMPLATE" "$TARGET"
  echo "[OK] Created $TARGET from .env.dev.example"
fi

echo ""
echo "Next steps:"
echo "1) Fill real dev values in .env.local (pk_test/sk_test recommended)"
echo "2) Run: npm run check:env:dev"
echo "3) Run: npm run dev"
