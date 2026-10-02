// Pencil-sketch renderer for the pose and composition cards shown in the studio.
// The figure is an artist's wooden drawing mannequin built from the same pose geometry as the
// model guides (scripts/pose-geometry.mjs), drawn with wobbly graphite lines on paper. Only the
// cards use this style; the guides sent to the image model stay plain black on white.

const INK = '#34323d';
const PAPER = '#fbf8f1';
const BLUE = '#3f7fe0';
const RED = '#e5484d';
const ORANGE = '#ef7d3c';

const f = (n) => Math.round(n * 10) / 10;
const rad = (d) => (d * Math.PI) / 180;
const add = (p, v) => ({ x: p.x + v.x, y: p.y + v.y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v) => Math.hypot(v.x, v.y);
const rot = (v, deg) => {
  const a = rad(deg);
  return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) };
};
const dir = (side, deg, l) => ({ x: side * Math.sin(rad(deg)) * l, y: Math.cos(rad(deg)) * l });
const line = (a, b, color = INK, w = 3, extra = '') =>
  '<path d="M' + f(a.x) + ' ' + f(a.y) + ' L' + f(b.x) + ' ' + f(b.y) + '" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" fill="none"' + extra + '/>';

// ---------- paper, pencil filters, hatching ----------
function defs(seed) {
  const hatch = (id, color, angle, gap, w, op) =>
    '<pattern id="' + id + '" width="' + gap + '" height="' + gap + '" patternUnits="userSpaceOnUse" patternTransform="rotate(' + angle + ')">' +
    '<line x1="0" y1="0" x2="0" y2="' + gap + '" stroke="' + color + '" stroke-width="' + w + '" opacity="' + op + '"/></pattern>';
  return (
    '<defs>' +
    '<filter id="wob" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.032" numOctaves="2" seed="' + seed + '" result="n"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G"/></filter>' +
    '<filter id="wob2" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="' + (seed + 11) + '" result="n"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="G" yChannelSelector="R"/></filter>' +
    '<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4"/>' +
    '<feColorMatrix values="0 0 0 0 0.22 0 0 0 0 0.2 0 0 0 0 0.16 0 0 0 0.11 0"/></filter>' +
    hatch('hb', BLUE, 40, 8, 2.2, 0.6) +
    hatch('hi', INK, -38, 7, 1.6, 0.42) +
    hatch('hd', INK, 45, 5, 2.2, 0.75) +
    hatch('hd2', INK, -45, 5, 2.2, 0.75) +
    hatch('ho', ORANGE, 30, 7, 2.2, 0.6) +
    hatch('hr', RED, 40, 7, 2, 0.5) +
    '</defs>'
  );
}

const paper = '<rect width="512" height="512" fill="' + PAPER + '"/><rect width="512" height="512" filter="url(#grain)"/>';

/** Wraps drawing in the pencil wobble plus a fainter second pass, like a re-traced sketch. */
function sketchLayer(id, inner) {
  return '<g id="' + id + '" filter="url(#wob)">' + inner + '</g><use xlink:href="#' + id + '" filter="url(#wob2)" opacity="0.3" transform="translate(1.4 1)"/>';
}

function svg(seed, body) {
  return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" width="512" height="512">' + defs(seed) + paper + body + '</svg>';
}

// ---------- mannequin ----------
function ikLimb(start, target, l1, l2, side, bend = 'out') {
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1), l1 + l2 - 1);
  const base = Math.atan2(dy, dx);
  const a = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const cands = [base + a, base - a].map((ang) => ({ x: start.x + Math.cos(ang) * l1, y: start.y + Math.sin(ang) * l1 }));
  const score = (e) => (bend === 'down' ? e.y : side * e.x);
  const elbow = score(cands[0]) >= score(cands[1]) ? cands[0] : cands[1];
  const ang = Math.atan2(target.y - elbow.y, target.x - elbow.x);
  return [start, elbow, { x: elbow.x + Math.cos(ang) * l2, y: elbow.y + Math.sin(ang) * l2 }];
}

/** Same joint layout as the model guides, so the card and the guide always agree. */
function skeleton(g) {
  const lean = g.lean ?? 0;
  const dy = g.dy ?? 0;
  const pelvis = { x: 256, y: 318 + dy };
  const bow = !!g.bow;
  const up = (v) => rot(v, lean);
  const neck = add(pelvis, up({ x: 0, y: bow ? -96 : -122 }));
  const head = add(neck, up({ x: 0, y: bow ? -40 : -68 }));
  const shoulder = (s) => add(neck, up({ x: s * 46, y: 14 }));
  const hip = (s) => add(pelvis, up({ x: s * 25, y: 0 }));
  const limb = (start, side, [a1, a2], l1, l2) => {
    const mid = add(start, dir(side, a1, l1));
    return [start, mid, add(mid, dir(side, a2, l2))];
  };
  const arm = (side, key) => {
    const target = g[key + 't'];
    if (target) return ikLimb(shoulder(side), target, 68, 60, side, g[key + 'b'] ?? 'out');
    return limb(shoulder(side), side, g[key + 'a'] ?? [12, 6], 68, 60);
  };
  return {
    lean, dy, bow, up, pelvis, neck, head,
    L: arm(-1, 'l'), R: arm(1, 'r'),
    LL: limb(hip(-1), -1, g.ll ?? [4, 0], 74, 72),
    RL: limb(hip(1), 1, g.rl ?? [4, 0], 74, 72),
  };
}

/** Tapered capsule from a (radius ra) to b (radius rb). */
function capsule(a, b, ra, rb, fill = PAPER, w = 3.2) {
  const d = sub(b, a);
  const l = len(d) || 1;
  const n = { x: -d.y / l, y: d.x / l };
  const p1 = add(a, { x: n.x * ra, y: n.y * ra });
  const p2 = add(b, { x: n.x * rb, y: n.y * rb });
  const p3 = add(b, { x: -n.x * rb, y: -n.y * rb });
  const p4 = add(a, { x: -n.x * ra, y: -n.y * ra });
  return '<path d="M' + f(p1.x) + ' ' + f(p1.y) + ' L' + f(p2.x) + ' ' + f(p2.y) + ' A' + rb + ' ' + rb + ' 0 0 0 ' + f(p3.x) + ' ' + f(p3.y) +
    ' L' + f(p4.x) + ' ' + f(p4.y) + ' A' + ra + ' ' + ra + ' 0 0 0 ' + f(p1.x) + ' ' + f(p1.y) + ' Z" fill="' + fill + '" stroke="' + INK + '" stroke-width="' + w + '" stroke-linejoin="round"/>';
}
const joint = (p, r) => '<circle cx="' + f(p.x) + '" cy="' + f(p.y) + '" r="' + r + '" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="2.6"/>';

