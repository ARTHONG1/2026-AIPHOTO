// Composition (camera framing) sketches for the 4th studio step.
// Every card reuses the pose mannequin from build-assets.mjs inside a 2:3 viewfinder,
// so zooming in or out reads as the same person and scene getting bigger or smaller.
// Figure landmarks (512 space): head top y=56, shoulders y=210, hips y=318, knees ~y=392, feet ~y=483.
//   kind 'frame': top/bottom = figure y shown at the top/bottom edge of the viewfinder,
//                 x = horizontal position of the figure in the frame (0..1), tilt = degrees.
//   kind 'camera': side view with a camera placed 'low' or 'high' looking at the figure.
//   guides: 'thirds' grid or 'center' line drawn over the frame.
export const COMPOSITION_GEOMETRY = {
  'close-up': { kind: 'frame', top: 34, bottom: 262 },
  'bust-shot': { kind: 'frame', top: 30, bottom: 300 },
  'waist-shot': { kind: 'frame', top: 26, bottom: 350 },
  'knee-shot': { kind: 'frame', top: 22, bottom: 420 },
  'full-shot': { kind: 'frame', top: 10, bottom: 520 },
  'long-shot': { kind: 'frame', top: -560, bottom: 640 },
  'low-angle': { kind: 'camera', camera: 'low' },
  'high-angle': { kind: 'camera', camera: 'high' },
  'dutch-angle': { kind: 'frame', top: 10, bottom: 470, tilt: -15 },
  'rule-of-thirds': { kind: 'frame', top: -40, bottom: 560, x: 1 / 3, guides: 'thirds' },
  'center-frame': { kind: 'frame', top: -20, bottom: 540, guides: 'center' },
};
