// Comic lettering drawn as sharp vector shapes on top of the game:
// speech balloons, thought balloons, caption boxes and "POW!" bursts.
const NS = 'http://www.w3.org/2000/svg';
const INK = '#0d0a12', CREAM = '#f6efdc';
const FONT_B = '"Comic Neue","Chalkboard SE","Comic Sans MS",sans-serif';
const FONT_S = '"Bangers","Impact","Arial Black",sans-serif';
const el = (n, a = {}, p) => { const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
let meas;
const textW = (t, font) => { meas = meas || document.createElement('canvas').getContext('2d'); meas.font = font; return meas.measureText(t).width; };
const f1 = n => n.toFixed(1);

export class Lettering {
  constructor(svg) {
    this.gCap = el('g', {}, svg); this.gBal = el('g', {}, svg); this.gFx = el('g', {}, svg);
  }

  balloon(text, kind = 'speech') {
    const lines = text.split('\n'), fs = 22, lh = 26, font = `italic 700 ${fs}px ${FONT_B}`;
    const tw = Math.max(...lines.map(l => textW(l, font))), th = lines.length * lh;
    const rx = tw / 2 * 1.3 + 16, ry = th / 2 * 1.3 + 13;
    const g = el('g', {}, this.gBal);
    let tailFill, tailLine; const dots = [];
    if (kind === 'thought') {
      const n = Math.max(10, Math.round(2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2) / 21));
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2;
        el('circle', { cx: f1(rx * Math.cos(a)), cy: f1(ry * Math.sin(a)), r: 13 + (i % 3) * 2, fill: CREAM, stroke: INK, 'stroke-width': 3.5 }, g); }
      el('ellipse', { rx: rx + 2, ry: ry + 2, fill: CREAM }, g);
      for (let i = 0; i < 3; i++) dots.push(el('circle', { fill: CREAM, stroke: INK, 'stroke-width': 3 }, g));
    } else if (kind === 'radio') {
      const pts = [], n = 22; for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 1.0 : 1.13;
        pts.push(f1(Math.cos(a) * rx * r) + ',' + f1(Math.sin(a) * ry * r)); }
      el('polygon', { points: pts.join(' '), fill: '#fff1c4', stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, g);
    } else {
      el('ellipse', { rx, ry, fill: CREAM, stroke: INK, 'stroke-width': 3.5 }, g);
      tailFill = el('path', { fill: CREAM }, g);
      tailLine = el('path', { fill: 'none', stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
    }
    const t = el('text', { 'text-anchor': 'middle', 'font-family': FONT_B, 'font-size': fs, 'font-style': 'italic', 'font-weight': 700, fill: INK }, g);
    lines.forEach((l, i) => { el('tspan', { x: 0, y: f1((i - (lines.length - 1) / 2) * lh + fs * .34) }, t).textContent = l; });
    return { rx, ry, kind,
      set(sx, sy, sc, rot, tx, ty) {
        g.setAttribute('transform', `translate(${f1(sx)} ${f1(sy)}) rotate(${rot.toFixed(2)}) scale(${sc.toFixed(3)})`);
        if (tx == null || kind === 'radio') { if (tailFill) { tailFill.setAttribute('d', ''); tailLine.setAttribute('d', ''); } for (const d of dots) d.setAttribute('r', 0); return; }
        const r = -rot * Math.PI / 180, dx = (tx - sx) / sc, dy = (ty - sy) / sc;
        const lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r);
        const a = Math.atan2(ly / ry, lx / rx), ex = rx * Math.cos(a), ey = ry * Math.sin(a);
        if (kind === 'thought') {
          [[.34, 9], [.6, 6.5], [.82, 4.5]].forEach(([u, rad], i) => {
            dots[i].setAttribute('cx', f1(ex + (lx - ex) * u + Math.cos(a) * 14 * (1 - u)));
            dots[i].setAttribute('cy', f1(ey + (ly - ey) * u + Math.sin(a) * 14 * (1 - u)));
            dots[i].setAttribute('r', rad); });
        } else {
          const d = .2, b1 = [rx * Math.cos(a - d), ry * Math.sin(a - d)], b2 = [rx * Math.cos(a + d), ry * Math.sin(a + d)];
          const tip = [ex + (lx - ex) * .72, ey + (ly - ey) * .72];
          const pt = q => `${f1(q[0])} ${f1(q[1])}`;
          tailFill.setAttribute('d', `M${pt(b1)}L${pt(tip)}L${pt(b2)}L${pt([ex * .7, ey * .7])}Z`);
          tailLine.setAttribute('d', `M${pt(b1)}L${pt(tip)}L${pt(b2)}`);
        }
      },
      fade(alpha, blur) { g.style.opacity = alpha; g.style.filter = blur > .3 ? `blur(${blur.toFixed(1)}px)` : ''; },
      remove() { g.remove(); } };
  }

  caption(text) {
    const fs = 17, font = `italic 700 ${fs}px ${FONT_B}`, s = text.toUpperCase();
    const tw = textW(s, font);
    const g = el('g', {}, this.gCap);
    el('rect', { x: 3, y: 3, width: tw + 26, height: 34, fill: 'rgba(13,10,18,.5)' }, g);
    el('rect', { x: 0, y: 0, width: tw + 26, height: 34, fill: '#f2b632', stroke: INK, 'stroke-width': 3 }, g);
    el('text', { x: 13, y: 23, 'font-family': FONT_B, 'font-size': fs, 'font-style': 'italic', 'font-weight': 700, fill: INK }, g).textContent = s;
    return {
      set(sx, sy, sc, rot, alpha, blur) {
        g.setAttribute('transform', `translate(${f1(sx)} ${f1(sy)}) rotate(${rot.toFixed(2)}) scale(${sc.toFixed(3)})`);
        g.style.opacity = alpha; g.style.filter = blur > .3 ? `blur(${blur.toFixed(1)}px)` : '';
      },
      remove() { g.remove(); } };
  }

  burst(text, variant = 0) {
    const fs = 64, tw = textW(text, `${fs}px ${FONT_S}`);
    const R = tw * .5 + 44, n = 13, pts = [];
    for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? .6 + Math.random() * .08 : .88 + Math.random() * .3;
      pts.push(f1(Math.cos(a) * R * r) + ',' + f1(Math.sin(a) * R * .7 * r)); }
    const pal = [['#ffd21f', '#e4281c'], ['#f6efdc', '#5a2ca0'], ['#ff7a1a', '#fff6c9']][variant] || ['#ffd21f', '#e4281c'];
    const g = el('g', {}, this.gFx);
    el('polygon', { points: pts.join(' '), fill: INK, transform: 'translate(6 6)', opacity: .5 }, g);
    el('polygon', { points: pts.join(' '), fill: pal[0], stroke: INK, 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
    el('text', { 'text-anchor': 'middle', y: fs * .34, 'font-family': FONT_S, 'font-size': fs, fill: pal[1], stroke: INK, 'stroke-width': 7,
      'stroke-linejoin': 'round', 'paint-order': 'stroke', transform: 'skewX(-8)', 'letter-spacing': 2 }, g).textContent = text;
    return {
      set(sx, sy, sc, rot, alpha) {
        g.setAttribute('transform', `translate(${f1(sx)} ${f1(sy)}) rotate(${rot.toFixed(2)}) scale(${sc.toFixed(3)})`);
        g.style.opacity = alpha;
      },
      remove() { g.remove(); } };
  }
}
