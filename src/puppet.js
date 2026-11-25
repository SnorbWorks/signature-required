// Jointed stand-in characters, drawn fresh every frame with thick ink outlines.
// When real drawn poses exist, this file is what gets replaced.
import { keyGreen } from './art.js';
const INK = '#0d0a12';
export const K = 1.5;          // drawing sharpness
export const CW = 480, CH = 400, BASE = 360;   // canvas size and the feet line
export const PPU = 75;         // canvas pixels per world unit

export const STYLES = {
  hero: { skin: '#f0b98d', top: '#f2b21c', topSh: '#c98a0f', legs: '#23243b', legsSh: '#181929',
          shoe: '#c9302c', hand: '#f4efe2', hair: 'hero', bulk: 42 },
  thug: { skin: '#d9a07a', top: '#5b3a29', topSh: '#3f271b', legs: '#2a2d47', legsSh: '#1d2034',
          shoe: '#4a3524', hand: '#d9a07a', hair: 'beanie', bulk: 54 },
  goon: { skin: '#c89472', top: '#4a4f5c', topSh: '#33373f', legs: '#252838', legsSh: '#1a1c28',
          shoe: '#3a2c22', hand: '#c89472', hair: 'cap', bulk: 50 },
  worker: { skin: '#d2a07c', top: '#d9691e', topSh: '#a84c12', legs: '#27304f', legsSh: '#1b2238',
          shoe: '#3a2c22', hand: '#d2a07c', hair: 'hat', hat: '#f2c21c', bulk: 52 },
  // stand-ins until their pose sheets are drawn
  tax1: { skin: '#d6a37e', top: '#3f7a4a', topSh: '#2b5633', legs: '#2b2b33', legsSh: '#1d1d24', shoe: '#e8e2d0', hand: '#d6a37e', hair: 'cap', bulk: 44 },
  tax2: { skin: '#b9825f', top: '#b3312c', topSh: '#7f211e', legs: '#1f2638', legsSh: '#151a28', shoe: '#2a2018', hand: '#b9825f', hair: 'beanie', bulk: 50 },
  corner1: { skin: '#c99672', top: '#6a3f8f', topSh: '#492a64', legs: '#2c2c36', legsSh: '#1e1e26', shoe: '#3a2c22', hand: '#c99672', hair: 'beanie', bulk: 56 },
  corner2: { skin: '#e0b08c', top: '#4a6f9c', topSh: '#334d6e', legs: '#30303a', legsSh: '#212129', shoe: '#c9302c', hand: '#e0b08c', hair: 'cap', bulk: 44 },
  brick: { skin: '#c08a68', top: '#1c1c22', topSh: '#101015', legs: '#26262e', legsSh: '#18181f', shoe: '#15151a', hand: '#c08a68', hair: 'beanie', bulk: 70 },
  clerk: { skin: '#e0b592', top: '#e8e4d8', topSh: '#b9b4a6', legs: '#55565e', legsSh: '#3c3d44', shoe: '#4a3324', hand: '#e0b592', hair: 'cap', bulk: 46 },
  keeper: { skin: '#d9a982', top: '#3e8f8a', topSh: '#2a6460', legs: '#3a3327', legsSh: '#28231b', shoe: '#2a2018', hand: '#d9a982', hair: 'cap', bulk: 52 },
  gage: { skin: '#c98f6d', top: '#2f3f4f', topSh: '#1f2a36', legs: '#22222c', legsSh: '#16161d',
          shoe: '#2a2018', hand: '#c98f6d', hair: 'hat', hat: '#e8e2d0', bulk: 64 },
};

// Angles: limbs measure from straight down, positive = forward. Torso from straight up.
const P = {
  relax:  { lean: .03, head: 0,   aN: [.1, .18],   aF: [-.1, .18], lN: [.1, .08],  lF: [-.12, .1],  fall: 0 },
  stance: { lean: .14, head: 0,   aN: [.5, 1.9],   aF: [.95, 1.55], lN: [.4, .38],  lF: [-.34, .3],  fall: 0 },
  jump:   { lean: .1,  head: 0,   aN: [-.7, 1.0],  aF: [1.3, .9],  lN: [.95, 1.3], lF: [.05, 1.15], fall: 0 },
  wind:   { lean: -.1, head: 0,   aN: [-.8, 2.0],  aF: [.9, 1.5],  lN: [.3, .32],  lF: [-.36, .34], fall: 0 },
  hit:    { lean: .34, head: .05, aN: [1.52, .04], aF: [-.4, 1.7], lN: [.72, .55], lF: [-.62, .12], fall: 0 },
  hurt:   { lean: -.42, head: -.35, aN: [-.8, .5], aF: [-.3, .7],  lN: [.3, .2],   lF: [-.42, .45], fall: 0 },
  down:   { lean: 0,   head: .1,  aN: [-3.25, -.2], aF: [1.0, .3], lN: [.06, .05], lF: [-.12, .25], fall: 1 },
};

