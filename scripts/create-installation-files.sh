#!/bin/sh
# Builds the client and the server into install/.assets/compilations, which install.sh installs and
# create-update-bundle.sh packs into an update bundle.

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPILATIONS_DIR="$ROOT_DIR/install/.assets/compilations"

CLIENT_DIR="$ROOT_DIR/client"
NPM_FRONTEND_TRANSPILE_SCRIPT_NAME="build"
COMPILATIONS_FRONTEND_DIR="$COMPILATIONS_DIR/frontend"
CLIENT_DIST_DIR="$CLIENT_DIR/dist/client"

SERVER_DIR="$ROOT_DIR/server"
SERVER_DIST_DIR="$SERVER_DIR/dist"
COMPILATIONS_BACKEND_DIR="$COMPILATIONS_DIR/backend"
NPM_BACKEND_TRANSPILE_SCRIPT_NAME="transpile"

# remove compilations dir
if [ -d "$COMPILATIONS_DIR" ];
then
  rm -r "$COMPILATIONS_DIR"
fi

mkdir -p "$COMPILATIONS_DIR"

# create server files
npm --prefix "$SERVER_DIR" ci
rm -rf "$SERVER_DIST_DIR"
npm --prefix "$SERVER_DIR" run "$NPM_BACKEND_TRANSPILE_SCRIPT_NAME"
mv "$SERVER_DIST_DIR" "$COMPILATIONS_BACKEND_DIR"
# the box has no internet, so the server's dependencies come along. They are the same on every platform: serialport
# ships prebuilt bindings for the Pi (linux-arm/linux-arm64).
cp "$SERVER_DIR/package.json" "$SERVER_DIR/package-lock.json" "$COMPILATIONS_BACKEND_DIR/server/"
npm --prefix "$COMPILATIONS_BACKEND_DIR/server" ci --omit=dev

# create frontend files
npm --prefix "$CLIENT_DIR" ci
npm --prefix "$CLIENT_DIR" run "$NPM_FRONTEND_TRANSPILE_SCRIPT_NAME"
# the Angular build puts the files to serve into browser/
mv "$CLIENT_DIST_DIR/browser" "$COMPILATIONS_FRONTEND_DIR"

echo "Successfully created dynamic installation files."
