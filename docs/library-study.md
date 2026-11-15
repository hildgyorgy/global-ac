# Levitating globe in the library study

`LibraryStudy.ts` places the globe above a recessed engraved brass disk in a walnut desk. There is no semicircular support or meridian cradle. The atmosphere's lowest extent stays above the plate. Props include a shaded brass reading lamp, a parchment circulation sketch, stacked leather books, an ink bottle, feather quill, spare nib pen, and rolled parchment. Dark bookshelves provide depth behind the instrument.

All props are actual Three.js geometry. Walnut grain, parchment, and plate engraving are deterministic CanvasTextures generated locally at startup. No external models, new dependencies, image services, or remote environment assets are required. Materials use WebGPU node materials. One 1024-pixel directional shadow map gives the globe and props spatial contact on the desk. A warm directional key and local point light both originate at the visible lamp fixture; faint room ambient light keeps the globe's dark side readable. This remains artistic lighting, not a date-derived Sun model.

`DeskControls.ts` uses Three.js CSS3DRenderer for the three existing accessible HTML controls. Their world-space pose matches the brass bezel on the slanted desk panel. Native buttons retain their switch states, pointer/touch handling, keyboard focus, and labels; the overlay ignores pointer events everywhere except the buttons. The atmospheric scene itself still uses WebGPURenderer, TSL compute, and GPU storage. CSS3D is only a DOM projection layer, not a WebGL renderer or simulation fallback.

The initial camera frames the desk from slightly above, with portrait-aspect fitting. Orbit limits keep the camera above the desk and on the front side of the library. Cell selection and atmospheric physics are unchanged. Section mode moves to a front-facing cut while retaining enough distance for the embedded control panel. Alaphelyzet returns to the new desk overview, preserving the globe's spin and Coriolis setting.

Validation includes TypeScript, production build, WebGPU console checks, panel switching, section camera framing, globe selection, orbit/reset behavior, and a 768×1024 responsive viewport. A physical tablet has not been tested.