export function poseFor(c, t) {
  switch (c.state) {
    case 'walk': {
      const s = Math.sin(c.phase), k = Math.cos(c.phase);
      return [{ lean: .1, head: 0, aN: [-.55 * s, .5], aF: [.55 * s, .5],
        lN: [.62 * s, .12 + .75 * Math.max(0, k)], lF: [-.62 * s, .12 + .75 * Math.max(0, -k)], fall: 0 }, 22];
    }
    case 'jump': return [P.jump, 18];
    case 'punch': return c.st < .07 ? [P.wind, 40] : c.st < .22 ? [P.hit, 45] : [P.stance, 16];
    case 'wind': return [P.wind, 14];
    case 'strike': return [P.hit, 45];
    case 'hurt': return [P.hurt, 32];
    case 'down': return [P.down, 11];
    default: {
      const b = c.relaxed ? P.relax : P.stance, br = Math.sin(t * 2.6 + c.x) * .02;
      return [{ ...b, lean: b.lean + br, aN: [b.aN[0], b.aN[1] + br * 2] }, 12];
    }
  }
}

export function lerpPose(a, b, k) {
  const m = (x, y) => x + (y - x) * k, m2 = (x, y) => [m(x[0], y[0]), m(x[1], y[1])];
  return { lean: m(a.lean, b.lean), head: m(a.head, b.head), fall: m(a.fall, b.fall),
    aN: m2(a.aN, b.aN), aF: m2(a.aF, b.aF), lN: m2(a.lN, b.lN), lF: m2(a.lF, b.lF) };
}

export class Puppet {
  constructor(style) {
    this.style = style;
    this.c = document.createElement('canvas');
    this.c.width = CW * K; this.c.height = CH * K;
    this.g = this.c.getContext('2d');
  }

  // Returns true when the picture changed (so the game knows to refresh it).
  draw(p, opt = {}) {
    const g = this.g, st = this.style;
    if (this.sprites) {
      const f = this.sprites[opt.frame] || this.sprites.stance || this.sprites.idle, key = opt.frame + (opt.air ? 'a' : 'g');
      if (key === this.last) return false;
      this.last = key;
      g.setTransform(K, 0, 0, K, 0, 0); g.clearRect(0, 0, CW, CH);
      if (!opt.air) { g.fillStyle = 'rgba(5,5,20,.4)'; g.beginPath(); g.ellipse(CW / 2, BASE + 2, Math.max(50, f.w * .42), 8, 0, 0, 7); g.fill(); }
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(f.c, 0, 0);
      return true;
    }
    g.setTransform(K, 0, 0, K, 0, 0);
    g.clearRect(0, 0, CW, CH);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const f = (p.fall || 0) * Math.PI / 2;
    const UL = 62, LL = 62, T = 84, UA = 46, LA = 44, R = 29;

    const leg = q => { const a = q[0] + f, b = a - q[1];
      return { a, b, kx: UL * Math.sin(a), ky: UL * Math.cos(a),
        fx: UL * Math.sin(a) + LL * Math.sin(b), fy: UL * Math.cos(a) + LL * Math.cos(b) }; };
    const n = leg(p.lN), fr = leg(p.lF);
    const drop = Math.max(n.fy, fr.fy, 16);
    const hx = CW / 2, hy = BASE - drop - 9;
    const t = p.lean - f;
    const nx = hx + T * Math.sin(t), ny = hy - T * Math.cos(t);
    const sx = hx + (T - 12) * Math.sin(t), sy = hy - (T - 12) * Math.cos(t);
    const ha = t + (p.head || 0);
    const cx = nx + (R + 2) * Math.sin(ha), cy = ny - (R + 2) * Math.cos(ha);
    const arm = q => { const a = q[0] + f, b = a + q[1];
      const ex = sx + UA * Math.sin(a), ey = sy + UA * Math.cos(a);
      return { ex, ey, wx: ex + LA * Math.sin(b), wy: ey + LA * Math.cos(b) }; };
    const an = arm(p.aN), af = arm(p.aF);

    const seg = (pts, w, col) => {
      g.beginPath(); g.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.strokeStyle = INK; g.lineWidth = w + 7; g.stroke();
      g.strokeStyle = col; g.lineWidth = w; g.stroke();
    };
    const dot = (x, y, r, col) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = col; g.fill();
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke(); };
    const drawLeg = (L, col) => {
      seg([hx, hy, hx + L.kx, hy + L.ky, hx + L.fx, hy + L.fy], 24, col);
      const dx = Math.cos(L.b), dy = -Math.sin(L.b);
      seg([hx + L.fx - dx * 4, hy + L.fy - dy * 4 + 2, hx + L.fx + dx * 20, hy + L.fy + dy * 20 + 2], 15, st.shoe);
    };
    const drawArm = (A, col) => { seg([sx, sy, A.ex, A.ey, A.wx, A.wy], 20, col); dot(A.wx, A.wy, 12, st.hand); };

