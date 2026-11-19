// Stand-in background art, drawn by code. Each panel is a stack of layers at
// different distances behind the frame, which is what makes the depth shift.
// Everything is laid out in "panel units": x from 0 at the panel's left edge,
// y from 0 at its bottom edge, as seen straight on.
export const INK = '#0d0a12';
export const DREF = 20;
const WIN = ['#ffd76a', '#ffb14a', '#ffd76a', '#ff6fb1', '#6fe3ff'];

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function mk(w, h) { const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return [c, c.getContext('2d')]; }

export function blurred(src, r) {
  const k = 4, [c, g] = mk(src.width / k, src.height / k);
  if ('filter' in g) { g.filter = `blur(${(r / k).toFixed(1)}px)`; g.drawImage(src, 0, 0, c.width, c.height); }
  else { const [s, sg] = mk(c.width / 3, c.height / 3); sg.drawImage(src, 0, 0, s.width, s.height);
    g.imageSmoothingQuality = 'high'; g.drawImage(s, 0, 0, c.width, c.height); }
  return c;
}

function layerCtx(w, h, d, ppu, band) {
  const s = 1 + d / DREF, pad = d * .9 + .8, PW = w * s + pad;
  let top = h * s / 2 + pad / 2, bot = -top;
  if (band) { top = (band[1] - h / 2) * s; bot = Math.max(bot, (band[0] - h / 2) * s - pad / 2); }
  const PH = top - bot; let k = ppu; if (PW * k > 2048) k = 2048 / PW;
  const [c, g] = mk(PW * k, PH * k);
  return { c, g, W: c.width, H: c.height, w, h, d, k: s * k,
    X: u => c.width / 2 + (u - w / 2) * s * k, Y: u => (top - (u - h / 2) * s) * k, S: l => l * s * k,
    plane: { w: PW, h: PH, cy: (top + bot) / 2 } };
}

function halftone(g, W, H, sp, r, color) {
  g.fillStyle = color; g.beginPath();
  for (let j = 0, y = 0; y < H + sp; y += sp * .5, j++)
    for (let x = (j % 2) * sp * .5; x < W + sp; x += sp) { g.moveTo(x + r, y); g.arc(x, y, r, 0, 7); }
  g.fill();
}
function glow(g, x, y, r, color) { g.save(); g.shadowColor = color; g.shadowBlur = r * 5; g.fillStyle = color;
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fill(); g.restore(); }
function light(g, x, y, r, rgb, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }

function drawSky(m, o) {
  const { g, W, H } = m, r = rng(o.seed || 1);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, o.top || '#090d2b'); gr.addColorStop(.55, o.mid || '#222b6a'); gr.addColorStop(1, o.bot || '#5a4294');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (o.moon) { const x = m.X(o.moon[0]), y = m.Y(o.moon[1]), R = m.S(o.moon[2]);
    light(g, x, y, R * 3.2, '200,210,255', .35);
    g.fillStyle = '#efe9d2'; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
    g.strokeStyle = INK; g.lineWidth = Math.max(1.5, m.S(.05)); g.stroke();
    g.fillStyle = '#cfc8ae'; for (const [a, b, c] of [[-.3, -.2, .22], [.25, .3, .16], [.1, -.45, .12], [-.45, .35, .1]]) {
      g.beginPath(); g.arc(x + a * R, y + b * R, c * R, 0, 7); g.fill(); } }
  for (let i = 0; i < (o.clouds ?? 5); i++) { const cx = r() * W, cy = H * (.08 + r() * .45), cw = m.S(2.5 + r() * 3), ch = m.S(.5 + r() * .4);
    const lw = Math.max(1.5, m.S(.05)), pts = [];
    for (let j = 0; j < 6; j++) { const u = j / 5; pts.push([cx + (u - .5) * cw, cy - Math.sin(u * Math.PI) * ch * .4, ch * (.4 + .35 * Math.sin(u * Math.PI))]); }
    g.fillStyle = INK; for (const p of pts) { g.beginPath(); g.arc(p[0], p[1], p[2] + lw, 0, 7); g.fill(); }
    g.fillStyle = o.cloud || '#2c3577'; for (const p of pts) { g.beginPath(); g.arc(p[0], p[1], p[2], 0, 7); g.fill(); } }
  halftone(g, W, H, Math.max(5, m.S(.13)), Math.max(1, m.S(.03)), 'rgba(140,160,255,.17)');
}

function drawSkyline(m, o) {
  const { g, W, H } = m, r = rng(o.seed), lw = Math.max(1.5, m.S(.05));
  let x = -m.S(1);
  while (x < W + m.S(1)) {
    const bw = m.S(.9 + r() * 1.7), top = m.Y(o.minH + (o.maxH - o.minH) * r());
    g.fillStyle = o.color; g.fillRect(x, top, bw, H - top + 4);
    g.strokeStyle = INK; g.lineWidth = lw; g.strokeRect(x, top, bw, H - top + 20);
    const cw = m.S(.3), ch = m.S(.36);
    for (let wy = top + ch * .6; wy < H; wy += ch) for (let wx = x + cw * .5; wx < x + bw - cw * .8; wx += cw) {
      const q = r(); if (q < (o.lit ?? .28)) { g.fillStyle = WIN[(r() * WIN.length) | 0]; g.fillRect(wx, wy, cw * .55, ch * .5); }
      else if (q < .6) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(wx, wy, cw * .55, ch * .5); } }
    if (r() < .3) { g.beginPath(); g.moveTo(x + bw * .5, top); g.lineTo(x + bw * .5, top - m.S(.7)); g.stroke(); }
    if (r() < (o.neon || 0)) { const c = r() < .5 ? '#ff4fa3' : '#4fe0ff';
      g.save(); g.shadowColor = c; g.shadowBlur = m.S(.4); g.fillStyle = c; g.fillRect(x + bw * .12, top + m.S(.4), m.S(.4), m.S(1.7)); g.restore(); }
    x += bw + (r() < .2 ? m.S(.3) : 0);
  }
}

