# BuzzerBox Compact wireless buzzer

The base of the wireless buzzer: it holds the electronics, and the button station is screwed on top of it. How the
buzzer is wired and flashed is in the [firmware's README](../../firmware/wireless-buzzer/README.md#hardware).

| Part | Files | Size (W × D × H) |
|---|---|---|
| Base | `buzzerbox-compact-buzzer-base.{f3d,step,3mf,stl}` | 86 × 86 × 35 mm |

The box names a buzzer after the color of its case and shows its team in that color, so print each buzzer in a
different color. The color is set when the buzzer is adopted, see
[Wireless buzzers](../../docs/user/wireless-buzzers.md) in the user guide.

## Parts

| Part | Count | Notes |
|---|---|---|
| [Giovenzana PG1M9W01](https://www.giovenzana.com/component/pg1m9w01/) ([datasheet](https://static.giovenzana.com/attachments/datasheets/DS-PG1M9W01-PG8M9W10-EN.pdf)) | 1 | The button: a Ø90 mushroom button in an IP66 station. Its screws go straight into the printed base, without inserts. |
| [Adafruit ESP32 Feather V2](https://www.adafruit.com/product/5400) or [Feather ESP32-S3](https://www.adafruit.com/product/5323) | 1 | The firmware supports both, see its README |
| LiPo battery: 850 mAh, 35 × 25 × 10 mm, 2-pin JST-PH plug (2.0 mm pitch) | 1 | Charged over the Feather's USB port |
