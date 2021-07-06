# BuzzUI
WebApp for the BuzzerBox

## Config
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


# Autostart
To auto start all the required stuff, make sure the following lines are present in  `/etc/xdg/lxsession/LXDE-pi/autostart`
```
unclutter -idle 0
/usr/bin/chromium-browser --kiosk --disable-restore-session-state http://localh$
node /home/pi/buzzer/server/dist/server/main.js
sudo sh /home/pi/buzzer/scripts/createAdHocNetwork.sh
```