function fence(m, ux0, ux1, top) {
  const { g, X, Y, S, H } = m, x0 = X(ux0), x1 = Math.min(X(ux1), m.W + 10), y = Y(top), hh = H - y;
  g.save(); g.beginPath(); g.rect(x0, y, x1 - x0, hh); g.clip();
  g.strokeStyle = 'rgba(150,165,220,.34)'; g.lineWidth = Math.max(1, S(.02)); g.beginPath();
  for (let x = x0 - hh, sp = S(.24); x < x1; x += sp) { g.moveTo(x, y); g.lineTo(x + hh, H); g.moveTo(x + hh, y); g.lineTo(x, H); }
  g.stroke(); g.restore();
  g.strokeStyle = INK; g.lineWidth = S(.09); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y);
  for (let u = ux0; X(u) <= x1; u += 2.3) { g.moveTo(X(u), y - S(.15)); g.lineTo(X(u), H); }
  g.stroke();
}
function lamp(m, ux, uy, fromUx) {
  const { g, X, Y, S } = m, x = X(ux), y = Y(uy);
  g.strokeStyle = INK; g.lineWidth = S(.09); g.beginPath(); g.moveTo(X(fromUx), y - S(.25)); g.lineTo(x, y - S(.25)); g.lineTo(x, y); g.stroke();
  g.fillStyle = '#2a2a3a'; g.beginPath(); g.moveTo(x - S(.45), y + S(.3)); g.lineTo(x - S(.2), y); g.lineTo(x + S(.2), y); g.lineTo(x + S(.45), y + S(.3)); g.closePath(); g.fill();
  g.lineWidth = S(.06); g.stroke();
  glow(g, x, y + S(.36), S(.14), '#ffd98a');
}

function drawHarbor(m) {
  const { g, W, H, X, Y, S } = m, r = rng(77);
  g.fillStyle = '#0d1338'; g.fillRect(0, Y(2.3), W, H);
  g.fillStyle = '#27307a'; for (let i = 0; i < 70; i++) g.fillRect(r() * W, Y(2.3) + r() * (H - Y(2.3)), S(.2 + r() * .6), S(.04));
  const crane = (ux, uh, dir) => { g.strokeStyle = '#0a0d2a'; g.lineWidth = S(.1); g.lineJoin = 'round';
    const x = X(ux), b = Y(2.3), t = Y(uh), tw = S(.5); g.beginPath();
    g.moveTo(x - tw / 2, b); g.lineTo(x - tw / 2, t); g.moveTo(x + tw / 2, b); g.lineTo(x + tw / 2, t);
    for (let y = b, i = 0; y > t; y -= tw, i++) { g.moveTo(x + (i % 2 ? -1 : 1) * tw / 2, y); g.lineTo(x + (i % 2 ? 1 : -1) * tw / 2, y - tw); }
    g.moveTo(x - dir * S(1), t + S(.2)); g.lineTo(x + dir * S(3.2), t - S(1.3)); g.lineTo(x, t - S(.9)); g.lineTo(x - dir * S(1), t + S(.2));
    g.moveTo(x, t); g.lineTo(x, t - S(.9)); g.moveTo(x + dir * S(2.4), t - S(1.0)); g.lineTo(x + dir * S(2.4), t + S(1.2)); g.stroke();
    glow(g, x, t - S(.9), S(.1), '#ff3b3b'); };
  crane(5.6, 6.3, 1); crane(12.0, 7.3, -1); crane(19.5, 6.6, -1);
  const box = (a, b, c, d, col) => { g.fillStyle = col; g.fillRect(X(a), Y(d), X(c) - X(a), Y(b) - Y(d));
    g.strokeStyle = INK; g.lineWidth = S(.07); g.strokeRect(X(a), Y(d), X(c) - X(a), Y(b) - Y(d)); };
  const wins = (a, c, uy) => { for (let u = a + .3; u < c - .3; u += .55) { g.fillStyle = r() < .75 ? '#ffd76a' : '#2b3470'; g.fillRect(X(u), Y(uy), S(.3), S(.26)); } };
  g.strokeStyle = INK; g.lineWidth = S(.07);
  g.beginPath(); g.moveTo(X(13.6), Y(6.6)); g.lineTo(X(13.6), Y(8.0)); g.moveTo(X(17), Y(5)); g.lineTo(X(17), Y(6.9)); g.stroke();
  glow(g, X(13.6), Y(8.0), S(.09), '#ff3b3b'); glow(g, X(17), Y(6.9), S(.09), '#ff3b3b');
  box(15, 5.9, 15.8, 7.0, '#7a2a2a'); box(12.6, 5.9, 14.6, 6.6, '#222a63'); wins(12.6, 14.6, 6.45);
  box(11.6, 5.0, 16.2, 5.9, '#1e2559'); wins(11.6, 16.2, 5.65); box(10.6, 3.9, 17.6, 5.0, '#1b2254'); wins(10.6, 17.6, 4.7); wins(10.6, 17.6, 4.3);
  g.beginPath(); g.moveTo(X(8.2), Y(3.9)); g.lineTo(X(9.5), Y(2.25)); g.lineTo(X(26), Y(2.25)); g.lineTo(X(26), Y(3.9)); g.closePath();
  g.fillStyle = '#141a45'; g.fill(); g.stroke();
  g.fillStyle = '#8a2b2b'; g.fillRect(X(9.3), Y(2.75), X(26) - X(9.3), S(.16));
}

