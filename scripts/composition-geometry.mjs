// Storyboard sketches for the 50 composition cards (rendered by scripts/sketch.mjs).
// Figure landmarks (512 space): head top y~72, shoulders y~210, hips y~318, knees y~392, feet y~486.
//   kind 'frame': top/bottom = figure y at the top/bottom edge of the frame, x = horizontal place (0..1),
//                 tilt = degrees, guides = red pencil guide lines, mark = extra storyboard marks,
//                 theme = scene variant (sky, sun, stars, ...), pose = mannequin pose.
//   kind 'camera': side view with the camera at 'eye' | 'low' | 'high' | 'top' | 'ground' | 'drone'.
//   kind 'top': view from above with the camera at an angle around the head.
//   other kinds draw one special storyboard each.
const RUN = { la: [-40, -90], ra: [60, 150], lh: 'fist', rh: 'fist', ll: [-40, 10], rl: [55, -30], lean: 10 };
const JUMP = { la: [140, 160], ra: [140, 160], lh: 'open', rh: 'open', ll: [35, -20], rl: [35, -20], dy: -40 };
const WALK = { la: [-18, -8], ra: [22, 10], lh: 'fist', rh: 'fist', ll: [-14, 2], rl: [16, 8], lean: 4 };
const EMPTY = { clouds: false, mountains: false, trees: false, sun: false };

export const COMPOSITION_GEOMETRY = {
  // zoom
  'extreme-close-up': { kind: 'frame', top: 62, bottom: 200 },
  'close-up': { kind: 'frame', top: 40, bottom: 262 },
  'bust-shot': { kind: 'frame', top: 30, bottom: 300 },
  'waist-shot': { kind: 'frame', top: 26, bottom: 350 },
  'knee-shot': { kind: 'frame', top: 22, bottom: 420 },
  'full-shot': { kind: 'frame', top: 10, bottom: 530 },
  'long-shot': { kind: 'frame', top: -560, bottom: 640 },
  'extreme-long-shot': { kind: 'frame', top: -1500, bottom: 1150 },
  // camera angle
  'eye-level': { kind: 'camera', camera: 'eye' },
  'high-angle': { kind: 'camera', camera: 'high' },
  'low-angle': { kind: 'camera', camera: 'low' },
  'birds-eye': { kind: 'camera', camera: 'top' },
  'worms-eye': { kind: 'camera', camera: 'ground' },
  'dutch-angle': { kind: 'frame', top: 10, bottom: 470, tilt: -15 },
  'three-quarter': { kind: 'top', angle: 45 },
  profile: { kind: 'top', angle: 90 },
  aerial: { kind: 'camera', camera: 'drone' },
  // layout
  'rule-of-thirds': { kind: 'frame', top: -40, bottom: 560, x: 1 / 3, guides: 'thirds' },
  'center-frame': { kind: 'frame', top: -20, bottom: 540, guides: 'center' },
  'golden-ratio': { kind: 'frame', top: -40, bottom: 560, x: 0.382, guides: 'golden' },
  diagonal: { kind: 'frame', top: -60, bottom: 580, x: 0.3, guides: 'diagonal' },
  'leading-lines': { kind: 'frame', top: -300, bottom: 640, mark: 'leading', theme: { trees: false } },
  'negative-space': { kind: 'frame', top: -900, bottom: 620, x: 0.22, theme: { clouds: false, trees: false, mountains: false, sun: { x: 1200, y: -700, r: 60 } } },
  'frame-in-frame': { kind: 'frame', top: -60, bottom: 560, mark: 'arch' },
  'foreground-framing': { kind: 'frame', top: -60, bottom: 560, mark: 'foreground' },
  'low-horizon': { kind: 'frame', top: -1100, bottom: 580, guides: 'horizon', theme: { trees: false, mountains: false } },
  // lens
  'wide-angle': { kind: 'frame', top: -40, bottom: 580, mark: 'wide', theme: { trees: false } },
  fisheye: { kind: 'frame', top: -60, bottom: 560, mark: 'fisheye' },
  telephoto: { kind: 'frame', top: -40, bottom: 560, theme: { sun: { x: 256, y: -40, r: 340 }, moon: true, clouds: false, mountains: false, trees: false } },
  bokeh: { kind: 'frame', top: 20, bottom: 420, mark: 'bokeh', theme: EMPTY },
  'deep-focus': { kind: 'frame', top: -200, bottom: 600, x: 0.6, mark: 'deepfocus' },
  'tilt-shift': { kind: 'frame', top: -700, bottom: 900, mark: 'tiltshift' },
  'soft-focus': { kind: 'frame', top: 20, bottom: 420, mark: 'soft', theme: { trees: false } },
  starburst: { kind: 'frame', top: -40, bottom: 560, mark: 'starburst', theme: { sun: false } },
  // light and exposure
  silhouette: { kind: 'frame', top: -40, bottom: 560, solid: true, theme: { sky: 'warm', sun: { x: 256, y: 330, r: 130 }, clouds: false, trees: false } },
  'rim-light': { kind: 'frame', top: 0, bottom: 520, rim: true, theme: { sun: { x: 256, y: 90, r: 96 }, clouds: false, trees: false } },
  'golden-hour': { kind: 'frame', top: -40, bottom: 560, shadow: true, theme: { sky: 'warm', sun: { x: -170, y: 430, r: 80 } } },
  'blue-hour': { kind: 'frame', top: -60, bottom: 560, theme: { sky: 'blue', sun: { x: 520, y: -220, r: 50 }, moon: true, stars: true, clouds: false } },
  'high-key': { kind: 'frame', top: 20, bottom: 440, theme: { ...EMPTY, bright: true } },
  'low-key': { kind: 'frame', top: 20, bottom: 440, mark: 'spot', theme: { ...EMPTY, sky: 'dark' } },
  rembrandt: { kind: 'frame', top: 40, bottom: 262, mark: 'rembrandt', theme: { ...EMPTY, sky: 'dark' } },
  'long-exposure': { kind: 'frame', top: -40, bottom: 560, mark: 'trails', theme: { sky: 'dark', stars: true, sun: false, clouds: false, trees: false } },
  // shutter and special techniques
  panning: { kind: 'frame', top: 0, bottom: 540, pose: RUN, mark: 'panning', theme: { trees: false } },
  'freeze-motion': { kind: 'frame', top: -80, bottom: 540, pose: JUMP, mark: 'freeze' },
  reflection: { kind: 'reflection' },
  'forced-perspective': { kind: 'forced' },
  'little-planet': { kind: 'planet' },
  'flat-lay': { kind: 'flatlay' },
  candid: { kind: 'frame', top: -20, bottom: 560, x: 0.64, pose: WALK, mark: 'snap' },
  'double-exposure': { kind: 'double' },
};
