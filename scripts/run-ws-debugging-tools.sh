#!/bin/bash

. ./.assets/functions.sh

echo "Making sure that prerequisites are met..."

# install npm

cd .. # project's root

cd ./shared
npm i
cd .. # project's root again

cd ./websocket-test-app
npm i

echo "Which tool would you like to start?"
echo

options=("WS Debug Client" "WS standalone server")

select_option "${options[@]}"
choice=$?

if [ "${choice}" -eq 0 ];
then
  npm run "build+run:client"
else
  npm run "build+run:server"
fi

echo "${choice}"