function drawDockWall(m) {
  const { g, W, H, X, Y, S } = m;
  fence(m, 3.2, 60, 3.3);
  const x0 = X(-8), x1 = X(3.2), y = Y(5.3);
  g.fillStyle = '#a5321f'; g.fillRect(x0, y, x1 - x0, H - y);
  g.strokeStyle = '#7e2417'; g.lineWidth = S(.06); g.beginPath();
  for (let u = -8; u < 3.2; u += .34) { g.moveTo(X(u), y + S(.2)); g.lineTo(X(u), H); } g.stroke();
  g.fillStyle = 'rgba(20,5,30,.35)'; g.fillRect(x0, y, x1 - x0, S(.5));
  light(g, X(4.1), Y(5.4), S(3.6), '255,180,90', .55);
  g.strokeStyle = INK; g.lineWidth = S(.08); g.strokeRect(x0, y, x1 - x0, H - y + 20);
  g.fillStyle = 'rgba(236,222,200,.82)'; g.font = `900 ${S(1.5)}px "Arial Black",Impact,sans-serif`; g.fillText('D-17', X(-.3), Y(2.4));
  lamp(m, 4.1, 6.3, 3.2);
  halftone(g, X(3.2), H, Math.max(5, S(.12)), Math.max(1, S(.028)), 'rgba(30,5,20,.25)');
}

function drawAlleyWall(m) {
  const { g, W, H, X, Y, S } = m, r = rng(5);
  fence(m, 8.3, 60, 3.3);
  const x1 = X(8.3);
  g.fillStyle = '#5a2f3e'; g.fillRect(0, 0, x1, H);
  g.strokeStyle = '#3b1c2b'; g.lineWidth = Math.max(1, S(.03)); g.beginPath();
  for (let y = 0, j = 0, bh = S(.3), bw = S(.75); y < H; y += bh, j++) { g.moveTo(0, y); g.lineTo(x1, y);
    for (let x = (j % 2) * bw * .5; x < x1; x += bw) if (r() < .8) { g.moveTo(x, y); g.lineTo(x, y + bh); } }
  g.stroke();
  light(g, X(5.0), Y(5.6), S(3.8), '255,170,80', .6);
  g.fillStyle = '#2d2440'; g.fillRect(X(1.6), Y(4.6), S(2.3), H); g.strokeStyle = INK; g.lineWidth = S(.08); g.strokeRect(X(1.6), Y(4.6), S(2.3), H);
  g.lineWidth = S(.05); g.strokeRect(X(1.9), Y(4.2), S(1.7), S(1.4)); g.strokeRect(X(1.9), Y(2.5), S(1.7), S(1.6));
  g.fillStyle = 'rgba(236,222,200,.8)'; g.font = `900 ${S(1.9)}px "Arial Black",Impact,sans-serif`; g.fillText('27', X(5.3), Y(2.6));
  g.strokeStyle = INK; g.lineWidth = S(.16); g.beginPath(); g.moveTo(X(7.8), 0); g.lineTo(X(7.8), H); g.stroke();
  g.strokeStyle = '#4a5a6e'; g.lineWidth = S(.09); g.stroke();
  g.strokeStyle = INK; g.lineWidth = S(.09); g.beginPath(); g.moveTo(x1, 0); g.lineTo(x1, H); g.stroke();
  lamp(m, 5.0, 6.6, 4.0);
  halftone(g, x1, H, Math.max(5, S(.12)), Math.max(1, S(.028)), 'rgba(25,5,25,.28)');
}

