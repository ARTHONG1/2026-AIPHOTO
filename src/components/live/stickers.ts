// Sticker catalog for the live photo page. Science stickers are drawn as SVG in the same
// style as the pose cards (navy outline, bright fills) with a white die-cut border;
// emoji stickers use the phone's own emoji font. Every sticker renders as a square image.

const INK = '#2b2350';

export type StickerDef = { id: string; label: string } & ({ kind: 'svg'; svg: string } | { kind: 'emoji'; char: string });
export type PlacedSticker = { uid: string; defId: string; x: number; y: number; size: number; rot: number };

const wrap = (inner: string) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400">' +
  '<defs><filter id="cut" x="-20%" y="-20%" width="140%" height="140%">' +
  '<feMorphology in="SourceAlpha" operator="dilate" radius="7" result="d"/><feFlood flood-color="#ffffff"/>' +
  '<feComposite in2="d" operator="in" result="w"/><feMerge><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge>' +
  '</filter></defs><g filter="url(#cut)">' + inner + '</g></svg>';

const s = (w = 6) => ' stroke="' + INK + '" stroke-width="' + w + '" stroke-linejoin="round" stroke-linecap="round"';

function starPoints(cx: number, cy: number, outer: number, inner: number, n = 5) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push((cx + Math.cos(a) * r).toFixed(1) + ',' + (cy + Math.sin(a) * r).toFixed(1));
  }
  return pts.join(' ');
}

const sparkle = (cx: number, cy: number, r: number, fill: string) =>
  '<path d="M' + cx + ' ' + (cy - r) + ' Q' + cx + ' ' + cy + ' ' + (cx + r) + ' ' + cy + ' Q' + cx + ' ' + cy + ' ' + cx + ' ' + (cy + r) +
  ' Q' + cx + ' ' + cy + ' ' + (cx - r) + ' ' + cy + ' Q' + cx + ' ' + cy + ' ' + cx + ' ' + (cy - r) + ' Z" fill="' + fill + '"' + s(5) + '/>';

function dnaPaths() {
  const a: string[] = [];
  const b: string[] = [];
  let rungs = '';
  for (let y = 24; y <= 176; y += 4) {
    const t = ((y - 24) / 152) * Math.PI * 3;
    a.push((100 + Math.sin(t) * 42).toFixed(1) + ' ' + y);
    b.push((100 - Math.sin(t) * 42).toFixed(1) + ' ' + y);
    if ((y - 24) % 16 === 8) rungs += '<path d="M' + (100 + Math.sin(t) * 42).toFixed(1) + ' ' + y + ' L' + (100 - Math.sin(t) * 42).toFixed(1) + ' ' + y + '"' + s(5) + '/>';
  }
  const strand = (pts: string[], color: string) =>
    '<path d="M' + pts.join(' L') + '" fill="none"' + s(16) + '/><path d="M' + pts.join(' L') + '" fill="none" stroke="' + color + '" stroke-width="8" stroke-linecap="round"/>';
  return rungs + strand(a, '#5de4ff') + strand(b, '#ff7ad9');
}

const bubble = (fill: string, text: string, size: number, color: string) =>
  '<path d="M26 88 C26 50 62 28 100 28 C142 28 174 52 174 88 C174 124 142 146 104 146 L66 174 L76 140 C46 132 26 114 26 88 Z" fill="' + fill + '"' + s(7) + '/>' +
  '<text x="100" y="' + (88 + size * 0.36).toFixed(0) + '" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="' + size + '" fill="' + color + '" stroke="' + INK + '" stroke-width="2.5">' + text + '</text>';

