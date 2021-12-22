#!/bin/sh

ENV_FILE="./setup.env"

TEXT_IS_MANDATORY_BUT_NOT_SET="is mandatory but not set in ENV file!"
TEXT_ENV_FILE_NOT_FOUND="Environment file was not found! It should be located at '$ENV_FILE'"

PATH_RASPBERRY_PI_4_BUSTER="./raspberry-pi-4/11-raspian-buster"


if [ -f "$ENV_FILE" ]
then
  # this imports the env file's variable to the current shells session
  . $ENV_FILE

  # see https://stackoverflow.com/a/13864829/7618184
  # if [ -z ${var+x} ]; then CMD; else CMD; fi test if it is set. '' would be valid
  # if [ -z ${var} ]; then CMD; else CMD; fi test if it is set and not blank. '' would be invalid
  # test if required env vars are defined
  if [ -z "$INSTALL_DIR" ];
    then
      echo "INSTALL_DIR $TEXT_IS_MANDATORY_BUT_NOT_SET";
      exit;
  fi


  # export the vars into the environment. Child-processes can access it. Dies when this script ends
  export INSTALL_DIR="$INSTALL_DIR"
  export ROOT_DIR="$PWD"

  # only one install script available for now
  sh "$PATH_RASPBERRY_PI_4_BUSTER";
else
  echo "$TEXT_ENV_FILE_NOT_FOUND";
fi