function drawGround(m, o) {
  const { g, W, H, X, Y, S, w } = m, r = rng(o.seed || 9);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a3070'); gr.addColorStop(1, '#0e1130');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(8,8,30,.75)'; g.lineWidth = Math.max(1, S(.035)); g.beginPath();
  for (const u of [1.55, .85, .05, -.9]) { g.moveTo(0, Y(u)); g.lineTo(W, Y(u)); }
  for (let u = -8; u < w + 8; u += 2.2) { g.moveTo(X(u), 0); g.lineTo(X(u + (u - w / 2) * .3), H); }
  g.stroke();
  for (const [ux, rgb] of o.lights) { const x = X(ux), gg = g.createLinearGradient(0, 0, 0, H);
    gg.addColorStop(0, `rgba(${rgb},.6)`); gg.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gg; g.fillRect(x - S(.55), 0, S(1.1), H);
    g.fillStyle = `rgba(${rgb},.65)`; for (let i = 0; i < 16; i++) g.fillRect(x + (r() - .5) * S(2), r() * H, S(.2 + r() * .5), Math.max(1.5, S(.05))); }
  g.fillStyle = 'rgba(220,230,255,.5)'; for (let i = 0; i < 60; i++) g.fillRect(r() * W, r() * H, S(.1 + r() * .3), Math.max(1, S(.03)));
  halftone(g, W, H, Math.max(5, S(.12)), Math.max(1, S(.028)), 'rgba(5,5,30,.3)');
  g.fillStyle = '#4a55a8'; g.fillRect(0, 0, W, S(.11)); g.fillStyle = INK; g.fillRect(0, 0, W, S(.06));
}

function crate(m, ux, uy, sz) { const { g, X, Y, S } = m, x = X(ux), y = Y(uy + sz), s = S(sz);
  g.fillStyle = '#8b5a2b'; g.fillRect(x, y, s, s); g.fillStyle = 'rgba(30,10,30,.3)'; g.fillRect(x, y + s * .5, s, s * .5);
  g.strokeStyle = INK; g.lineWidth = S(.08); g.strokeRect(x, y, s, s); g.lineWidth = S(.05); g.strokeRect(x + s * .13, y + s * .13, s * .74, s * .74);
  g.beginPath(); g.moveTo(x + s * .13, y + s * .13); g.lineTo(x + s * .87, y + s * .87); g.moveTo(x + s * .87, y + s * .13); g.lineTo(x + s * .13, y + s * .87); g.stroke(); }
function barrel(m, ux, uy) { const { g, X, Y, S } = m, x = X(ux), y = Y(uy + 1.5), bw = S(1.05), bh = S(1.5);
  g.fillStyle = '#3d5a6e'; g.fillRect(x, y, bw, bh); g.fillStyle = 'rgba(10,10,40,.35)'; g.fillRect(x + bw * .6, y, bw * .4, bh);
  g.strokeStyle = INK; g.lineWidth = S(.08); g.strokeRect(x, y, bw, bh); g.lineWidth = S(.05); g.beginPath();
  for (const u of [.28, .68]) { g.moveTo(x, y + bh * u); g.lineTo(x + bw, y + bh * u); } g.stroke(); }
function drawDockProps(m) { crate(m, -.6, .35, 1.7); crate(m, .1, 2.05, 1.2); crate(m, 1.2, .3, 1.15); barrel(m, 16.3, .35); crate(m, 17.2, .3, 1.5); }
function drawAlleyProps(m) { const { g, X, Y, S } = m;
  const x = X(-.5), y = Y(2.55), dw = S(3.1), dh = S(2.1);
  g.fillStyle = '#1f6b5c'; g.fillRect(x, y, dw, dh); g.fillStyle = 'rgba(5,10,40,.35)'; g.fillRect(x, y + dh * .55, dw, dh * .45);
  g.strokeStyle = INK; g.lineWidth = S(.08); g.strokeRect(x, y, dw, dh);
  g.fillStyle = '#164d43'; g.fillRect(x - S(.1), y - S(.28), dw + S(.2), S(.3)); g.strokeRect(x - S(.1), y - S(.28), dw + S(.2), S(.3));
  g.lineWidth = S(.05); g.beginPath(); for (let u = .5; u < 3; u += .7) { g.moveTo(x + S(u), y + S(.3)); g.lineTo(x + S(u), y + dh - S(.2)); } g.stroke();
  crate(m, 11.1, .35, 1.3); }

// ---- quick scenery for the out-of-focus panels
function heli(m, ux, uy) { const { g, X, Y, S } = m, x = X(ux), y = Y(uy); g.fillStyle = '#080a1e'; g.strokeStyle = '#080a1e'; g.lineWidth = S(.09); g.lineCap = 'round';
  g.beginPath(); g.ellipse(x, y, S(.9), S(.42), 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + S(2.1), y - S(.2)); g.moveTo(x + S(2.1), y - S(.55)); g.lineTo(x + S(2.1), y + S(.1));
  g.moveTo(x - S(1.9), y - S(.62)); g.lineTo(x + S(1.9), y - S(.62)); g.moveTo(x, y - S(.62)); g.lineTo(x, y); g.moveTo(x - S(.7), y + S(.62)); g.lineTo(x + S(.7), y + S(.62)); g.stroke(); }
function tower(m, ux) { const { g, X, Y, S, H } = m; g.strokeStyle = INK; g.lineWidth = S(.11); g.beginPath();
  for (const d of [-1.1, 1.1]) { g.moveTo(X(ux + d * 1.25), H); g.lineTo(X(ux + d), Y(3.9)); }
  for (let u = 0; u < 3.6; u += 1.2) { g.moveTo(X(ux - 1.2), Y(u)); g.lineTo(X(ux + 1.1), Y(u + 1.2)); g.moveTo(X(ux + 1.2), Y(u)); g.lineTo(X(ux - 1.1), Y(u + 1.2)); } g.stroke();
  g.fillStyle = '#3c2a58'; g.fillRect(X(ux - 1.5), Y(6.1), S(3), S(2.2)); g.strokeRect(X(ux - 1.5), Y(6.1), S(3), S(2.2));
  g.beginPath(); g.moveTo(X(ux - 1.7), Y(6.1)); g.lineTo(X(ux), Y(7.2)); g.lineTo(X(ux + 1.7), Y(6.1)); g.closePath(); g.fill(); g.stroke(); }