function hand(pos, kind, pointing, scale = 1) {
  const fd = (deg, l) => ({ x: Math.sin(rad(deg)) * l * scale, y: Math.cos(rad(deg)) * l * scale });
  let out = '';
  const finger = (deg, l = 16) => {
    out += line(add(pos, fd(deg, 8)), add(pos, fd(deg, 8 + l)), INK, 3.4);
  };
  if (kind === 'none') return '';
  if (kind === 'heart') {
    const x = pos.x + 12;
    const y = pos.y - 4;
    return '<path d="M' + x + ' ' + (y + 30) + ' C' + (x - 46) + ' ' + y + ' ' + (x - 26) + ' ' + (y - 30) + ' ' + x + ' ' + (y - 10) + ' C' + (x + 26) + ' ' + (y - 30) + ' ' + (x + 46) + ' ' + y + ' ' + x + ' ' + (y + 30) + ' Z" fill="url(#hr)" stroke="' + RED + '" stroke-width="3.4" stroke-linejoin="round"/>';
  }
  if (kind === 'camera') {
    const x = pos.x + 34;
    const y = pos.y;
    return '<rect x="' + (x - 40) + '" y="' + (y - 24) + '" width="80" height="50" rx="9" fill="url(#hb)" stroke="' + INK + '" stroke-width="3.2"/>' +
      '<circle cx="' + x + '" cy="' + (y + 1) + '" r="13" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="3"/><rect x="' + (x + 14) + '" y="' + (y - 33) + '" width="18" height="10" rx="2" fill="none" stroke="' + INK + '" stroke-width="2.6"/>';
  }
  if (kind === 'ring') {
    return '<circle cx="' + f(pos.x) + '" cy="' + f(pos.y) + '" r="20" fill="none" stroke="' + INK + '" stroke-width="3.4"/><circle cx="' + f(pos.x) + '" cy="' + f(pos.y) + '" r="13" fill="none" stroke="' + INK + '" stroke-width="1.6" opacity="0.6"/>';
  }
  if (kind === 'open') [-34, -12, 12, 34].forEach((o) => finger(pointing + o, 15));
  if (kind === 'v') [-14, 14].forEach((o) => finger(pointing + o, 21));
  if (kind === 'point') finger(pointing, 23);
  if (kind === 'thumb') finger(180, 18);
  if (kind === 'ball') {
    out += '<circle cx="' + f(pos.x) + '" cy="' + f(pos.y - 30) + '" r="20" fill="url(#ho)" stroke="' + INK + '" stroke-width="3"/>' +
      '<path d="M' + f(pos.x - 20) + ' ' + f(pos.y - 30) + ' Q' + f(pos.x) + ' ' + f(pos.y - 18) + ' ' + f(pos.x + 20) + ' ' + f(pos.y - 30) + '" fill="none" stroke="' + ORANGE + '" stroke-width="2.6"/>';
  }
  out += '<circle cx="' + f(pos.x) + '" cy="' + f(pos.y) + '" r="' + f(11 * scale) + '" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="3"/>';
  return out;
}

function extras(list, s) {
  let out = '';
  const dy = s.dy;
  for (const extra of list ?? []) {
    if (extra === 'motion') for (const x of [214, 256, 298]) out += line({ x, y: 486 + dy / 3 }, { x, y: 506 + dy / 3 }, ORANGE, 4);
    if (extra === 'speed') for (const [y, l] of [[200, 60], [250, 84], [300, 52]]) out += line({ x: 120 - l, y }, { x: 120, y }, ORANGE, 4);
    if (extra === 'wave') for (const r of [34, 54]) out += '<path d="M' + (392 + r * 0.2) + ' ' + (60 - r * 0.4) + ' a' + r + ' ' + r + ' 0 0 1 ' + r * 0.6 + ' ' + r * 1.1 + '" fill="none" stroke="' + ORANGE + '" stroke-width="4" stroke-linecap="round"/>';
    if (extra === 'think') {
      out += '<circle cx="366" cy="70" r="28" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="3"/><circle cx="336" cy="112" r="9" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="2.6"/>' +
        '<path d="M356 62 Q356 48 368 48 Q380 48 380 60 Q380 68 368 72 L368 80" fill="none" stroke="' + ORANGE + '" stroke-width="4" stroke-linecap="round"/><circle cx="368" cy="90" r="2.8" fill="' + ORANGE + '"/>';
    }
    if (extra === 'zap') {
      const bolt = (x, y, k) => '<path d="M' + x + ' ' + y + ' l' + 14 * k + ' 16 l' + -10 * k + ' 4 l' + 16 * k + ' 20" fill="none" stroke="' + ORANGE + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
      out += bolt(70, 150, 1) + bolt(442, 150, -1) + bolt(90, 330, 1) + bolt(422, 330, -1);
    }
    if (extra === 'idea') {
      out += '<circle cx="392" cy="58" r="22" fill="url(#ho)" stroke="' + INK + '" stroke-width="3"/><path d="M382 80 L402 80 M384 88 L400 88" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>';
      for (const a of [-60, -30, 0, 30, 60]) {
        const p1 = add({ x: 392, y: 58 }, rot({ x: 0, y: -30 }, a));
        const p2 = add({ x: 392, y: 58 }, rot({ x: 0, y: -42 }, a));
        out += line(p1, p2, ORANGE, 3.6);
      }
    }
    if (extra === 'beam') {
      out += '<circle cx="436" cy="234" r="30" fill="url(#hb)" stroke="' + BLUE + '" stroke-width="3.4"/>';
      for (let a = 0; a < 360; a += 45) out += line(add({ x: 436, y: 234 }, rot({ x: 0, y: -38 }, a)), add({ x: 436, y: 234 }, rot({ x: 0, y: -52 }, a)), BLUE, 3.4);
    }
  }
  return out;
}

