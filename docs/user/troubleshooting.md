# Troubleshooting

## The TV shows nothing, or no sound

- **Switch the TV on and choose its HDMI input** before or after the box starts; both work. The box needs about a
  minute after it was switched on before the waiting screen appears.
- **Try another HDMI cable or port** on the TV. Adapters to VGA or DVI often don't work.
- **No sound:** check the TV's volume and that it isn't muted. Check *Sound* on the play page: the volume there applies
  to all screens. A TV that was switched on after the box gets its sound back by itself after a few seconds.
- **A second screen on a laptop has no sound** and shows *Click to turn the sound on*: click once into that window.
  Browsers only play sound after a click.

## My device can't find the WiFi or can't connect

- Wait a minute after switching the box on; its WiFi comes up after it has started.
- Check the name: it is `BuzzerBoxNetwork` unless someone [changed it](box-settings-and-updates.md#the-boxs-settings).
- **Your phone says the WiFi has no internet** and switches back to mobile data or another WiFi: tell it to stay
  connected. On some phones, switch off mobile data for the game.
- **`buzzer.box` doesn't open:** type `http://buzzer.box` with `http://`, or use the address `http://10.0.0.5`.
  Some browsers search for `buzzer.box` instead of opening it. A VPN or a "private DNS" setting on the device can get
  in the way, too; switch it off.
- Move closer to the box. Walls and a box inside a metal case weaken its WiFi a lot.

## The game master can't connect, or says another device is in control

- *Waiting for the connection to the server* means the device reached the box, but not its game software. Wait a few
  seconds; it keeps trying. Right after an update or a power cut, that takes up to a minute.
- *Another device is controlling the BuzzerBox right now*: only one device can be the game master. If that was your own
  device and it only lost the WiFi or reloaded, it carries on by itself after a few seconds. Otherwise tap **Take
  control** (*Steuerung übernehmen*); a running game carries on on your device.
- Everything seems stuck: **Reset server** (*Server zurücksetzen*) on the home page makes all devices start over. Your
  games and savegames are kept. As the last resort, switch the box off and on again; **Continue game** then carries on
  with a game that was running.

## A buzzer doesn't react

**Wired buzzers:**

- Check that the game is played with the **analog buzzers** and that this buzzer has a team. A buzzer without a team
  doesn't count.
- Are the buzzers **locked**? After a buzz, they stay locked until you grade the answer or release them. The big button
  in the middle of the play page shows it.
- Plug the buzzer into another port to see if the buzzer or the port is the problem.
- If the dot of the box's display shows, the box's buzzer board has lost the connection to the game software; switch
  the box off and on again.

**Wireless buzzers:** see [when a buzzer is offline](wireless-buzzers.md#when-a-buzzer-is-offline). In short: press its
button to wake it, look at its light, charge it, or adopt it again over USB.

**Two teams buzzed at the same time:** the box takes the one that pressed first, also with wireless buzzers, whose
presses arrive a little later.

## A video stutters, doesn't play, or plays without picture

The BuzzerBox plays **H.264 videos in `.mp4` files up to 1080p and 30 frames per second** smoothly. Videos from
iPhones (HEVC/H.265), 4K videos and videos with 60 frames per second often stutter or don't play. Convert them as
described in [creating games](creating-games.md#which-files-work), and try them on the box before the game.

A video plays on the TV but not on a second screen on a laptop: that browser may lack the codec; the TV on the box is
what counts.

## A question shows no image or video

The game lacks the file. When you prepare the game, the page lists the missing media. They are missing when:

- they were on a **USB stick** that isn't plugged in, for a game stored on that stick, or
- the game was imported **without its media**, from a `.json` file.

Upload files with the same names in the game's media (*Manage games* → the game → *Media*), or import the whole game
(`.buzzerbox.tar.gz`) instead.

## The savegame is gone, or saving fails

- The cloud icon in the toolbar says *Saving failed* when the savegame is on a **USB stick that was pulled out**. Plug
  it back in; the box keeps trying.
- **Discard game** deletes the savegame; **Pause game** keeps it. A discarded game can't be brought back.
- A savegame is stored where its game is stored: look under the other storage location (the box or the stick) in
  **Continue game**.

## The box's clock is wrong

The box has no clock of its own. It takes the time from the game master's device, so the times of savegames are right
as long as that device's time is.