    if (!opt.air) {   // contact shadow on the wet ground
      g.fillStyle = 'rgba(5,5,20,.4)'; g.beginPath();
      g.ellipse(hx + (p.fall || 0) * 10, BASE + 3, 56 + (p.fall || 0) * 70, 8, 0, 0, 7); g.fill();
    }
    drawArm(af, st.topSh);
    drawLeg(fr, st.legsSh);
    drawLeg(n, st.legs);

    // torso, with a band of shadow down the back
    const tx = Math.sin(t), ty = -Math.cos(t), fx = Math.cos(t), fy = Math.sin(t);
    seg([hx, hy - 2, hx + (T - 14) * tx, hy + (T - 14) * ty], st.bulk, st.top);
    g.strokeStyle = st.topSh; g.lineWidth = st.bulk * .3; g.beginPath();
    g.moveTo(hx - fx * st.bulk * .3, hy - 2 - fy * st.bulk * .3);
    g.lineTo(hx + (T - 16) * tx - fx * st.bulk * .3, hy + (T - 16) * ty - fy * st.bulk * .3); g.stroke();
    if (st.hair === 'hero') dot(nx - fx * 15 - tx * 6, ny - fy * 15 - ty * 6, 15, st.top);   // hood

    // head
    g.save(); g.translate(cx, cy); g.rotate(ha);
    g.beginPath(); g.moveTo(R - 3, -3); g.lineTo(R + 6, 4); g.lineTo(R - 3, 8);
    g.fillStyle = st.skin; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.arc(0, 0, R, 0, 7); g.fillStyle = st.skin; g.fill(); g.stroke();
    g.fillStyle = INK; g.strokeStyle = INK;
    if (st.hair === 'cap') g.fillRect(3, -10, 26, 10);
    else if (opt.hurt) { g.lineWidth = 3; g.beginPath(); g.moveTo(8, -7); g.lineTo(18, -1); g.moveTo(18, -7); g.lineTo(8, -1); g.stroke(); }
    else { g.beginPath(); g.ellipse(13, -3, 3.2, 4.8, 0, 0, 7); g.fill(); }
    g.lineWidth = 3.5; g.beginPath(); g.moveTo(4, -15); g.lineTo(22, -10); g.stroke();
    g.lineWidth = 3; g.beginPath();
    if (opt.hurt) g.ellipse(15, 14, 5, 6, 0, 0, 7); else { g.moveTo(11, 14); g.lineTo(23, 13); }
    g.stroke();
    if (st.hair === 'hero') {
      const h = [-29, 12, -39, -4, -30, -10, -41, -25, -25, -26, -27, -43, -9, -34, 0, -49, 10, -35, 25, -41, 22, -25, 33, -19, 20, -13, 4, -17, -10, -8, -14, 8];
      g.beginPath(); g.moveTo(h[0], h[1]); for (let i = 2; i < h.length; i += 2) g.lineTo(h[i], h[i + 1]); g.closePath();
      g.fillStyle = '#6b3b1d'; g.fill(); g.lineWidth = 3.5; g.stroke();
    } else if (st.hair === 'beanie') {
      g.beginPath(); g.arc(0, -4, R + 3, Math.PI * 1.02, Math.PI * 1.98); g.closePath();
      g.fillStyle = '#2b2b36'; g.fill(); g.lineWidth = 3.5; g.stroke();
      g.fillStyle = '#44445a'; g.fillRect(-R - 4, -11, R * 2 + 8, 9); g.strokeRect(-R - 4, -11, R * 2 + 8, 9);
    } else {
      g.beginPath(); g.arc(0, -6, R + 2, Math.PI, Math.PI * 2); g.closePath();
      g.fillStyle = st.hat || '#1f2430'; g.fill(); g.lineWidth = 3.5; g.stroke();
      g.lineWidth = 8; g.beginPath(); g.moveTo(R - 2, -8); g.lineTo(R + 20, -5); g.stroke();
    }
    g.restore();

