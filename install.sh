#!/usr/bin/env bash
# Claude Switch Profile (CSP) - Standalone Installer
# This script installs CSP into an isolated directory to avoid Node.js version management issues.

set -e

PACKAGE_NAME="claude-switch-profile"
INSTALL_DIR="$HOME/.csp-cli"
BIN_DIR="$HOME/.local/bin"

echo "=> 🪄  Installing $PACKAGE_NAME..."

# 1. Prepare isolated installation directory
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Prevent npm from searching up the directory tree
if [ ! -f "package.json" ]; then
  echo '{"name":"csp-cli-env","private":true}' > package.json
fi

# 2. Install the package explicitly in this isolated directory
echo "=> 📦  Downloading package from npm..."
npm install --omit=dev --silent "$PACKAGE_NAME@latest"

# 3. Create absolute wrapper script
echo "=> 🔗  Setting up executable wrapper..."
mkdir -p "$BIN_DIR"

WRAPPER_PATH="$BIN_DIR/csp"

cat << 'EOF' > "$WRAPPER_PATH"
#!/usr/bin/env bash
# Wrapper for claude-switch-profile (Isolated Environment)
exec node "$HOME/.csp-cli/node_modules/claude-switch-profile/bin/csp.js" "$@"
EOF

chmod +x "$WRAPPER_PATH"

echo "=> ✅  Installation complete!"
echo ""
echo "=> 🚀 The 'csp' command is now installed at: $WRAPPER_PATH"
echo "=> ⚠️  Please ensure $BIN_DIR is in your system \$PATH."
echo "     (You may need to add: export PATH=\"\$HOME/.local/bin:\$PATH\" to your ~/.bashrc or ~/.zshrc)"