/** The mannequin in 512 space (no paper). opts.solid fills it dark (silhouette), opts.rim adds a glow outline. */
export function mannequin(g, opts = {}) {
  const s = skeleton(g);
  const fill = opts.solid ? INK : PAPER;
  const body = (inner) => inner;
  let out = '';
  if (!opts.noShadow && (s.dy ?? 0) > -10) {
    out += '<ellipse cx="256" cy="' + (486 + Math.max(0, s.dy) * 0.2) + '" rx="86" ry="11" fill="url(#hi)"/>';
  }
  // legs and feet
  for (const [leg, side] of [[s.LL, -1], [s.RL, 1]]) {
    out += capsule(leg[0], leg[1], 17, 14, fill) + capsule(leg[1], leg[2], 13, 10, fill) + joint(leg[1], 11);
    const foot = add(leg[2], { x: side * 12, y: 6 });
    out += '<ellipse cx="' + f(foot.x) + '" cy="' + f(foot.y) + '" rx="21" ry="9" fill="' + fill + '" stroke="' + INK + '" stroke-width="3"/>';
  }
  // pelvis and torso (blue pencil hatching on the chest)
  const u = (p, v) => add(p, s.up(v));
  out += '<ellipse cx="' + f(s.pelvis.x) + '" cy="' + f(s.pelvis.y + 4) + '" rx="38" ry="23" transform="rotate(' + s.lean + ' ' + f(s.pelvis.x) + ' ' + f(s.pelvis.y + 4) + ')" fill="' + fill + '" stroke="' + INK + '" stroke-width="3.2"/>';
  const sL = u(s.neck, { x: -50, y: 10 });
  const sR = u(s.neck, { x: 50, y: 10 });
  const wL = u(s.pelvis, { x: -30, y: -26 });
  const wR = u(s.pelvis, { x: 30, y: -26 });
  const c1 = u(s.neck, { x: -56, y: 50 });
  const c2 = u(s.pelvis, { x: -36, y: -60 });
  const c3 = u(s.pelvis, { x: 36, y: -60 });
  const c4 = u(s.neck, { x: 56, y: 50 });
  const top = u(s.neck, { x: 0, y: -8 });
  const torso = 'M' + f(sL.x) + ' ' + f(sL.y) + ' C' + f(c1.x) + ' ' + f(c1.y) + ' ' + f(c2.x) + ' ' + f(c2.y) + ' ' + f(wL.x) + ' ' + f(wL.y) +
    ' L' + f(wR.x) + ' ' + f(wR.y) + ' C' + f(c3.x) + ' ' + f(c3.y) + ' ' + f(c4.x) + ' ' + f(c4.y) + ' ' + f(sR.x) + ' ' + f(sR.y) +
    ' Q' + f(top.x) + ' ' + f(top.y) + ' ' + f(sL.x) + ' ' + f(sL.y) + ' Z';
  out += '<path d="' + torso + '" fill="' + fill + '" stroke="' + INK + '" stroke-width="3.4" stroke-linejoin="round"/>';
  if (!opts.solid) out += '<path d="' + torso + '" fill="url(#hb)"/>';
  const a1 = u(s.pelvis, { x: -26, y: -30 });
  const a2 = u(s.pelvis, { x: 0, y: -20 });
  const a3 = u(s.pelvis, { x: 26, y: -30 });
  out += '<path d="M' + f(a1.x) + ' ' + f(a1.y) + ' Q' + f(a2.x) + ' ' + f(a2.y) + ' ' + f(a3.x) + ' ' + f(a3.y) + '" fill="none" stroke="' + INK + '" stroke-width="2" opacity="0.6"/>';
  // neck and head with drawing guide lines
  out += capsule(s.neck, add(s.neck, s.up({ x: 0, y: -22 })), 10, 9, fill, 3);
  const hx = f(s.head.x);
  const hy = f(s.head.y);
  out += '<g transform="rotate(' + s.lean + ' ' + hx + ' ' + hy + ')">' +
    '<ellipse cx="' + hx + '" cy="' + hy + '" rx="44" ry="54" fill="' + fill + '" stroke="' + INK + '" stroke-width="3.4"/>';
  if (!opts.solid && opts.face) {
    // A light pencil face for the composition cards, where close-ups must read as a person.
    const hX = s.head.x;
    const hY = s.head.y;
    out += '<path d="M' + (hX + 12) + ' ' + (hY - 50) + ' A44 54 0 0 1 ' + (hX + 18) + ' ' + (hY + 49) + ' A40 54 0 0 0 ' + (hX + 12) + ' ' + (hY - 50) + ' Z" fill="url(#hi)"/>' +
      '<path d="M' + (hX - 28) + ' ' + (hY - 12) + ' Q' + (hX - 17) + ' ' + (hY - 18) + ' ' + (hX - 6) + ' ' + (hY - 12) + ' M' + (hX + 6) + ' ' + (hY - 12) + ' Q' + (hX + 17) + ' ' + (hY - 18) + ' ' + (hX + 28) + ' ' + (hY - 12) + '" fill="none" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"/>' +
      '<ellipse cx="' + (hX - 17) + '" cy="' + (hY + 1) + '" rx="5.5" ry="4" fill="' + INK + '"/><ellipse cx="' + (hX + 17) + '" cy="' + (hY + 1) + '" rx="5.5" ry="4" fill="' + INK + '"/>' +
      '<path d="M' + (hX + 1) + ' ' + (hY + 6) + ' L' + (hX - 4) + ' ' + (hY + 21) + ' L' + (hX + 4) + ' ' + (hY + 23) + '" fill="none" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M' + (hX - 13) + ' ' + (hY + 33) + ' Q' + hX + ' ' + (hY + 40) + ' ' + (hX + 13) + ' ' + (hY + 33) + '" fill="none" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M' + (hX - 44) + ' ' + (hY - 8) + ' Q' + (hX - 30) + ' ' + (hY - 66) + ' ' + (hX + 6) + ' ' + (hY - 56) + ' Q' + (hX + 40) + ' ' + (hY - 58) + ' ' + (hX + 44) + ' ' + (hY - 10) + '" fill="none" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/>';
  } else if (!opts.solid) {
    out += '<path d="M' + (s.head.x + 12) + ' ' + (s.head.y - 50) + ' A44 54 0 0 1 ' + (s.head.x + 18) + ' ' + (s.head.y + 49) + ' A40 54 0 0 0 ' + (s.head.x + 12) + ' ' + (s.head.y - 50) + ' Z" fill="url(#hi)"/>' +
      '<path d="M' + hx + ' ' + (s.head.y - 54) + ' Q' + (s.head.x + 9) + ' ' + hy + ' ' + hx + ' ' + (s.head.y + 54) + '" fill="none" stroke="' + INK + '" stroke-width="1.8" opacity="0.55"/>' +
      '<path d="M' + (s.head.x - 44) + ' ' + (s.head.y + 2) + ' Q' + hx + ' ' + (s.head.y + 14) + ' ' + (s.head.x + 44) + ' ' + (s.head.y + 2) + '" fill="none" stroke="' + INK + '" stroke-width="1.8" opacity="0.55"/>';
  }
  out += '</g>';
  // arms and hands
  const segAngle = (a, b) => (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
  for (const [arm, key] of [[s.L, 'l'], [s.R, 'r']]) {
    out += capsule(arm[0], arm[1], 13, 11, fill) + capsule(arm[1], arm[2], 10.5, 8.5, fill) + joint(arm[1], 9) + joint(arm[0], 12);
    out += hand(arm[2], g[key + 'h'] ?? 'fist', g[key + 'hDir'] ?? segAngle(arm[1], arm[2]), g[key + 'hScale'] ?? 1);
  }
  if (!opts.noExtras) out += extras(g.extras, s);
  if (opts.rim) {
    return '<g stroke="' + ORANGE + '" stroke-width="16" stroke-opacity="0.55" fill="none">' + out.replace(/stroke="[^"]*"/g, '').replace(/fill="url\([^)]*\)"/g, 'fill="none"') + '</g>' + body(out);
  }
  return body(out);
}