function train(m) { const { g, X, Y, S, W, H } = m; g.fillStyle = '#17142c'; g.fillRect(0, Y(6.6), W, S(.7)); g.fillRect(0, Y(1.2), W, H);
  for (let u = -2; u < 14; u += 4.2) g.fillRect(X(u), Y(6.6), S(.5), H);
  g.fillStyle = '#8d93a8'; g.fillRect(X(2.2), Y(4.3), W, S(3.1)); g.strokeStyle = INK; g.lineWidth = S(.09); g.strokeRect(X(2.2), Y(4.3), W, S(3.1));
  g.fillStyle = '#ffd76a'; for (let u = 2.8; u < 14; u += 1.25) g.fillRect(X(u), Y(3.8), S(.85), S(.95));
  g.fillStyle = '#b8433a'; g.fillRect(X(2.2), Y(2.3), W, S(.2)); glow(g, X(2.6), Y(1.8), S(.16), '#ffe9a8'); }
function sign(m, ux, uy, txt, col) { const { g, X, Y, S } = m; g.save(); g.shadowColor = col; g.shadowBlur = S(.6); g.strokeStyle = col; g.lineWidth = S(.1);
  g.strokeRect(X(ux), Y(uy), S(1.2), S(txt.length * 1.05 + .3)); g.fillStyle = col; g.font = `900 ${S(.95)}px "Arial Black",Impact,sans-serif`; g.textAlign = 'center';
  [...txt].forEach((ch, i) => g.fillText(ch, X(ux + .6), Y(uy) + S(1.0 + i * 1.05))); g.restore(); }
function capBox(m, txt, ux, uy) { const { g, X, Y, S } = m; g.font = `italic 700 ${S(.42)}px "Comic Neue","Chalkboard SE","Comic Sans MS",sans-serif`;
  const tw = g.measureText(txt).width; g.fillStyle = '#f2b632'; g.fillRect(X(ux), Y(uy), tw + S(.6), S(.85)); g.strokeStyle = INK; g.lineWidth = S(.07);
  g.strokeRect(X(ux), Y(uy), tw + S(.6), S(.85)); g.fillStyle = INK; g.fillText(txt, X(ux) + S(.3), Y(uy) + S(.58)); }

const DUSK = { top: '#2a1c5e', mid: '#6b3f9a', bot: '#d9797a', cloud: '#4a2f7a' };

// ---- real artwork dropped into the art folder (listed in art/manifest.json)
export function loadImage(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }); }
// Turns a flat bright-green backdrop transparent, so a picture can be used as a cut-out.
export function keyGreen(img, despill) {
  const [c, g] = mk(img.width, img.height); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const mx = Math.max(p[i], p[i + 2]), m = p[i + 1] - mx;
    if (m > 28) { const a = Math.max(0, 1 - (m - 28) / 60); p[i + 3] = Math.round(p[i + 3] * a); p[i + 1] = mx; }
    else if (despill && m > 4) p[i + 1] = mx; }   // take the green tinge off a cut-out's edges
  g.putImageData(d, 0, 0); return c;
}
function cover(m, img, ay, zoom = 1, ax = .5) { const s = Math.max(m.W / img.width, m.H / img.height) * zoom, w = img.width * s, h = img.height * s;
  m.g.drawImage(img, (m.W - w) * ax, (m.H - h) * ay, w, h); }

