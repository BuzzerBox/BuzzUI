# BuzzerBox Compact case

The case of the BuzzerBox Compact: a lightweight box with the touchscreen built in, on which the host can run the game
(the game master) without a phone or tablet. The teams' screen is a TV or projector on its HDMI port.

The case has two parts: the **bottom tray**, which holds the Raspberry Pi Compute Module on its IO board, and the
**top**, which closes the tray and holds the touchscreen. The top is printed in two pieces: the **plate**, which closes
the tray, and the tilted **back of the display** on top of it, screwed together from inside the box.

| Part | Files | Size (W × D × H) |
|---|---|---|
| Bottom tray, Compute Module 4 | `buzzerbox-compact-bottom-tray-cm4.{step,3mf,stl}` | 248 × 125 × 25 mm |
| Bottom tray, Compute Module 5 | `buzzerbox-compact-bottom-tray-cm5.{step,3mf,stl}` | 248 × 125 × 25 mm |
| Top, both pieces | `buzzerbox-compact-top.{step,3mf}` | |
| Top: plate | `buzzerbox-compact-top-plate.stl` | 248 × 125 × 25 mm |
| Top: back of the display | `buzzerbox-compact-top-display-back.stl` | 248 × 72 × 157 mm |

Print one bottom tray, for the Compute Module the box has, and both pieces of the top. The top's 3MF holds both
pieces as separate objects; the STL files have one piece each, for slicers without 3MF.

`buzzerbox-compact-case.f3d` is the Fusion source of the top and both trays.

## Parts

| Part | Count | Notes |
|---|---|---|
| Raspberry Pi Compute Module 4 or 5, 4 GB RAM | 1 | Print the bottom tray for it |
| The Compute Module's IO board (CM4 IO Board or CM5 IO Board) | 1 | Sits on four standoffs in the tray |
| Raspberry Pi Touch Display 2, 10 inch | 1 | In the back of the display |
| M2.5 brass hex standoffs, male-female, 5 mm + 6 mm thread | | Between the back of the display and the screen |
| M2.5 heat-set inserts | 8 | 4 in the IO board's standoffs, 4 in the pillars of the top |
| M3 heat-set inserts | 4 | In the underside of the back of the display |
| M2.5 screws, about 6 mm | 8 | 4 for the IO board, 4 from below through the tray into the top's pillars |
| M3 screws, about 8 mm | 4 | From inside the box through the plate into the back of the display |
| M2.5 screws, about 8–10 mm | 4 | Through the back of the display, with the head in its counterbore |
| Rubber feet, Ø10 mm | 4 | In the recesses under the tray |

## Holes

As modelled, for checking a print or adapting the design to other inserts:

| Where | Hole |
|---|---|
| M2.5 inserts (IO board standoffs, top's pillars) | Ø3.2 mm, 5 mm deep |
| M3 inserts (underside of the back of the display) | Ø4.0 mm, 6.7 mm deep |
| M3 screws through the plate | Ø3.4 mm through the 3 mm plate |
| M2.5 screws through the tray | Ø2.9 mm, head in a Ø5.5 × 1.2 mm counterbore |
| M2.5 screws through the back of the display | Ø2.8 mm, head in a Ø5.5 mm counterbore |
| Rubber feet | Ø10.5 mm, 0.9 mm deep |

The IO board's standoffs are 134 × 69 mm apart in the CM4 tray and 121.5 × 69 mm in the CM5 tray.

## Printing

The longest parts are 248 mm, so they need a print bed of at least 250 mm in one direction.