    drawArm(an, st.top);
    return true;
  }
}

// Which drawn pose to show for what the character is doing.
export function frameFor(c) {
  switch (c.state) {
    case 'walk': { const cy = c.pup.cycle; if (cy) return cy[Math.floor(c.phase / (Math.PI * 2) * cy.length) % cy.length];
      return Math.floor(c.phase / Math.PI) % 2 ? 'walkB' : 'walkA'; }
    case 'jump': return 'jump';
    case 'block': case 'dodge': return 'stance';
    case 'punch': return c.st > .06 && c.st < .25 ? 'punch' : 'stance';
    case 'wind': return 'stance';
    case 'strike': return 'punch';
    case 'hurt': return 'hurt';
    case 'down': return c.grounded ? 'down' : 'hurt';
    default: return c.relaxed ? 'idle' : 'stance';
  }
}

// Cuts a green-screen pose sheet (2 rows of poses) into separate frames,
// all at one scale, each standing on the same feet line.
export function sliceSprites(img, cfg) {
  const src = keyGreen(img, true), W = src.width, H = src.height, a = src.getContext('2d').getImageData(0, 0, W, H).data;
  const q = 2, mw = W / q | 0, mh = H / q | 0, mask = new Uint8Array(mw * mh), lab = new Int32Array(mw * mh);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) mask[y * mw + x] = a[(y * q * W + x * q) * 4 + 3] > 60 ? 1 : 0;
  const comps = [], stack = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || lab[i]) continue;
    const c = { x0: mw, y0: mh, x1: 0, y1: 0, n: 0 }, id = comps.length + 1; lab[i] = id; stack.push(i);
    while (stack.length) { const j = stack.pop(), x = j % mw, y = j / mw | 0; c.n++;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (const k of [j - 1, j + 1, j - mw, j + mw]) { if (k < 0 || k >= mask.length || !mask[k] || lab[k]) continue;
        if ((k === j - 1 && x === 0) || (k === j + 1 && x === mw - 1)) continue; lab[k] = id; stack.push(k); } }
    c.id = id; comps.push(c);
  }
  comps.sort((p, r) => r.n - p.n);
  const big = comps.filter(c => c.n > comps[0].n * .2).slice(0, cfg.frames.length);
  const row = c => (c.y0 + c.y1) / 2 < mh / 2 ? 0 : 1;
  big.sort((p, r) => row(p) - row(r) || p.x0 - r.x0);
  const scale = cfg.height / ((big[0].y1 - big[0].y0 + 1) * q), out = {};
  big.forEach((c, i) => {
    const name = cfg.frames[i]; if (!name) return;
    // where the feet are: the middle of the lowest slice of the pose
    let fx0 = mw, fx1 = 0; const cut = c.y1 - (c.y1 - c.y0) * .12;
    for (let y = Math.floor(cut); y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) if (lab[y * mw + x] === c.id) { if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; }
    if (cfg.anchor === 'head') { fx0 = mw; fx1 = 0; const top = c.y0 + (c.y1 - c.y0) * .2;   // steadier for walking: line up the heads
      for (let y = c.y0; y <= top; y++) for (let x = c.x0; x <= c.x1; x++) if (lab[y * mw + x] === c.id) { if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; } }
    const feet = (fx0 + fx1) / 2 * q, sx = c.x0 * q - 2, sy = c.y0 * q - 2, sw = (c.x1 - c.x0 + 1) * q + 4, sh = (c.y1 - c.y0 + 1) * q + 4;
    const cv = document.createElement('canvas'); cv.width = CW * K; cv.height = CH * K; const g = cv.getContext('2d');
    const s = scale * K, flip = name === 'down';
    g.translate(CW / 2 * K, (BASE + 5) * K); if (flip) g.scale(-1, 1);
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, sx, sy, sw, sh, (sx - feet) * s, -sh * s, sw * s, sh * s);
    out[name] = { c: cv, w: sw * scale };
  });
  return out;
}