// Returns the layer stack for one panel, far to near.
export function panelLayers(def, art) {
  const w = def.r[2] - def.r[0], h = def.r[3] - def.r[1], L = [], q = def.sharp ? 1 : .32;
  const add = (d, ppu, fn, band) => { const m = layerCtx(w, h, d, ppu * q, band); fn(m); L.push({ d, canvas: m.c, plane: m.plane, blur: m.k * .2 }); };
  const sd = def.seed || 1;
  if (art && art.story) { add(.6, 110, m => coverPanel(m, art.story, art.poi)); return L; }   // one composed illustration
  if (art && art.far) {     // painted artwork: a far backdrop and a near cut-out with the ground
    add(9, 70, m => cover(m, art.far, .5));
    if (art.mid) add(4, 90, m => cover(m, keyGreen(art.mid), 1));
    if (art.near) add(.5, 110, m => cover(m, keyGreen(art.near), 1, 1.08, 0));   // nudged so the image's corner mark falls outside the frame
    return L;
  }
  switch (def.scene) {
    case 'dock':
      add(14, 34, m => drawSky(m, { moon: [14.5, 6.9, 1.05], seed: 3 }));
      add(9, 50, m => drawSkyline(m, { seed: 11, minH: 2.4, maxH: 4.8, color: '#1a2058', neon: .12 }));
      add(5, 66, drawHarbor);
      add(2, 96, drawDockWall);
      add(.5, 100, m => drawGround(m, { lights: [[4.1, '255,170,80'], [11, '255,90,170'], [14.8, '120,200,255']] }), [0, 2.1]);
      add(.2, 100, drawDockProps);
      break;
    case 'alley':
      add(14, 34, m => drawSky(m, { seed: 8, top: '#0b0f30', bot: '#4d3a8c' }));
      add(9, 50, m => drawSkyline(m, { seed: 23, minH: 3.4, maxH: 7.6, color: '#1b2059', neon: .3 }));
      add(5, 66, m => drawSkyline(m, { seed: 31, minH: 2.6, maxH: 5.2, color: '#12163f', neon: .2, lit: .2 }));
      add(2, 96, drawAlleyWall);
      add(.5, 100, m => drawGround(m, { seed: 4, lights: [[5.0, '255,170,80'], [9.6, '255,90,170'], [11.4, '120,200,255']] }), [0, 2.1]);
      add(.2, 100, drawAlleyProps);
      break;
    case 'roofs':
      add(14, 34, m => drawSky(m, { moon: [w * .8, h * .8, 1.1], seed: sd }));
      add(9, 50, m => drawSkyline(m, { seed: sd + 1, minH: h * .25, maxH: h * .7, color: '#1a2058', neon: .2 }));
      add(4, 66, m => drawSkyline(m, { seed: sd + 2, minH: h * .05, maxH: h * .35, color: '#11153c', neon: .3, lit: .3 }));
      break;
    case 'yard':
      add(14, 34, m => drawSky(m, { seed: sd, top: '#0a0e2c', bot: '#3f3a80' }));
      add(8, 50, m => drawSkyline(m, { seed: sd + 1, minH: h * .3, maxH: h * .6, color: '#171c50', lit: .15 }));
      add(3, 70, m => drawContainers(m, sd + 2, h));
      if (def.floor != null) add(.5, 100, m => drawGround(m, { seed: sd, lights: [[w * .25, '255,200,120'], [w * .7, '160,200,255']] }), [0, def.floor + .85]);
      break;
    case 'crane':
      add(14, 34, m => drawSky(m, { moon: [w * .75, h * .82, 1.0], seed: sd }));
      add(9, 50, m => drawSkyline(m, { seed: sd + 1, minH: h * .05, maxH: h * .3, color: '#161b4e', neon: .15, lit: .3 }));
      add(3, 70, m => drawLattice(m, h));
      break;
    case 'storyph':
      add(10, 34, m => drawSky(m, { seed: sd, moon: sd % 3 ? null : [w * .7, h * .7, h * .12], ...(sd % 2 ? {} : DUSK) }));
      add(4, 50, m => drawSkyline(m, { seed: sd + 1, minH: h * .15, maxH: h * .7, color: sd % 2 ? '#171c52' : '#2c2060', neon: .25 }));
      add(0, 70, m => { const { g, X, Y, S } = m; g.fillStyle = 'rgba(8,6,20,.55)'; g.fillRect(X(0), Y(h), S(w), S(h));
        g.fillStyle = '#f6efdc'; g.textAlign = 'center'; const fs = Math.min(S(1.1), S(w) / (def.name.length * .62));
        g.font = `italic 700 ${fs}px "Comic Neue","Chalkboard SE","Comic Sans MS",sans-serif`; g.fillText(def.name, X(w / 2), Y(h / 2));
        g.font = `700 ${fs * .42}px "Comic Neue","Chalkboard SE",sans-serif`; g.fillStyle = '#f2b632'; g.fillText('frame ' + def.id + '  -  illustration to come', X(w / 2), Y(h / 2) + fs * .8); });
      break;
    case 'end':
      add(0, 120, m => { const { g, W, H, X, Y, S } = m; g.fillStyle = '#f2b632'; g.fillRect(0, 0, W, H);
        halftone(g, W, H, S(.16), S(.035), 'rgba(160,90,0,.25)');
        g.fillStyle = INK; g.textAlign = 'center'; g.font = `italic 700 ${S(.9)}px "Comic Neue","Chalkboard SE","Comic Sans MS",sans-serif`;
        g.fillText(def.text || 'TO BE CONTINUED...', X(w / 2), Y(h / 2) + S(.3)); });
      break;
    case 'city':
      add(12, 34, m => drawSky(m, { moon: [w * .3, h * .62, h * .26], seed: sd, top: '#2a1c6a', mid: '#4a3aa0', bot: '#7a5ac0' }));
      add(8, 44, m => { drawSkyline(m, { seed: sd + 1, minH: h * .25, maxH: h * .8, color: '#171c52', neon: .2 }); heli(m, w * .42, h * .7); });
      add(3, 50, m => drawSkyline(m, { seed: sd + 2, minH: h * .1, maxH: h * .5, color: '#0f1238', neon: .35, lit: .35 }));
      if (def.cap) add(0, 60, m => capBox(m, def.cap, .35, h - .35));
      break;
    case 'neon':
      add(12, 34, m => drawSky(m, { seed: sd, top: '#150f3a', mid: '#3a2a7a', bot: '#7a3f9a' }));
      add(7, 44, m => drawSkyline(m, { seed: sd + 1, minH: h * .5, maxH: h * 1.1, color: '#1b1a4e', neon: .5, lit: .22 }));
      add(2.5, 50, m => { drawSkyline(m, { seed: sd + 2, minH: h * .2, maxH: h * .45, color: '#0e0f30', lit: .3 });
        sign(m, w * .16, h * .92, 'BAR', '#ff4fa3'); sign(m, w * .66, h * .8, 'HOTEL', '#4fe0ff'); });
      break;
    case 'tower':
      add(12, 34, m => drawSky(m, { seed: sd, ...DUSK }));
      add(8, 44, m => drawSkyline(m, { seed: sd + 1, minH: h * .15, maxH: h * .55, color: '#3a2a6a', lit: .2 }));
      add(3, 50, m => { drawSkyline(m, { seed: sd + 2, minH: h * .05, maxH: h * .28, color: '#1e1640', lit: .25, neon: .3 }); tower(m, w * .62); });
      break;
    case 'train':
      add(12, 34, m => drawSky(m, { seed: sd, top: '#0c0c26', mid: '#231f55', bot: '#4a3a7a' }));
      add(8, 44, m => drawSkyline(m, { seed: sd + 1, minH: h * .4, maxH: h * .95, color: '#191a4a', neon: .25 }));
      add(3, 50, train);
      break;
  }
  return L;
}

