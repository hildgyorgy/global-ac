# Library study

`LibraryStudy.ts` builds a walnut desk, engraved levitation disk, shaded brass
lamp, parchment sketch, leather books, ink bottle, feather quill, spare pen,
scroll and dark bookshelves from Three.js geometry. Procedural CanvasTextures
supply wood grain, parchment and engraving; no downloaded room models are used.
The globe floats above the disk without a meridian cradle.

An aligned directional key casts shadows; the lamp's local point light adds a
pool of light, and faint ambient fill preserves dark-side visibility. The quill
and its instanced fibres use lit materials. See [the model](model.md) for lighting
and atmospheric limitations.

`DeskControls.ts` places equal recessed brass pills in the tabletop: PROJECTION,
CORIOLIS, JET-STREAMS, AZORES HIGH and RESET. The title is inlaid above the row, toward the globe.
Active controls glow softly in amber; RESET pulses briefly. Real depth testing
allows foreground particles to pass in front of the controls.

Native offscreen controls retain English screen-reader labels, keyboard access
and pressed states. Physical mesh picking handles mouse/touch taps; drags and
multitouch remain camera gestures. Solid scene geometry occludes control picks.

Camera presets fit the desk in wide and portrait layouts. Orbit limits keep the
camera above and in front of the desk. RESET restores the initial globe framing
and clears cell focus while preserving the wind controls. In projection the
room and title dim, while independently lit buttons remain legible.