export function renderPoseSketch(g, seed = 3) {
  return svg(seed, sketchLayer('d', mannequin(g)));
}

// ---------- composition storyboards ----------
const NEUTRAL = { la: [14, 8], ra: [14, 8], lh: 'fist', rh: 'fist' };
const VIEW = { x: 104, y: 30, w: 304, h: 456 };

/** Line-art scene in figure coordinates (ground at y=486). w = stroke width divided by zoom. */
function scene(zoom, theme = {}) {
  const w = (n) => f(n / zoom);
  let out = '';
  const sky = theme.sky;
  if (sky === 'dark') out += '<rect x="-4000" y="-4000" width="8000" height="4486" fill="url(#hd)"/><rect x="-4000" y="-4000" width="8000" height="4486" fill="url(#hd2)"/>';
  if (sky === 'warm') out += '<rect x="-4000" y="-4000" width="8000" height="4486" fill="url(#ho)"/>';
  if (sky === 'blue') out += '<rect x="-4000" y="-4000" width="8000" height="4486" fill="url(#hb)"/>';
  const sun = theme.sun ?? { x: 470, y: -260, r: 70 };
  if (sun && theme.sun !== false) {
    out += '<circle cx="' + sun.x + '" cy="' + sun.y + '" r="' + sun.r + '" fill="' + (sky === 'dark' ? PAPER : 'url(#ho)') + '" stroke="' + INK + '" stroke-width="' + w(3) + '"/>';
    if (!theme.moon) for (let a = 0; a < 360; a += 45) out += line(add(sun, rot({ x: 0, y: -(sun.r + 18) }, a)), add(sun, rot({ x: 0, y: -(sun.r + 44) }, a)), ORANGE, w(3.4));
  }
  if (theme.stars) for (const [x, y] of [[-120, -420], [60, -300], [260, -460], [620, -380], [-300, -200], [420, -120], [720, -180]]) out += '<path d="M' + x + ' ' + (y - 14) + ' L' + x + ' ' + (y + 14) + ' M' + (x - 14) + ' ' + y + ' L' + (x + 14) + ' ' + y + '" stroke="' + (sky === 'dark' ? PAPER : INK) + '" stroke-width="' + w(2.6) + '" stroke-linecap="round"/>';
  if (theme.clouds !== false) {
    const cloud = (x, y) => '<path d="M' + (x - 70) + ' ' + y + ' a32 32 0 0 1 38 -32 a42 42 0 0 1 78 4 a28 28 0 0 1 30 30" fill="none" stroke="' + INK + '" stroke-width="' + w(2.6) + '" stroke-linecap="round"/>';
    out += cloud(-60, -340) + cloud(160, -120) + cloud(640, 30);
  }
  if (theme.mountains !== false) {
    out += '<path d="M300 486 L470 252 L560 332 L650 212 L870 486" fill="url(#hi)" stroke="' + INK + '" stroke-width="' + w(3) + '" stroke-linejoin="round"/>';
    out += '<path d="M-360 486 L-150 272 L70 486" fill="none" stroke="' + INK + '" stroke-width="' + w(3) + '" stroke-linejoin="round"/>';
  }
  if (theme.trees !== false) {
    const tree = (x, k) => line({ x, y: 486 }, { x, y: 486 - 120 * k }, INK, w(3)) +
      '<path d="M' + (x - 62 * k) + ' ' + (486 - 140 * k) + ' a62 ' + 58 * k + ' 0 1 1 ' + 124 * k + ' 0 a62 ' + 54 * k + ' 0 1 1 ' + -124 * k + ' 0" fill="url(#hi)" stroke="' + INK + '" stroke-width="' + w(2.8) + '"/>';
    out += tree(-40, 1.1) + tree(620, 0.9);
  }
  if (theme.ground !== false) {
    out += line({ x: -4000, y: 486 }, { x: 4000, y: 486 }, INK, w(3.2));
    for (const [x, l] of [[-200, 60], [40, 40], [380, 70], [700, 50], [-500, 50]]) out += line({ x, y: 510 }, { x: x + l, y: 510 }, INK, w(2.2), ' opacity="0.6"');
  }
  return out;
}

function viewfinder(inner, overlay = '') {
  const { x, y, w, h } = VIEW;
  let out = '<defs><clipPath id="vf"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/></clipPath></defs>';
  out += '<g clip-path="url(#vf)">' + inner + overlay + '</g>';
  out += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="none" stroke="' + INK + '" stroke-width="4"/>';
  const b = 22;
  const o = 12;
  for (const [cx, cy, sx, sy] of [[x - o, y - o, 1, 1], [x + w + o, y - o, -1, 1], [x - o, y + h + o, 1, -1], [x + w + o, y + h + o, -1, -1]]) {
    out += '<path d="M' + cx + ' ' + (cy + sy * b) + ' L' + cx + ' ' + cy + ' L' + (cx + sx * b) + ' ' + cy + '" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>';
  }
  return out;
}

