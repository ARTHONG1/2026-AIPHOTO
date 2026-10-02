// Pose sketch geometry for generated pose references.
// Angles are absolute degrees from straight down; positive values point away
// from the body centre (outward), 180 points straight up.
// Alternatively lt/rt give an absolute hand target (512x512 canvas) solved with
// two-bone IK; lb/rb pick the elbow side ('out' | 'down').
// Landmarks without lean: head centre (256,126) r70, shoulders (210,210)/(302,210),
// hips (229,318)/(283,318).

export const POSE_GEOMETRY = {
  // Former hand-drawn poses, redrawn in the same style so all 44 match.
  'raise-hands': { la: [150, 165], ra: [150, 165], lh: 'open', rh: 'open', ll: [10, 6], rl: [10, 6] },
  heart: { lt: { x: 244, y: 250 }, rt: { x: 268, y: 250 }, lb: 'down', rb: 'down', lh: 'heart', rh: 'none' },
  throw: { la: [60, 20], ra: [140, 185], lh: 'open', rh: 'ball', ll: [6, 0], rl: [28, 18], lean: 8 },
  // Camera held at chest height so the face stays visible.
  camera: { lt: { x: 214, y: 236 }, rt: { x: 298, y: 236 }, lb: 'down', rb: 'down', lh: 'camera', rh: 'none' },
  wave: { la: [10, 4], ra: [120, 200], rh: 'open', rhDir: 200, extras: ['wave'] },
  'v-sign': { la: [10, 4], rt: { x: 340, y: 118 }, rb: 'down', rh: 'v', rhDir: 180 },
  'thumbs-up': { la: [10, 4], ra: [70, 150], rh: 'thumb', rhScale: 1.3 },
  'arms-crossed': { lt: { x: 290, y: 236 }, rt: { x: 222, y: 236 }, lb: 'down', rb: 'down', lh: 'fist', rh: 'fist' },
  'hands-on-hips': { lt: { x: 214, y: 306 }, rt: { x: 298, y: 306 }, lh: 'fist', rh: 'fist', ll: [10, 6], rl: [10, 6] },
  point: { la: [10, 4], ra: [95, 90], rh: 'point', rhDir: 90 },
  think: { lt: { x: 280, y: 258 }, rt: { x: 272, y: 196 }, lb: 'down', rb: 'down', lh: 'fist', rh: 'fist', extras: ['think'] },
  bow: { lt: { x: 246, y: 330 }, rt: { x: 266, y: 330 }, lh: 'fist', rh: 'fist', bow: true },
  run: { la: [-40, -90], ra: [60, 150], lh: 'fist', rh: 'fist', ll: [-40, 10], rl: [55, -30], lean: 10, extras: ['speed'] },
  'jump-legacy': { la: [140, 160], ra: [140, 160], lh: 'open', rh: 'open', ll: [20, -30], rl: [20, -30], dy: -34, extras: ['motion'] },
  salute: { la: [8, -6], ra: [100, -125], rh: 'open', rhDir: -150 },
  'superhero-fly': { la: [10, 4], ra: [178, 180], rh: 'fist', ll: [2, 0], rl: [4, 2] },
  'rocket-launch': { la: [172, 190], ra: [172, 190], lh: 'open', rh: 'open', ll: [4, 0], rl: [4, 0], dy: -6 },
  binoculars: { lt: { x: 226, y: 122 }, rt: { x: 286, y: 122 }, lb: 'down', rb: 'down', lh: 'ring', rh: 'ring' },
  clap: { lt: { x: 246, y: 238 }, rt: { x: 266, y: 238 }, lh: 'open', rh: 'open', lhDir: 185, rhDir: 175 },
  't-pose': { la: [90, 90], ra: [90, 90], lh: 'open', rh: 'open', ll: [8, 6], rl: [8, 6] },
  ballet: { la: [150, 200], ra: [95, 110], lh: 'open', rh: 'open', ll: [3, 0], rl: [40, 40], lean: -4 },
  'tree-yoga': { la: [165, 200], ra: [165, 200], lh: 'open', rh: 'open', ll: [2, 0], rl: [70, -60] },
  squat: { la: [30, -20], ra: [30, -20], lh: 'open', rh: 'open', ll: [70, 5], rl: [70, 5], dy: 50 },
  stretch: { lt: { x: 196, y: 300 }, ra: [160, 205], rh: 'open', lean: -10 },
  stop: { la: [10, 4], rt: { x: 292, y: 222 }, rh: 'open', rhDir: 180, rhScale: 1.35 },
  'high-five': { la: [12, 6], ra: [150, 150], rh: 'open', rhDir: 150, rhScale: 1.35 },
  'double-v': { lt: { x: 176, y: 146 }, rt: { x: 336, y: 146 }, lb: 'down', rb: 'down', lh: 'v', rh: 'v', lhDir: 200, rhDir: 160 },
  'heart-head': { la: [150, 235], ra: [150, 235], lh: 'fist', rh: 'fist' },
  boxing: { la: [25, -150], ra: [20, -155], lh: 'fist', rh: 'fist', ll: [14, 8], rl: [14, 8] },
  kick: { la: [45, -120], ra: [50, -110], lh: 'fist', rh: 'fist', ll: [4, 2], rl: [92, 92], lean: -10 },
  disco: { la: [35, -50], ra: [150, 150], lh: 'fist', rh: 'point', ll: [6, 4], rl: [22, 10] },
  'robot-dance': { la: [90, 0], ra: [90, 180], lh: 'open', rh: 'open' },
  'astronaut-float': { la: [120, 150], ra: [70, 40], lh: 'open', rh: 'open', ll: [30, 50], rl: [20, -10], lean: 14, dy: -18 },
  surprise: { la: [25, -165], ra: [25, -165], lh: 'open', rh: 'open' },
  victory: { lt: { x: 196, y: 272 }, ra: [172, 178], lh: 'fist', rh: 'fist', ll: [8, 4], rl: [8, 4] },
  presenter: { la: [35, -50], ra: [70, 100], lh: 'fist', rh: 'open' },
  'head-scratch': { la: [10, 4], ra: [120, -140], rh: 'open' },
  'x-arms': { lt: { x: 300, y: 204 }, rt: { x: 212, y: 204 }, lb: 'down', rb: 'down', lh: 'fist', rh: 'fist' },
  airplane: { la: [100, 100], ra: [80, 80], lh: 'open', rh: 'open', lean: 12 },
  zap: { la: [120, 150], ra: [120, 150], lh: 'open', rh: 'open', ll: [25, 25], rl: [25, 25], extras: ['zap'] },
  dab: { la: [135, 135], ra: [115, -120], lh: 'open', rh: 'fist', lean: -6 },
  flex: { la: [95, 175], ra: [95, 175], lh: 'fist', rh: 'fist', ll: [10, 6], rl: [10, 6] },
  shush: { la: [10, 4], rt: { x: 262, y: 178 }, rb: 'down', rh: 'point', rhDir: 180 },
  'tuck-jump': { la: [150, 165], ra: [150, 165], lh: 'open', rh: 'open', ll: [35, -20], rl: [35, -20], dy: -40, extras: ['motion'] },
  // Added for the 50-pose set.
  eureka: { la: [10, 4], rt: { x: 336, y: 96 }, rb: 'down', rh: 'point', rhDir: 180, extras: ['idea'] },
  'look-far': { la: [10, 4], rt: { x: 276, y: 104 }, rb: 'down', rh: 'open', rhDir: -90, lean: 4 },
  'finger-guns': { lt: { x: 168, y: 246 }, rt: { x: 344, y: 246 }, lb: 'down', rb: 'down', lh: 'point', rh: 'point', lhDir: -100, rhDir: 100 },
  'double-wave': { la: [125, 175], ra: [125, 175], lh: 'open', rh: 'open', lhDir: 190, rhDir: 170, extras: ['wave'] },
  shrug: { lt: { x: 168, y: 234 }, rt: { x: 344, y: 234 }, lb: 'down', rb: 'down', lh: 'open', rh: 'open', lhDir: -150, rhDir: 150 },
  'energy-blast': { lt: { x: 362, y: 244 }, rt: { x: 384, y: 230 }, lb: 'down', rb: 'down', lh: 'open', rh: 'open', lhDir: 90, rhDir: 90, lean: -6, ll: [14, 6], rl: [6, 2], extras: ['beam'] },
};
