// Print frames offered on the result screen. Every frame is one 4x6 in (10x15 cm) portrait
// print at 300 dpi. scripts/build-frames.mjs draws the overlays from these definitions, so the
// photo window and the date position here always match the artwork in public/frames/.

export const PRINT = { width: 1200, height: 1800, dpi: 300 } as const;

export type FrameFont = 'sans' | 'jua' | 'orbitron' | 'dseg' | 'pixel' | 'pen';

/** Digit-only web fonts for the date that is drawn at print time (built into /frames/fonts). */
export const FRAME_FONTS: Record<FrameFont, { family: string; weight: string }> = {
  sans: { family: 'HancutSans', weight: '700' },
  jua: { family: 'HancutJua', weight: '400' },
  orbitron: { family: 'HancutOrbitron', weight: '700' },
  dseg: { family: 'HancutDseg', weight: '400' },
  pixel: { family: 'HancutPixel', weight: '400' },
  pen: { family: 'HancutPen', weight: '400' },
};

export type DateFormat = 'dots' | 'spaced' | 'issue' | 'stamp';

export type FrameDate = {
  /** Anchor at print size; y is the text baseline. */
  x: number;
  y: number;
  size: number;
  color: string;
  font: FrameFont;
  align: 'left' | 'center' | 'right';
  format: DateFormat;
  glow?: string;
  spacing?: number;
};

export type FrameDef = {
  id: string;
  name: string;
  /** Photo window at print size. The photo is cropped to fill it. */
  photo: { x: number; y: number; w: number; h: number; r: number };
  /** Vertical crop position when the photo is taller than the window: 0 keeps the top, 1 the bottom. */
  focusY: number;
  date?: FrameDate;
};

// Keep more of the top for portraits; 4:5 composites leave only a small vertical crop.
const FOCUS = 0.28;

export const FRAMES: FrameDef[] = [
  { id: 'festival', name: '과학대제전', photo: { x: 60, y: 130, w: 1080, h: 1270, r: 16 }, focusY: FOCUS },
  {
    id: 'simple',
    name: '심플',
    photo: { x: 70, y: 150, w: 1060, h: 1330, r: 6 },
    focusY: FOCUS,
    date: { x: 1130, y: 100, size: 30, color: '#9a9db3', font: 'sans', align: 'right', format: 'dots' },
  },
  {
    id: 'film',
    name: '필름',
    photo: { x: 130, y: 200, w: 940, h: 1320, r: 4 },
    focusY: FOCUS,
    date: { x: 1036, y: 1484, size: 50, color: '#ff9a2e', font: 'dseg', align: 'right', format: 'stamp', glow: 'rgba(255, 110, 0, 0.8)' },
  },
  {
    id: 'space',
    name: '우주',
    photo: { x: 80, y: 280, w: 1040, h: 1250, r: 44 },
    focusY: FOCUS,
    date: { x: 600, y: 1730, size: 34, color: '#8fe9ff', font: 'orbitron', align: 'center', format: 'dots', spacing: 6 },
  },
  {
    id: 'lab',
    name: '실험 노트',
    photo: { x: 120, y: 320, w: 960, h: 1180, r: 0 },
    focusY: FOCUS,
    date: { x: 1080, y: 1640, size: 66, color: '#233a8b', font: 'pen', align: 'right', format: 'spaced' },
  },
  {
    id: 'id-card',
    name: '과학자 ID',
    photo: { x: 170, y: 400, w: 860, h: 1030, r: 24 },
    focusY: FOCUS,
    date: { x: 330, y: 1690, size: 38, color: '#12305c', font: 'sans', align: 'left', format: 'dots' },
  },
  {
    id: 'magazine',
    name: '매거진',
    photo: { x: 0, y: 290, w: 1200, h: 1510, r: 0 },
    focusY: FOCUS,
    date: { x: 1140, y: 78, size: 32, color: '#ffffff', font: 'sans', align: 'right', format: 'issue' },
  },
  {
    id: 'neon',
    name: '네온',
    photo: { x: 90, y: 290, w: 1020, h: 1230, r: 30 },
    focusY: FOCUS,
    date: { x: 600, y: 1728, size: 36, color: '#ff7ae8', font: 'orbitron', align: 'center', format: 'dots', glow: 'rgba(255, 60, 220, 0.9)', spacing: 6 },
  },
  {
    id: 'pixel',
    name: '레트로 게임',
    photo: { x: 100, y: 310, w: 1000, h: 1170, r: 0 },
    focusY: FOCUS,
    date: { x: 1100, y: 1736, size: 48, color: '#ffffff', font: 'pixel', align: 'right', format: 'dots' },
  },
  {
    id: 'himchan',
    name: '힘찬이',
    photo: { x: 80, y: 240, w: 1040, h: 1260, r: 50 },
    focusY: FOCUS,
    date: { x: 84, y: 1736, size: 40, color: '#2a5bb8', font: 'jua', align: 'left', format: 'spaced' },
  },
];

export const DEFAULT_FRAME_ID = 'festival';

export function findFrame(id: string | null | undefined): FrameDef {
  return FRAMES.find((f) => f.id === id) ?? FRAMES[0];
}

export const frameOverlayUrl = (id: string) => '/frames/' + id + '.webp';
export const frameThumbUrl = (id: string) => '/frames/thumb/' + id + '.webp';
export const frameFontUrl = (font: FrameFont) => '/frames/fonts/' + font + '.woff2';

/** Characters the date fonts are subset to; formatFrameDate only produces these. */
export const DATE_CHARACTERS = "0123456789.'- 년월호";

export function formatFrameDate(date: Date, format: DateFormat): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const two = (n: number) => String(n).padStart(2, '0');
  switch (format) {
    case 'spaced':
      return y + '. ' + m + '. ' + d + '.';
    case 'issue':
      return y + '년 ' + m + '월호';
    case 'stamp':
      return "'" + String(y).slice(2) + ' ' + two(m) + ' ' + two(d);
    default:
      return y + '.' + two(m) + '.' + two(d);
  }
}
