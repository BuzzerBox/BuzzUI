#!/bin/bash

ENV_FILE="./setup.env"
HELPER_FUNCTIONS_FILE="./.assets/functions.sh"

TEXT_IS_MANDATORY_BUT_NOT_SET="is mandatory but not set in ENV file!"
TEXT_ENV_FILE_NOT_FOUND="Environment file was not found! It should be located at '$ENV_FILE'"

PATH_RASPBERRY_PI_4_BUSTER="./raspberry-pi-4/11-raspian-buster"
# When copying a config file to its target location but the file already exists, this will be used when renaming the
# file that is already there to back it up
export BACKUP_FILE_NAME_POSTFIX=".old";

# path to the hostapd config file
export HOSTAPD_CONF_PATH="/etc/hostapd/hostapd.conf"
# path to the dnsmasq config file
export DNSMASQ_CONF_PATH="/etc/dnsmasq.conf"
# path to the nginx's default configs directory
export NGINX_DIR="/etc/nginx/sites-available/default";
# name of the nginx config file without path
export NGINX_CONF_FILE="sites-available-default.conf";

# check if this install script is run as root
if [ $(id -u) -ne 0 ]
then
  echo "This install script needs to be run as root!"
  exit
fi

if [ -f "${ENV_FILE}" ];
then
  # this imports the env file's variable to the current shells session
  source "${ENV_FILE}"

  # see https://stackoverflow.com/a/13864829/7618184
  # if [ -z ${var+x} ]; then CMD; else CMD; fi test if it is set. '' would be valid
  # if [ -z ${var} ]; then CMD; else CMD; fi test if it is set and not blank. '' would be invalid
  # test if required env vars are defined
else
  echo "$TEXT_ENV_FILE_NOT_FOUND";
fi



# default value section:
# set default values for env vars that are not set
if [ -z "$INSTALL_DIR" ]
then
  INSTALL_DIR="/home/pi/BuzzerBox";
fi

if [ -z "$WIFI_SSID" ];
  then
    WIFI_SSID="BuzzerBoxNetwork";
fi

if [ -z "$WIFI_COUNTRY_CODE" ];
  then
    WIFI_COUNTRY_CODE="DE";
fi

if [ -z "$WIFI_PASSPHRASE" ];
  then
    WIFI_PASSPHRASE="12TheBuzzerBox_IncredibleNetwork34";
fi

if [ -z "$SERVER_IP_ADDRESS" ];
then
  SERVER_IP_ADDRESS="10.0.0.5";
fi

if [ -z "$HOSTNAMES" ];
then
  HOSTNAMES="buzzer.box;buzzerbox.local";
fi

if [ -z "$SPLASH_IMAGE_TARGET_LOCATION" ];
then
  SPLASH_IMAGE_TARGET_LOCATION="/home/pi/Pictures/splash.png"
fi

if [ -z "$ACTIVATE_OVERLAY_FS" ];
then
  ACTIVATE_OVERLAY_FS="true"
else
  if ! [ "${ACTIVATE_OVERLAY_FS}" = "true" ] && ! [ "${ACTIVATE_OVERLAY_FS}" = "false" ];
  then
    echo "The provided value '${ACTIVATE_OVERLAY_FS}' for 'ACTIVATE_OVERLAY_FS' is not valid. Please fix."
    exit;
  fi
fi

# TODO they to not need to be exported
# export the vars into the environment. Child-processes can access them. They get removed when this script ends.
ROOT_DIR="$PWD"
# export installation dir to system envs
export BUZZER_BOX_INSTALL_DIR="${INSTALL_DIR}";
#export INSTALL_DIR;
#export WIFI_SSID="${WIFI_SSID}";
#export WIFI_COUNTRY_CODE="${WIFI_COUNTRY_CODE}";
#export WIFI_PASSPHRASE="${WIFI_PASSPHRASE}";
#export SERVER_IP_ADDRESS="${SERVER_IP_ADDRESS}";
#export HOSTNAMES="${HOSTNAMES}";
#export SPLASH_IMAGE_TARGET_LOCATION="${SPLASH_IMAGE_TARGET_LOCATION}";
#export ACTIVATE_OVERLAY_FS="${ACTIVATE_OVERLAY_FS}";

# load the helper functions
. "${HELPER_FUNCTIONS_FILE}"

# only one install script available for now
. ./"${PATH_RASPBERRY_PI_4_BUSTER}/install.sh";
