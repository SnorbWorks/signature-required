// Test aid, not part of the game: plays the level by itself so a change can be checked from start to end.
// Use with ?auto=1 (which taps through the story frames), then in the console:  import('./tools/bot.js')
const g = window.__game, log = window.__botlog = [];
let last = '', stuckAt = 0, stuckKey = '', t0 = performance.now();
const floorAt = (p, x, y) => { let f = -99; for (const b of p.plats) if (x >= b.x0 - .15 && x <= b.x1 + .15 && b.top <= y + .02 && b.top > f) f = b.top; return f; };
function tick() {
  const a = g.at, h = g.hero, k = g.keys, now = (performance.now() - t0) / 1000;
  const key = a.page + '/' + a.frame;
  if (key !== last) { last = key; log.push(key + ' @' + now.toFixed(0) + 's clock ' + g.clock.t.toFixed(0)); }
  const sk = key + ':' + Math.round(a.x) + ':' + Math.round(a.y) + ':' + a.control;
  if (sk !== stuckKey) { stuckKey = sk; stuckAt = now; }
  window.__botstate = { key, x: a.x, y: a.y, hp: a.hp, state: a.state, control: a.control, still: +(now - stuckAt).toFixed(0), hint: document.getElementById('hint').textContent };
  k.left = k.right = k.jump = k.down = false;
  if (!a.control) return;
  const X = g.xing;
  if (X && X.live) {   // the overhead crossing: step into a lane only when it will stay clear
    const L0 = 3, LW = 3.2, i = Math.floor((X.tx - L0 + .05) / LW), inLane = (X.tx - L0) / LW - i;
    if (X.tx < L0 - .1 && i < 0) { const l = X.lanes[0]; k.right = X.tx < L0 - .3 || clear(l, X.ty, .68); return; }
    if (i >= X.lanes.length) { k.right = true; return; }
    if (inLane > .12) { k.right = true; return; }   // committed
    k.right = clear(X.lanes[i], X.ty, .68);
    return;
  }
  const p = h.panel; if (!p) return;
  const foes = g.foes.filter(e => e.shown && e.state !== 'down' && e.panel === p && !e.hop);
  const climb = p.def.track === 'y';
  if (climb) {
    let next = h.grounded ? null : window.__aim; if (h.grounded) { for (const b of p.plats) if (b.top > h.y + .3 && (!next || b.top < next.top)) next = b; window.__aim = next; }
    if (!next) return;
    const tx = Math.max(next.x0 + .5, Math.min(next.x1 - .5, h.x)), dx = tx - h.x;
    if (Math.abs(dx) > 2.2) { k.right = dx > 0; k.left = dx < 0; if (h.grounded && floorAt(p, h.x + Math.sign(dx) * .5, h.y) < h.y - .05) g.pressed.jump = true; return; }
    k.right = dx > .1; k.left = dx < -.1;
    if (h.grounded) g.pressed.jump = true;
    return;
  }
  const e = foes.sort((m, n) => Math.abs(m.x - h.x) - Math.abs(n.x - h.x))[0];
  if (e && Math.abs(e.y - h.y) < 1.3 && Math.abs(e.x - h.x) < 7) {
    let want = Math.sign(e.x - h.x) || 1;
    const gap = p.plats.length === 2 && kt0(e) ? (p.plats[0].x1 + p.plats[1].x0) / 2 : null;
    const kt = e.knockTo, kd = gap != null ? Math.sign(gap - e.x) : kt ? kt.dir || 0 : 0;
    if (kd && (gap != null || e.hp <= 2) && want !== kd) {   // get round to the side the knock has to come from
      const tx = e.x - kd * 1.4; k.right = tx > h.x; k.left = tx < h.x; if (h.grounded && Math.abs(e.x - h.x) < 2.2) g.pressed.jump = true; return; }
    const d = Math.abs(e.x - h.x);
    if (d > 1.7) { k.right = want > 0; k.left = want < 0; if (h.grounded && floorAt(p, h.x + want * .55, h.y) < h.y - .05) g.pressed.jump = true; }
    else { h.face = want; g.pressed.punch = true; }
    return;
  }
  // otherwise run right, jumping gaps and walls
  k.right = true;
  if (h.grounded) {
    const ahead = floorAt(p, h.x + .55, h.y), wall = p.plats.some(b => b.solid && h.y < b.top - .25 && h.x + 1.0 > b.x0 - .35 && h.x < b.x0);
    const higher = p.plats.some(b => !b.solid && b.top > h.y + .2 && b.top < h.y + 1.9 && b.x0 > h.x && b.x0 - h.x < 2.4);
    if (ahead < h.y - .05 && h.x < p.x1 - 1.2) { const land = p.plats.some(b => b.x0 > h.x && b.x0 - h.x < 4.2); if (land || ahead < -50) g.pressed.jump = true; }
    else if (wall || higher) g.pressed.jump = true;
  }
}
const kt0 = e => e.knockTo && e.knockTo.pit;
function clear(l, ty, secs) { for (const c of l.cars) for (let t = 0; t <= secs; t += .1) if (Math.abs(ty - (c.y + l.v * t)) < l.len / 2 + .55) return false; return true; }
window.__bot = setInterval(tick, 30);
export default 'bot running';