const SCIENCE: StickerDef[] = [
  {
    id: 'atom',
    label: '원자',
    kind: 'svg',
    svg: wrap(
      [0, 60, 120].map((a) => '<ellipse cx="100" cy="100" rx="78" ry="28" transform="rotate(' + a + ' 100 100)" fill="none"' + s(16) + '/>').join('') +
        [0, 60, 120].map((a) => '<ellipse cx="100" cy="100" rx="78" ry="28" transform="rotate(' + a + ' 100 100)" fill="none" stroke="#5de4ff" stroke-width="7"/>').join('') +
        '<circle cx="100" cy="100" r="18" fill="#ff7ad9"' + s(6) + '/><circle cx="178" cy="100" r="9" fill="#ffd84d"' + s(4) + '/><circle cx="61" cy="33" r="9" fill="#ffd84d"' + s(4) + '/>'
    ),
  },
  {
    id: 'rocket',
    label: '로켓',
    kind: 'svg',
    svg: wrap(
      '<g transform="rotate(38 100 100)"><path d="M84 128 L100 178 L116 128 Z" fill="#ffd84d"' + s(6) + '/>' +
        '<path d="M100 18 C130 44 136 88 128 130 L72 130 C64 88 70 44 100 18 Z" fill="#f4f6ff"' + s(6) + '/>' +
        '<circle cx="100" cy="74" r="16" fill="#5de4ff"' + s(6) + '/><path d="M72 102 L46 140 L74 134 Z" fill="#ff5a6e"' + s(6) + '/><path d="M128 102 L154 140 L126 134 Z" fill="#ff5a6e"' + s(6) + '/></g>'
    ),
  },
  { id: 'star', label: '별', kind: 'svg', svg: wrap('<polygon points="' + starPoints(100, 106, 84, 38) + '" fill="#ffd84d"' + s(7) + '/><circle cx="84" cy="100" r="6" fill="' + INK + '"/><circle cx="116" cy="100" r="6" fill="' + INK + '"/><path d="M88 118 Q100 128 112 118" fill="none"' + s(5) + '/>') },
  {
    id: 'heart',
    label: '하트',
    kind: 'svg',
    svg: wrap('<path d="M100 172 C38 128 20 92 38 60 C56 32 92 38 100 66 C108 38 144 32 162 60 C180 92 162 128 100 172 Z" fill="#ff7ad9"' + s(7) + '/><ellipse cx="62" cy="72" rx="12" ry="8" fill="#ffffff" transform="rotate(-30 62 72)"/>'),
  },
  {
    id: 'saturn',
    label: '토성',
    kind: 'svg',
    svg: wrap(
      '<circle cx="100" cy="100" r="50" fill="#ffb35c"' + s(6) + '/><path d="M58 86 Q100 74 142 86 M54 108 Q100 98 146 108" fill="none" stroke="#e07b2e" stroke-width="7"/>' +
        '<ellipse cx="100" cy="104" rx="88" ry="24" transform="rotate(-16 100 104)" fill="none"' + s(18) + '/><ellipse cx="100" cy="104" rx="88" ry="24" transform="rotate(-16 100 104)" fill="none" stroke="#ffe08a" stroke-width="9"/>'
    ),
  },
  { id: 'bolt', label: '번개', kind: 'svg', svg: wrap('<path d="M118 16 L50 112 L96 112 L80 184 L152 80 L104 80 Z" fill="#ffd84d"' + s(7) + '/>') },
  { id: 'dna', label: 'DNA', kind: 'svg', svg: wrap(dnaPaths()) },
  {
    id: 'flask',
    label: '플라스크',
    kind: 'svg',
    svg: wrap(
      '<path d="M78 28 L122 28 L122 44 L114 44 L114 82 L160 160 Q166 176 148 176 L52 176 Q34 176 40 160 L86 82 L86 44 L78 44 Z" fill="#eaf8ff"' + s(6) + '/>' +
        '<path d="M62 126 L138 126 L160 160 Q166 176 148 176 L52 176 Q34 176 40 160 Z" fill="#7dff9c"' + s(5) + '/>' +
        '<circle cx="82" cy="150" r="7" fill="#ffffff"/><circle cx="112" cy="140" r="5" fill="#ffffff"/><circle cx="132" cy="14" r="9" fill="#7dff9c"' + s(4) + '/><circle cx="150" cy="34" r="6" fill="#7dff9c"' + s(4) + '/>'
    ),
  },
  {
    id: 'bulb',
    label: '아이디어',
    kind: 'svg',
    svg: wrap(
      [-60, -30, 0, 30, 60].map((a) => '<path d="M100 18 L100 4" transform="rotate(' + a + ' 100 84)"' + s(7) + '/>').join('') +
        '<path d="M100 26 C66 26 46 52 46 80 C46 104 62 116 72 132 L128 132 C138 116 154 104 154 80 C154 52 134 26 100 26 Z" fill="#ffe066"' + s(6) + '/>' +
        '<rect x="72" y="132" width="56" height="34" rx="8" fill="#c9ccd9"' + s(6) + '/><path d="M76 148 L124 148" fill="none"' + s(5) + '/><path d="M88 176 L112 176"' + s(8) + '/>' +
        '<path d="M86 100 L96 86 L104 100 L114 86" fill="none" stroke="#ff9b4d" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
  },
  {
    id: 'magnet',
    label: '자석',
    kind: 'svg',
    svg: wrap(
      '<path d="M46 50 L46 108 A54 54 0 0 0 154 108 L154 50 L118 50 L118 108 A18 18 0 0 1 82 108 L82 50 Z" fill="#ff5a6e"' + s(7) + '/>' +
        '<rect x="46" y="26" width="36" height="28" rx="4" fill="#d9dde8"' + s(6) + '/><rect x="118" y="26" width="36" height="28" rx="4" fill="#d9dde8"' + s(6) + '/>'
    ),
  },
  {
    id: 'crown',
    label: '왕관',
    kind: 'svg',
    svg: wrap(
      '<path d="M28 150 L36 58 L72 100 L100 42 L128 100 L164 58 L172 150 Z" fill="#ffd84d"' + s(7) + '/><rect x="28" y="146" width="144" height="24" rx="6" fill="#ffb800"' + s(6) + '/>' +
        '<circle cx="100" cy="122" r="12" fill="#ff5a6e"' + s(5) + '/><circle cx="62" cy="128" r="9" fill="#5de4ff"' + s(5) + '/><circle cx="138" cy="128" r="9" fill="#7dff9c"' + s(5) + '/>'
    ),
  },
  { id: 'sparkles', label: '반짝', kind: 'svg', svg: wrap(sparkle(84, 104, 58, '#ffd84d') + sparkle(150, 52, 30, '#5de4ff') + sparkle(150, 156, 22, '#ff7ad9')) },
  { id: 'wow', label: 'WOW', kind: 'svg', svg: wrap(bubble('#fff36b', 'WOW!', 46, '#ff5a6e')) },
  { id: 'science-best', label: '과학 짱', kind: 'svg', svg: wrap(bubble('#9ff0ff', '과학 짱!', 36, '#6c4dff')) },
  {
    id: 'emc2',
    label: 'E=mc²',
    kind: 'svg',
    svg: wrap('<rect x="18" y="58" width="164" height="84" rx="24" fill="#6c4dff"' + s(6) + '/><text x="100" y="116" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="46" fill="#ffd84d">E=mc²</text>'),
  },
  {
    id: 'robot',
    label: '로봇',
    kind: 'svg',
    svg: wrap(
      '<path d="M100 40 L100 22"' + s(7) + '/><circle cx="100" cy="18" r="10" fill="#ff5a6e"' + s(5) + '/>' +
        '<rect x="36" y="40" width="128" height="110" rx="26" fill="#cfe9ff"' + s(7) + '/><rect x="22" y="78" width="16" height="36" rx="6" fill="#9fb4d6"' + s(5) + '/><rect x="162" y="78" width="16" height="36" rx="6" fill="#9fb4d6"' + s(5) + '/>' +
        '<circle cx="74" cy="88" r="16" fill="#ffffff"' + s(5) + '/><circle cx="126" cy="88" r="16" fill="#ffffff"' + s(5) + '/><circle cx="76" cy="90" r="7" fill="' + INK + '"/><circle cx="128" cy="90" r="7" fill="' + INK + '"/>' +
        '<rect x="70" y="118" width="60" height="14" rx="7" fill="#5de4ff"' + s(5) + '/>'
    ),
  },
];

const EMOJI = ['🚀', '🔬', '🧪', '🧬', '🪐', '⭐', '✨', '💖', '🔥', '😎', '🤖', '🦖', '👍', '🎉', '🌈', '💡'];

export const STICKER_GROUPS: { id: string; label: string; items: StickerDef[] }[] = [
  { id: 'science', label: '과학 스티커', items: SCIENCE },
  { id: 'emoji', label: '이모지', items: EMOJI.map((char, i) => ({ id: 'emoji-' + i, label: char, kind: 'emoji' as const, char })) },
];

const ALL = new Map(STICKER_GROUPS.flatMap((g) => g.items).map((d) => [d.id, d]));
export const findSticker = (id: string) => ALL.get(id);

export const svgDataUrl = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

const cache = new Map<string, Promise<CanvasImageSource>>();

/** Loads (once) a square image for a sticker that can be drawn on a canvas. */
export function loadStickerImage(id: string): Promise<CanvasImageSource> {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = ALL.get(id);
  const promise = new Promise<CanvasImageSource>((resolve, reject) => {
    if (!def) return reject(new Error('unknown sticker ' + id));
    if (def.kind === 'emoji') {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d')!;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '200px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      ctx.fillText(def.char, 128, 140);
      return resolve(c);
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('sticker image failed ' + id));
    img.src = svgDataUrl(def.svg);
  });
  promise.catch(() => cache.delete(id));
  cache.set(id, promise);
  return promise;
}

/** Draws one sticker centred at (cx, cy) with a soft drop shadow. */
export function drawSticker(ctx: CanvasRenderingContext2D, img: CanvasImageSource, cx: number, cy: number, size: number, rot: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = size * 0.06;
  ctx.shadowOffsetY = size * 0.025;
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