/** Places the world so figure y=top sits at the top of the frame and y=bottom at the bottom. */
function framed(c, worldInner) {
  const s = VIEW.h / (c.bottom - c.top);
  const tx = VIEW.x + VIEW.w * (c.x ?? 0.5) - 256 * s;
  const ty = VIEW.y - c.top * s;
  return { s, g: '<g transform="translate(' + f(tx) + ' ' + f(ty) + ') scale(' + Math.round(s * 1000) / 1000 + ')">' + worldInner(s) + '</g>' };
}

const dashed = (a, b, color = RED, w = 3) => line(a, b, color, w, ' stroke-dasharray="10 8"');

function guides(kind) {
  const { x, y, w, h } = VIEW;
  let out = '';
  if (kind === 'thirds') {
    for (const gx of [x + w / 3, x + (2 * w) / 3]) out += dashed({ x: gx, y }, { x: gx, y: y + h });
    for (const gy of [y + h / 3, y + (2 * h) / 3]) out += dashed({ x, y: gy }, { x: x + w, y: gy });
    for (const gx of [x + w / 3, x + (2 * w) / 3]) for (const gy of [y + h / 3, y + (2 * h) / 3]) out += '<circle cx="' + f(gx) + '" cy="' + f(gy) + '" r="6" fill="' + RED + '"/>';
  }
  if (kind === 'center') {
    out += dashed({ x: x + w / 2, y }, { x: x + w / 2, y: y + h });
    out += dashed({ x, y: y + h / 2 }, { x: x + w, y: y + h / 2 });
  }
  if (kind === 'golden') {
    // golden spiral drawn as quarter arcs inside the frame
    let px = x + w;
    let py = y + h;
    let size = w;
    let d = '';
    const steps = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    let cx = x;
    let cy = y + h - w;
    let sz = w;
    let path = 'M' + f(x) + ' ' + f(y + h);
    // simple approximation: five shrinking arcs
    const pts = [[x, y + h], [x + w, y + h - w], [x + w - w * 0.382, y + h - w - w * 0.236], [x + w * 0.382, y + h - w * 0.854], [x + w * 0.528, y + h - w * 0.618], [x + w * 0.59, y + h - w * 0.7]];
    for (let i = 1; i < pts.length; i++) {
      const r = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) / Math.SQRT2;
      path += ' A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(pts[i][0]) + ' ' + f(pts[i][1]);
    }
    void px; void py; void size; void d; void steps; void cx; void cy; void sz;
    out += '<path d="' + path + '" fill="none" stroke="' + RED + '" stroke-width="3" stroke-dasharray="10 8"/>';
    out += dashed({ x: x + w * 0.382, y }, { x: x + w * 0.382, y: y + h }, RED, 2);
    out += dashed({ x, y: y + h * 0.618 }, { x: x + w, y: y + h * 0.618 }, RED, 2);
  }
  if (kind === 'diagonal') out += dashed({ x, y: y + h }, { x: x + w, y });
  if (kind === 'horizon') out += dashed({ x, y: y + h * 0.82 }, { x: x + w, y: y + h * 0.82 });
  return out;
}

function camera(cx, cy, angle, scale = 1) {
  return '<g transform="translate(' + f(cx) + ' ' + f(cy) + ') rotate(' + f(angle) + ') scale(' + scale + ')">' +
    '<rect x="-15" y="-38" width="24" height="12" rx="3" fill="none" stroke="' + INK + '" stroke-width="3"/>' +
    '<rect x="-44" y="-28" width="80" height="56" rx="10" fill="url(#hb)" stroke="' + INK + '" stroke-width="3.4"/>' +
    '<rect x="36" y="-16" width="22" height="32" rx="5" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="3.4"/>' +
    '<circle cx="-4" cy="0" r="13" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="3"/></g>';
}

function drone(cx, cy) {
  let out = '<rect x="' + (cx - 26) + '" y="' + (cy - 12) + '" width="52" height="24" rx="8" fill="url(#hb)" stroke="' + INK + '" stroke-width="3"/>';
  for (const sx of [-1, 1]) {
    out += line({ x: cx + sx * 26, y: cy - 4 }, { x: cx + sx * 52, y: cy - 16 }, INK, 3);
    out += '<ellipse cx="' + (cx + sx * 56) + '" cy="' + (cy - 20) + '" rx="26" ry="5" fill="none" stroke="' + INK + '" stroke-width="2.6"/>';
  }
  return out + '<circle cx="' + cx + '" cy="' + (cy + 16) + '" r="7" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="2.6"/>';
}

/** Side view: where the camera stands decides the angle. */
function sideView(c) {
  const ground = 440;
  const sc = c.camera === 'drone' ? 0.28 : 0.56;
  const fx = c.camera === 'drone' ? 380 : 330;
  const tx = fx - 256 * sc;
  const ty = ground - 486 * sc;
  let out = line({ x: 20, y: ground }, { x: 492, y: ground }, INK, 3.2);
  for (const [x, l] of [[60, 40], [200, 60], [380, 50]]) out += line({ x, y: ground + 22 }, { x: x + l, y: ground + 22 }, INK, 2, ' opacity="0.6"');
  out += '<g transform="translate(' + f(tx) + ' ' + f(ty) + ') scale(' + sc + ')">' + mannequin(NEUTRAL, { noShadow: true, face: true }) + '</g>';
  const headTop = { x: fx, y: ty + 70 * sc };
  const feet = { x: fx, y: ground };
  const cams = { low: { x: 120, y: 400 }, high: { x: 120, y: 92 }, eye: { x: 110, y: ty + 126 * sc }, ground: { x: fx - 70, y: ground - 26 }, top: { x: fx, y: 70 }, drone: { x: 110, y: 90 } };
  const cam = cams[c.camera];
  let target = c.camera === 'eye' ? { x: fx, y: cam.y } : { x: fx, y: (headTop.y + feet.y) / 2 };
  if (c.camera === 'ground') target = { x: fx, y: headTop.y };
  if (c.camera === 'top') target = { x: fx, y: ground };
  const angle = (Math.atan2(target.y - cam.y, target.x - cam.x) * 180) / Math.PI;
  const lensDist = c.camera === 'drone' ? 0 : 60;
  const lens = { x: cam.x + Math.cos(rad(angle)) * lensDist, y: cam.y + Math.sin(rad(angle)) * lensDist };
  const a = c.camera === 'top' ? { x: fx - 60, y: ground } : headTop;
  const b = c.camera === 'top' ? { x: fx + 60, y: ground } : feet;
  out += '<path d="M' + f(lens.x) + ' ' + f(lens.y) + ' L' + f(a.x) + ' ' + f(a.y) + ' L' + f(b.x) + ' ' + f(b.y) + ' Z" fill="url(#hr)" opacity="0.8"/>';
  out += dashed(lens, a) + dashed(lens, b);
  out += c.camera === 'drone' ? drone(cam.x, cam.y) : camera(cam.x, cam.y, angle, c.camera === 'top' || c.camera === 'ground' ? 0.8 : 1);
  return out;
}

