#!/bin/bash
set -e

# Extract Node version from .nvmrc (just the major version)
NVMRC_VERSION=$(cat .nvmrc | xargs)

# Extract Node version from package.json engines.node
PKG_VERSION=$(grep '"node"' package.json | grep -oP '>=\d+' | grep -oP '\d+')

if [ "$NVMRC_VERSION" != "$PKG_VERSION" ]; then
  echo "❌ Node version mismatch!"
  echo "  .nvmrc specifies: Node $NVMRC_VERSION"
  echo "  package.json specifies: Node >=24.0.0 (major: $PKG_VERSION)"
  echo ""
  echo "Fix by updating both files to the same version:"
  echo "  1. Edit .nvmrc to: $PKG_VERSION"
  echo "  2. Edit package.json engines.node to: >=$PKG_VERSION.0.0"
  exit 1
fi

echo "✅ Node version check passed: $NVMRC_VERSION"