export function paperCanvas() {
  const [c, g] = mk(1024, 660), r = rng(42);
  g.fillStyle = '#efe6cf'; g.fillRect(0, 0, 1024, 660);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${90 + r() * 60 | 0},${70 + r() * 40 | 0},40,${r() * .07})`; g.fillRect(r() * 1024, r() * 660, 1 + r() * 2, 1 + r() * 2); }
  const v = g.createRadialGradient(512, 330, 300, 512, 330, 700); v.addColorStop(0, 'rgba(120,90,40,0)'); v.addColorStop(1, 'rgba(120,90,40,.22)');
  g.fillStyle = v; g.fillRect(0, 0, 1024, 660);
  return c;
}

export function rainCanvas() {
  const [c, g] = mk(512, 512), r = rng(6);
  g.strokeStyle = 'rgba(205,220,255,.55)'; g.lineWidth = 1.6; g.lineCap = 'round'; g.beginPath();
  for (let i = 0; i < 70; i++) { const x = r() * 512, y = r() * 512, l = 22 + r() * 30; g.moveTo(x, y); g.lineTo(x - l * .22, y + l); }
  g.stroke(); return c;
}


// One picture as a layer (used for the frozen teaser shown before a frame is reached).
export function artLayer(def, img, d, ppu = 100) {
  const w = def.r[2] - def.r[0], h = def.r[3] - def.r[1], m = layerCtx(w, h, d, ppu);
  coverPanel(m, img); return { d, canvas: m.c, plane: m.plane, blur: m.k * .2 };
}

function drawContainers(m, seed, h) {
  const { g, W, H, X, Y, S } = m, r = rng(seed), cols = ['#a5321f', '#1f5f8a', '#2f7a55', '#b8862b', '#5a3f8a', '#7a2a4a'];
  for (let u = -12; X(u) < W; u += 5.7) { const n = 1 + (r() * 3 | 0);
    for (let k = 0; k < n; k++) { const x = X(u), y = Y(.9 + (k + 1) * 2.35), cw = S(5.5), ch = S(2.35), c = cols[r() * cols.length | 0];
      g.fillStyle = c; g.fillRect(x, y, cw, ch); g.fillStyle = 'rgba(10,5,30,.38)'; g.fillRect(x, y, cw, ch);
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = S(.05); g.beginPath(); for (let q = .3; q < 5.5; q += .34) { g.moveTo(x + S(q), y + S(.15)); g.lineTo(x + S(q), y + ch - S(.15)); } g.stroke();
      g.strokeStyle = INK; g.lineWidth = S(.08); g.strokeRect(x, y, cw, ch); } }
  g.fillStyle = '#0c0f2a'; g.fillRect(0, Y(.9), W, H);
  halftone(g, W, H, Math.max(5, S(.13)), Math.max(1, S(.03)), 'rgba(10,5,40,.3)');
}
function drawLattice(m, h) {
  const { g, W, H, X, Y, S } = m; g.strokeStyle = '#0a0d2a'; g.lineWidth = S(.22); g.lineJoin = 'round'; g.beginPath();
  for (const u of [-1.5, m.w + 1.5]) { g.moveTo(X(u), 0); g.lineTo(X(u), H); }
  for (let y = -6; y < h + 8; y += 3) { g.moveTo(X(-1.5), Y(y)); g.lineTo(X(m.w + 1.5), Y(y + 3)); g.moveTo(X(m.w + 1.5), Y(y)); g.lineTo(X(-1.5), Y(y + 3)); g.moveTo(X(-1.5), Y(y)); g.lineTo(X(m.w + 1.5), Y(y)); }
  g.stroke(); g.strokeStyle = '#2a3270'; g.lineWidth = S(.06); g.stroke();
}

// Skins for the things the player stands on, until drawn props replace them.
export function blockCanvas(type, w, h, seed = 1) {
  const k = Math.min(90, 2048 / w), [c, g] = mk(w * k, h * k), W = c.width, H = c.height, r = rng(seed * 7 + 3), lw = k * .08;
  if (type === 'roof') {
    g.fillStyle = '#3d2f4e'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#2a1f38'; g.lineWidth = k * .03; g.beginPath();
    for (let y = k * .5, j = 0; y < H; y += k * .32, j++) { g.moveTo(0, y); g.lineTo(W, y); for (let x = (j % 2) * k * .4; x < W; x += k * .8) { g.moveTo(x, y); g.lineTo(x, y + k * .32); } } g.stroke();
    for (let y = k * 1.3; y < H - k; y += k * 1.5) for (let x = k * .6; x < W - k; x += k * 1.3) { g.fillStyle = r() < .35 ? '#ffd76a' : '#1d1630'; g.fillRect(x, y, k * .6, k * .8); g.strokeStyle = INK; g.lineWidth = k * .05; g.strokeRect(x, y, k * .6, k * .8); }
    g.fillStyle = '#7a6a8e'; g.fillRect(0, 0, W, k * .34); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 0, W, k * .08);
    g.strokeStyle = INK; g.lineWidth = lw; g.strokeRect(lw / 2, lw / 2, W - lw, k * .34); g.strokeRect(lw / 2, lw / 2, W - lw, H + 40);
    halftone(g, W, H, 7, 1.6, 'rgba(10,5,30,.25)');
  } else if (type === 'container') {
    const col = ['#a5321f', '#1f5f8a', '#2f7a55', '#b8862b', '#5a3f8a'][seed % 5];
    g.fillStyle = col; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(10,5,30,.22)'; g.fillRect(0, H * .5, W, H * .5);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = k * .05; g.beginPath(); for (let x = k * .3; x < W; x += k * .34) { g.moveTo(x, k * .25); g.lineTo(x, H); } g.stroke();
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, 0, W, k * .16);
    g.strokeStyle = INK; g.lineWidth = lw; g.strokeRect(lw / 2, lw / 2, W - lw, H + 40);
    halftone(g, W, H, 7, 1.6, 'rgba(10,5,30,.22)');
  } else if (type === 'crate') {
    g.fillStyle = '#8b5a2b'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(30,10,30,.3)'; g.fillRect(0, H * .5, W, H * .5);
    g.strokeStyle = INK; g.lineWidth = lw; g.strokeRect(lw / 2, lw / 2, W - lw, H - lw); g.lineWidth = lw * .7; g.strokeRect(W * .12, H * .12, W * .76, H * .76);
    g.beginPath(); g.moveTo(W * .12, H * .12); g.lineTo(W * .88, H * .88); g.moveTo(W * .88, H * .12); g.lineTo(W * .12, H * .88); g.stroke();
  } else {   // steel walkway
    g.fillStyle = '#3a4258'; g.fillRect(0, 0, W, H); g.fillStyle = '#6a7696'; g.fillRect(0, 0, W, Math.max(3, k * .07));
    for (let x = 0; x < W; x += k * .7) { g.fillStyle = (x / (k * .7) | 0) % 2 ? '#f2b632' : '#1a1a22'; g.fillRect(x, H * .55, k * .7, H * .45); }
    g.strokeStyle = INK; g.lineWidth = lw; g.strokeRect(lw / 2, lw / 2, W - lw, H - lw);
  }
  return c;
}

export function forkliftCanvas() {
  const [c, g] = mk(420, 330); g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = 7;
  g.fillStyle = '#1a1a22'; g.fillRect(20, 250, 150, 14); g.strokeRect(20, 250, 150, 14);            // forks
  g.fillStyle = '#3a4258'; g.fillRect(150, 30, 22, 240); g.strokeRect(150, 30, 22, 240);            // mast
  g.fillStyle = '#f2b21c'; g.beginPath(); g.moveTo(172, 150); g.lineTo(380, 150); g.lineTo(400, 270); g.lineTo(172, 270); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(20,20,40,.35)'; g.fillRect(176, 215, 222, 52);
  g.strokeRect(205, 50, 150, 100); g.fillStyle = 'rgba(160,200,255,.25)'; g.fillRect(205, 50, 150, 100);
  for (const x of [215, 350]) { g.fillStyle = '#15151c'; g.beginPath(); g.arc(x, 280, 38, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#6a7696'; g.beginPath(); g.arc(x, 280, 13, 0, 7); g.fill(); }
  g.save(); g.shadowColor = '#fff3b0'; g.shadowBlur = 40; g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(182, 175, 13, 0, 7); g.fill(); g.fill(); g.restore();
  return c;
}

// Fits a picture to the visible frame (a little oversize so the depth shift never shows its edge).
function coverPanel(m, img, poi) { const ax = poi ? poi[0] : .5, ay = poi ? poi[1] : .5;   // crop toward the picture's subject, never through it
  const o = .4, x0 = m.X(-o), x1 = m.X(m.w + o), y0 = m.Y(m.h + o), y1 = m.Y(-o), bw = x1 - x0, bh = y1 - y0;
  const s = Math.max(bw / img.width, bh / img.height), w = img.width * s, h = img.height * s;
  m.g.fillStyle = INK; m.g.fillRect(0, 0, m.W, m.H);
  m.g.save(); m.g.beginPath(); m.g.rect(x0, y0, bw, bh); m.g.clip(); m.g.drawImage(img, x0 + (bw - w) * ax, y0 + (bh - h) * ay, w, h); m.g.restore(); }