/** Top view of a head and shoulders with the camera around it (3/4 view and profile). */
function topView(c) {
  const center = { x: 256, y: 262 };
  let out = '<ellipse cx="256" cy="262" rx="120" ry="44" fill="url(#hb)" stroke="' + INK + '" stroke-width="3.4"/>';
  out += '<circle cx="256" cy="262" r="50" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="3.4"/><path d="M240 214 L256 186 L272 214" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="3.2" stroke-linejoin="round"/>';
  out += line({ x: 256, y: 150 }, { x: 256, y: 120 }, INK, 2.4, ' opacity="0.6"');
  const angle = c.angle;
  const camPos = add(center, rot({ x: 0, y: -190 }, angle));
  out += dashed(center, add(center, rot({ x: 0, y: -150 }, 0)), INK, 2);
  out += dashed(center, camPos);
  out += '<path d="M' + f(center.x) + ' ' + (center.y - 80) + ' A80 80 0 0 1 ' + f(add(center, rot({ x: 0, y: -80 }, angle)).x) + ' ' + f(add(center, rot({ x: 0, y: -80 }, angle)).y) + '" fill="none" stroke="' + RED + '" stroke-width="3.4"/>';
  out += camera(camPos.x, camPos.y, angle + 90, 0.9);
  return out;
}

function figureWorld(c, s) {
  const pose = c.pose ?? NEUTRAL;
  return mannequin(pose, { solid: c.solid, rim: c.rim, noShadow: c.noShadow, face: true });
}

