# Hardware

The 3D-printed parts of the **BuzzerBox Compact**: the case of the box and the base of its wireless buzzers. The
firmware of the buzzers is in [`firmware/wireless-buzzer/`](../firmware/wireless-buzzer/README.md).

| Folder | What |
|---|---|
| [`compact-box/`](compact-box/README.md) | The case of the box: a bottom tray for the Compute Module's IO board and a top with the touchscreen |
| [`wireless-buzzer/`](wireless-buzzer/README.md) | The base of the wireless buzzer, which holds the Feather and the big button |

Every part comes in four formats:

| Format | For |
|---|---|
| `.f3d` | The Fusion source, to change the design. One file can hold several parts. |
| `.step` | The same geometry for any other CAD program |
| `.3mf` | Printing: open it in a slicer. Each file holds one part, which can have several bodies. |
| `.stl` | Printing, for slicers without 3MF. A part with several bodies has one STL per body. |

All files are named `buzzerbox-compact-…`. When a design changes, export the STEP, 3MF and STL files again from the
Fusion file, so that all formats show the same version.
