# BuzzUI
WebApp for the BuzzerBox

## Installation
How to install the BuzzerBox web app onto a platform. Currently, only the Raspberry Pi 4 with the OS `Buster` is
supported. Various things can be set in the `setup.env` file in the installation directory root.
The supported settings are shown below:

- `INSTALL_DIR`: Sets the target location the BuzzerBox web app is to be installed to. Defaults to `/home/pi/BuzzerBox`.
- `WIFI_SSID`: Sets the Pi's ad-hoc WiFi network's SSID. Defaults to `BuzzerBoxNetwork`.
- `WIFI_COUNTRY_CODE`: Sets the Pi's ad-hoc WiFi network's country code. Defaults to `DE`.
- `WIFI_PASSPHRASE`: Sets the Pi's ad-hoc WiFi network's passphrase. Defaults to `12TheBuzzerBox_IncredibleNetwork34`.
- `SERVER_IP_ADDRESS`: Sets the Pi's own IP address within its ad-hoc WiFi network. Defaults to `10.0.0.5`.
- `HOSTNAMES`: Sets the hostnames under which the Pi can be found. Multiple values are supported by concatenating them with a `;`. Defaults to `buzzer.box;buzzerbox.local`.
- `SPLASH_IMAGE_TARGET_LOCATION`: Sets the location where is splash image that is used during boot-up and as desktop wallpaper will be saved to. Defaults to `/home/pi/Pictures/splash.png`.
- ⚠NOT YET IMPLEMENTED⚠ `ACTIVATE_OVERLAY_FS`: Whether the overlay FS should automatically get enabled by the installation procedure. Defaults to `true`



### Raspberry Pi 4 `Buster`

## Configuration of the web app
TODO probably needs to be updated
```json
{
  "gameName": <NAME>,
  "masterName": <NAME>,
  "screenName": <NAME>,
  "server": <SHOULD NOT BE CHANGED>
  "buzzers": [
    {
      "name": "Buzzer 1",
      "key": "Numpad0"
    }
    ...
    {
      "name": "Buzzer 5",
      "key": "Numpad4"
    }
  ],
  "i2c": {
    "addresses": {
     "microController": "25"
    },
    "commands": {
     "softRelease": "1",
     "setBuzzer": "2"
   }
  }
}
```
The following key-bindings are available so far: `NUMPAD_0`, `NUMPAD_1`, `NUMPAD_2`, `NUMPAD_3`, `NUMPAD_4`, `NUMPAD_5`, `NUMPAD_6`, `NUMPAD_7`, `NUMPAD_8`, `NUMPAD_9`.

## WiFi
WiFi default name's `BuzzerBoxNetwork` and the default password is `12TheBuzzerBox_IncredibleNetwork34`, but these can
be set in `setup.env`.

## Disable Screen Saver
To disable the screen saver, use the `raspi-config` and disable the screen blanking