/** Extra storyboard marks drawn in frame space (over the clipped scene). */
function overlay(c) {
  const { x, y, w, h } = VIEW;
  let out = '';
  switch (c.mark) {
    case 'leading':
      for (const sx of [-1, -0.45, 0.45, 1]) out += line({ x: x + w / 2 + sx * w * 0.75, y: y + h }, { x: x + w / 2, y: y + h * 0.48 }, RED, 2.6, ' stroke-dasharray="10 8"');
      break;
    case 'arch':
      out += '<path d="M' + (x + 30) + ' ' + (y + h) + ' L' + (x + 30) + ' ' + (y + 130) + ' A' + (w / 2 - 30) + ' ' + (w / 2 - 30) + ' 0 0 1 ' + (x + w - 30) + ' ' + (y + 130) + ' L' + (x + w - 30) + ' ' + (y + h) + '" fill="none" stroke="' + INK + '" stroke-width="16"/>';
      out += '<path d="M' + (x + 30) + ' ' + (y + h) + ' L' + (x + 30) + ' ' + (y + 130) + ' A' + (w / 2 - 30) + ' ' + (w / 2 - 30) + ' 0 0 1 ' + (x + w - 30) + ' ' + (y + 130) + ' L' + (x + w - 30) + ' ' + (y + h) + '" fill="none" stroke="' + PAPER + '" stroke-width="9"/>';
      out += '<path d="M' + x + ' ' + y + ' H' + (x + 30) + ' V' + (y + h) + ' H' + x + ' Z M' + (x + w - 30) + ' ' + y + ' H' + (x + w) + ' V' + (y + h) + ' H' + (x + w - 30) + ' Z" fill="url(#hd)"/>';
      out += '<path d="M' + (x + 30) + ' ' + (y + 130) + ' A' + (w / 2 - 30) + ' ' + (w / 2 - 30) + ' 0 0 1 ' + (x + w - 30) + ' ' + (y + 130) + ' L' + (x + w) + ' ' + (y + 130) + ' L' + (x + w) + ' ' + y + ' L' + x + ' ' + y + ' L' + x + ' ' + (y + 130) + ' Z" fill="url(#hd)"/>';
      break;
    case 'foreground':
      for (const [bx, by, r] of [[x + 10, y + h - 30, 90], [x + w - 4, y + h + 10, 110], [x + w + 20, y + 120, 70]]) {
        out += '<circle cx="' + f(bx) + '" cy="' + f(by) + '" r="' + r + '" fill="url(#hd)" stroke="' + INK + '" stroke-width="4"/>';
      }
      break;
    case 'tiltshift':
      out += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h * 0.3 + '" fill="url(#hi)"/><rect x="' + x + '" y="' + (y + h * 0.72) + '" width="' + w + '" height="' + h * 0.28 + '" fill="url(#hi)"/>';
      out += dashed({ x, y: y + h * 0.3 }, { x: x + w, y: y + h * 0.3 }, BLUE, 2.4) + dashed({ x, y: y + h * 0.72 }, { x: x + w, y: y + h * 0.72 }, BLUE, 2.4);
      break;
    case 'bokeh':
      for (const [bx, by, r] of [[x + 40, y + 60, 26], [x + 110, y + 40, 18], [x + 250, y + 70, 30], [x + 270, y + 170, 20], [x + 30, y + 190, 22], [x + 200, y + 130, 14], [x + 80, y + 260, 16], [x + 285, y + 280, 24]]) {
        out += '<circle cx="' + f(bx) + '" cy="' + f(by) + '" r="' + r + '" fill="url(#ho)" stroke="' + ORANGE + '" stroke-width="2.4"/>';
      }
      break;
    case 'deepfocus':
      for (const [bx, by] of [[x + 70, y + h - 80], [x + w / 2, y + 140], [x + w - 60, y + 90]]) {
        out += '<rect x="' + (bx - 22) + '" y="' + (by - 22) + '" width="44" height="44" fill="none" stroke="' + RED + '" stroke-width="3"/>';
      }
      out += '<path d="M' + (x + 70) + ' ' + (y + h) + ' L' + (x + 70) + ' ' + (y + h - 70) + '" stroke="' + INK + '" stroke-width="4"/>';
      for (let a = 0; a < 360; a += 60) out += '<ellipse cx="' + f(x + 70 + Math.sin(rad(a)) * 16) + '" cy="' + f(y + h - 80 - Math.cos(rad(a)) * 16) + '" rx="10" ry="16" transform="rotate(' + a + ' ' + f(x + 70 + Math.sin(rad(a)) * 16) + ' ' + f(y + h - 80 - Math.cos(rad(a)) * 16) + ')" fill="url(#ho)" stroke="' + INK + '" stroke-width="2.6"/>';
      break;
    case 'soft':
      out += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + PAPER + '" opacity="0.35"/>';
      for (const r of [150, 175]) out += '<ellipse cx="' + (x + w / 2) + '" cy="' + (y + h * 0.48) + '" rx="' + r * 0.7 + '" ry="' + r * 1.25 + '" fill="none" stroke="' + ORANGE + '" stroke-width="3" stroke-dasharray="4 10" opacity="0.8"/>';
      break;
    case 'starburst': {
      const sx = x + w * 0.78;
      const sy = y + h * 0.2;
      for (let a = 0; a < 360; a += 30) out += line(add({ x: sx, y: sy }, rot({ x: 0, y: -26 }, a)), add({ x: sx, y: sy }, rot({ x: 0, y: a % 90 === 0 ? -120 : -60 }, a)), ORANGE, a % 90 === 0 ? 4 : 2.6);
      out += '<circle cx="' + sx + '" cy="' + sy + '" r="20" fill="url(#ho)" stroke="' + INK + '" stroke-width="3"/>';
      break;
    }
    case 'wide':
      for (const k of [-3, -2, -1, 0, 1, 2, 3]) out += line({ x: x + w / 2 + k * 160, y: y + h }, { x: x + w / 2 + k * 18, y: y + h * 0.66 }, INK, 2.2, ' opacity="0.55"');
      break;
    case 'fisheye':
      out += '<path d="M' + x + ' ' + (y + h * 0.95) + ' Q' + (x + w / 2) + ' ' + (y + h * 0.62) + ' ' + (x + w) + ' ' + (y + h * 0.95) + '" fill="none" stroke="' + INK + '" stroke-width="3"/>';
      out += '<path d="M' + x + ' ' + y + ' Q' + (x + w / 2) + ' ' + (y + h * 0.5) + ' ' + x + ' ' + (y + h) + ' M' + (x + w) + ' ' + y + ' Q' + (x + w / 2) + ' ' + (y + h * 0.5) + ' ' + (x + w) + ' ' + (y + h) + '" fill="none" stroke="' + BLUE + '" stroke-width="2.6" stroke-dasharray="8 8"/>';
      break;
    case 'panning':
      for (const [yy, l] of [[y + 80, 200], [y + 150, 160], [y + 240, 220], [y + 330, 180], [y + 400, 140]]) {
        out += line({ x: x + 6, y: yy }, { x: x + 6 + l * 0.4, y: yy }, BLUE, 3) + line({ x: x + w - 6 - l * 0.45, y: yy + 20 }, { x: x + w - 6, y: yy + 20 }, BLUE, 3);
      }
      break;
    case 'freeze':
      for (const [dx, dy, r] of [[60, 80, 7], [250, 60, 6], [40, 200, 5], [270, 220, 8], [100, 120, 4], [220, 150, 5], [150, 50, 6], [280, 330, 5]]) out += '<path d="M' + f(x + dx) + ' ' + f(y + dy - r * 1.6) + ' Q' + f(x + dx + r) + ' ' + f(y + dy) + ' ' + f(x + dx) + ' ' + f(y + dy + r) + ' Q' + f(x + dx - r) + ' ' + f(y + dy) + ' ' + f(x + dx) + ' ' + f(y + dy - r * 1.6) + ' Z" fill="url(#hb)" stroke="' + BLUE + '" stroke-width="2.2"/>';
      break;
    case 'trails':
      for (const k of [0, 1, 2]) out += '<path d="M' + (x - 10) + ' ' + (y + 120 + k * 40) + ' C' + (x + 80) + ' ' + (y + 20 + k * 30) + ' ' + (x + 230) + ' ' + (y + 300 - k * 20) + ' ' + (x + w + 10) + ' ' + (y + 180 + k * 45) + '" fill="none" stroke="' + (k === 1 ? BLUE : ORANGE) + '" stroke-width="5" stroke-linecap="round"/>';
      break;
    case 'spot':
      out += '<path d="M' + (x + w / 2 - 20) + ' ' + y + ' L' + (x + w / 2 + 20) + ' ' + y + ' L' + (x + w * 0.85) + ' ' + (y + h) + ' L' + (x + w * 0.15) + ' ' + (y + h) + ' Z" fill="' + PAPER + '" opacity="0.55"/>';
      break;
    case 'rembrandt':
      out += '<path d="M' + (x + 30) + ' ' + (y + 40) + ' l46 0 l-12 40 l-22 0 Z" fill="url(#ho)" stroke="' + INK + '" stroke-width="3"/>';
      out += line({ x: x + 60, y: y + 90 }, { x: x + 110, y: y + 150 }, ORANGE, 3.4, ' stroke-dasharray="8 8"');
      break;
    case 'snap':
      out += line({ x: x + w - 60, y: y + 30 }, { x: x + w - 20, y: y + 30 }, RED, 3) + '<circle cx="' + (x + w - 40) + '" cy="' + (y + 52) + '" r="8" fill="' + RED + '"/>';
      break;
    default:
      break;
  }
  return out;
}

