# Label Maker

A client-side label generator for GitHub Pages that builds a colored OBJ+MTL bundle (Plate + Text groups) ready for Bambu Studio. Users enter text, choose colors, preview the result in real-time, and export the model—no server required.

## Features

- Fixed 76.5 × 22 × 1 mm plate with rounded corners
- Three dedicated line inputs (top/middle/bottom) with automatic font tiers and preset vertical offsets for clean spacing
- Embossed text (1 mm) rendered in a Three.js preview
- OBJ + MTL export zipped with per-group materials so slicers keep plate/text colors

## Usage

1. Open `index.html` locally or via GitHub Pages.
2. Fill one to three line inputs (top-only centers itself, two lines render top/bottom, three lines add a middle row).
3. Pick plate and text colors (Black/White defaults provided).
4. Watch the Three.js preview update live.
5. Click **Download OBJ** when the status shows a valid configuration. The ZIP contains `label.obj` and `label.mtl`.

If the text cannot fit, the status area highlights the error and export is disabled.

## Development Notes

- Modules under `three-*.js`, `layout.js`, and `export-obj.js` are written as ES modules.
- The `three-font/` directory contains the Helvetiker Bold typeface JSON used for geometry generation.
- Three.js r158 modules, JSZip 3.10.1, and es-module-shims are vendored under `vendor/` for offline GitHub Pages hosting (and to keep import maps working across browsers).

## Screenshot

Add a screenshot or GIF of the running app once available. A 1280×720 GIF works well for the README and docs.
