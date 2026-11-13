# Cell selection

A short click or tap on a cell toggles its focus. The six selectable cells are northern/southern Hadley, Ferrel, and polar cells. Selected particles and their trails render at 1.8 times normal color intensity; other cells render at 0.35 times normal intensity. Temperature colors and simulation remain unchanged. Clicking empty space, the same cell again, or Alaphelyzet clears selection. Selection persists when switching globe/section modes or toggling Coriolis.

`CellSelection.ts` uses Pointer Events for mouse, pen, and touch. Gestures moving more than seven CSS pixels, lasting more than 450 ms, cancelled gestures, or multiple pointers do not select. Ordinary OrbitControls gestures remain available; section mode retains its existing zoom-only camera behavior. Selection is disabled during camera transitions.

Picking uses analytical geometry, without reading GPU particle buffers back. In globe mode, it uses the front surface latitude for taps over the Earth, and the limb latitude for taps in the atmospheric halo. This is a geographic proxy, not exact picking of individual particles in a translucent 3D volume. In section mode, it intersects the fixed cut plane and selects by latitude within the visible atmospheric annulus. The globe's axial tilt is included in both calculations.

GPU node materials classify particles by hemisphere and 30-degree cell band. The same focus function applies to historical trail positions, preserving their temperature colors and slab clipping. No hover behavior or CPU per-particle updates are introduced.

Verification: TypeScript and production build; browser checks of selecting/toggling a cell in globe and section modes, retaining selection during orbit drag, and clearing via background click; synthetic Pointer Events checks for short tap, drag out-and-back, long hold, multitouch, cancellation, all six cell ids, and listener disposal. Physical tablet testing remains outstanding.