export function renderCompositionSketch(c, seed = 5) {
  if (c.kind === 'camera') return svg(seed, sketchLayer('d', sideView(c)));
  if (c.kind === 'top') return svg(seed, sketchLayer('d', topView(c)));
  if (c.kind === 'planet') {
    let out = '<circle cx="256" cy="400" r="150" fill="url(#hi)" stroke="' + INK + '" stroke-width="3.6"/>';
    for (let a = -70; a <= 70; a += 35) {
      if (a === 0) continue;
      const base = add({ x: 256, y: 400 }, rot({ x: 0, y: -150 }, a));
      const tip = add({ x: 256, y: 400 }, rot({ x: 0, y: -200 }, a));
      out += line(base, tip, INK, 3) + '<circle cx="' + f(tip.x) + '" cy="' + f(tip.y) + '" r="18" fill="url(#hi)" stroke="' + INK + '" stroke-width="2.8"/>';
    }
    out += '<g transform="translate(' + (256 - 256 * 0.34) + ' ' + (250 - 486 * 0.34) + ') scale(0.34)">' + mannequin(NEUTRAL, { noShadow: true }) + '</g>';
    out += '<circle cx="256" cy="400" r="196" fill="none" stroke="' + RED + '" stroke-width="3" stroke-dasharray="10 8"/>';
    return svg(seed, sketchLayer('d', out));
  }
  if (c.kind === 'flatlay') {
    let out = '<rect x="56" y="40" width="400" height="432" rx="10" fill="url(#hi)" stroke="' + INK + '" stroke-width="3"/>';
    out += '<g transform="translate(256 256) rotate(-90) translate(-256 -256) translate(' + (256 - 256 * 0.78) + ' ' + (256 - 280 * 0.78) + ') scale(0.78)">' + mannequin({ la: [120, 160], ra: [120, 160], lh: 'open', rh: 'open', ll: [14, 4], rl: [14, 4] }, { noShadow: true }) + '</g>';
    for (const [x, y] of [[100, 90], [420, 110], [110, 420], [400, 430]]) out += '<path d="M' + x + ' ' + (y - 18) + ' L' + x + ' ' + (y + 18) + ' M' + (x - 18) + ' ' + y + ' L' + (x + 18) + ' ' + y + '" stroke="' + ORANGE + '" stroke-width="4" stroke-linecap="round"/>';
    out += camera(256, 18, 90, 0.6);
    return svg(seed, sketchLayer('d', out));
  }
  if (c.kind === 'forced') {
    let out = '<path d="M110 470 C120 380 150 330 196 320 L196 210 C196 190 222 190 222 210 L222 300 L232 180 C232 158 260 158 260 180 L256 300 L272 196 C274 176 300 178 298 198 L290 306 L314 228 C318 210 342 214 338 234 L320 340 C330 400 330 440 316 470 Z" fill="url(#hi)" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>';
    out += '<g transform="translate(' + (250 - 256 * 0.22) + ' ' + (322 - 486 * 0.22) + ') scale(0.22)">' + mannequin({ la: [150, 165], ra: [150, 165], lh: 'open', rh: 'open' }, { noShadow: true }) + '</g>';
    out += camera(430, 80, 130, 0.8);
    return svg(seed, sketchLayer('d', out));
  }
  if (c.kind === 'reflection') {
    const view = framed({ top: -40, bottom: 560 }, (s) => scene(s, { ground: false, trees: false }) + figureWorld(c, s));
    const mirror = '<g transform="translate(0 ' + (2 * (VIEW.y + VIEW.h * 0.62)) + ') scale(1 -1)" opacity="0.45">' + view.g + '</g>';
    const waterY = VIEW.y + VIEW.h * 0.62;
    const top = framed({ top: -40, bottom: 560 }, (s) => scene(s, { ground: false, trees: false }) + figureWorld(c, s));
    const clipTop = '<defs><clipPath id="sky"><rect x="0" y="0" width="512" height="' + f(waterY) + '"/></clipPath><clipPath id="water"><rect x="0" y="' + f(waterY) + '" width="512" height="512"/></clipPath></defs>';
    let waves = '';
    for (let k = 1; k < 6; k++) waves += line({ x: VIEW.x + 20 + k * 8, y: waterY + k * 26 }, { x: VIEW.x + VIEW.w - 40 - k * 6, y: waterY + k * 26 }, BLUE, 2.4, ' stroke-dasharray="18 10"');
    const inner = clipTop + '<g clip-path="url(#sky)">' + top.g.replace('translate(', 'translate(') + '</g><g clip-path="url(#water)">' + mirror + waves + '</g>' + line({ x: 0, y: waterY }, { x: 512, y: waterY }, INK, 3.2);
    return svg(seed, sketchLayer('d', viewfinder(inner)));
  }
  if (c.kind === 'double') {
    const view = framed({ top: 20, bottom: 470 }, (s) => '');
    void view;
    const s = VIEW.h / 450;
    const tx = VIEW.x + VIEW.w / 2 - 256 * s;
    const ty = VIEW.y - 20 * s;
    const head = '<g transform="translate(' + f(tx) + ' ' + f(ty) + ') scale(' + f(s) + ')">' + mannequin(NEUTRAL, { noShadow: true, noExtras: true }) + '</g>';
    let forest = '';
    for (let k = 0; k < 9; k++) {
      const bx = VIEW.x + 20 + k * 34;
      forest += '<path d="M' + bx + ' ' + (VIEW.y + VIEW.h) + ' L' + (bx + 17) + ' ' + (VIEW.y + 250 + (k % 3) * 30) + ' L' + (bx + 34) + ' ' + (VIEW.y + VIEW.h) + '" fill="url(#hi)" stroke="' + INK + '" stroke-width="2.6"/>';
    }
    forest += '<path d="M' + VIEW.x + ' ' + (VIEW.y + 300) + ' L' + (VIEW.x + 110) + ' ' + (VIEW.y + 200) + ' L' + (VIEW.x + 190) + ' ' + (VIEW.y + 260) + ' L' + (VIEW.x + 300) + ' ' + (VIEW.y + 170) + '" fill="none" stroke="' + BLUE + '" stroke-width="3"/>';
    return svg(seed, sketchLayer('d', viewfinder(head + '<g opacity="0.85">' + forest + '</g>')));
  }
  // framed storyboard
  const theme = c.theme ?? {};
  const v = framed(c, (s) => scene(s, theme) + figureWorld(c, s) + (c.shadow ? '<path d="M210 486 L-300 560 L-260 600 L300 500 Z" fill="url(#hd)" opacity="0.7"/>' : ''));
  let inner = v.g;
  if (c.tilt) inner = '<g transform="rotate(' + c.tilt + ' ' + (VIEW.x + VIEW.w / 2) + ' ' + (VIEW.y + VIEW.h / 2) + ')">' + inner + '</g>';
  if (c.theme?.bright) inner = '<rect x="0" y="0" width="512" height="512" fill="' + PAPER + '"/>' + '<g opacity="0.55">' + inner + '</g>';
  return svg(seed, sketchLayer('d', viewfinder(inner, overlay(c) + guides(c.guides))));
}
