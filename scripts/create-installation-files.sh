#!/bin/sh

ROOT_DIR="$PWD/../"
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
npm --prefix "$SERVER_DIR" run "$NPM_BACKEND_TRANSPILE_SCRIPT_NAME"
mv "$SERVER_DIST_DIR" "$COMPILATIONS_BACKEND_DIR"
# copy the package.json so we can "npm i" during installation procedure
cp "$SERVER_DIR/package.json" "$COMPILATIONS_BACKEND_DIR/server/"

# create frontend files
# create server files
npm --prefix "$CLIENT_DIR" run "$NPM_FRONTEND_TRANSPILE_SCRIPT_NAME"
mv "$CLIENT_DIST_DIR" "$COMPILATIONS_FRONTEND_DIR"

echo "Successfully created dynamic installation files. Press enter to leave..."
read WAIT
