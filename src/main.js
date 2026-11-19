// Comic-book game, level 1. The level map lives in level1.js (pages, frames, shots,
// lettering). This file turns that map into pages you read and play through:
// story frames you tap through, action frames you play in, knock-throughs from one
// frame into another, and page turns.
import * as THREE from 'three';
import { panelLayers, paperCanvas, rainCanvas, blurred, loadImage, artLayer, blockCanvas, forkliftCanvas } from './art.js';
import { Puppet, STYLES, poseFor, lerpPose, frameFor, sliceSprites, CW, CH, BASE, PPU } from './puppet.js';
import { Lettering } from './letters.js';
import { LEVEL } from './level1.js';

const PAGE = { w: 42, h: 27 };
const GROUND = 1.25, ZACT = -.5, UNIT = .022, ROLL = .07, FOV = 35;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = id => document.getElementById(id);
const QS = new URLSearchParams(location.search), AUTO = QS.has('auto');

// What the action frames are made of. Platforms: [left, right, top, look, solid], measured
// from the frame's left edge and from its ground line. Stand-in scenery until art replaces it.
const G = [-60, 100, 0, null, false];
const landings = []; for (let i = 1; i <= 11; i++) landings.push(i % 2 ? [4.5, 9.2, i * 1.55, 'steel', false] : [.6, 5.3, i * 1.55, 'steel', false]);
landings.push([.6, 9.2, 12 * 1.55, 'steel', false]);
const GAME = {
  '1.1': { track: 'x' },
  '1.6': { scene: 'roofs', seed: 12, plats: [[-6, 4.6, 2.6, 'roof'], [6.1, 10.1, 1.8, 'roof'], [12.1, 15.6, 2.2, 'roof'], [18.1, 20.2, 1.2, 'roof']] },
  '2.1': { scene: 'alley' }, '2.3': { scene: 'dock' }, '2.4': { scene: 'dock' },
  '3.2': { scene: 'yard', seed: 31, floor: 1.25 },
  '3.3': { scene: 'yard', seed: 33, floor: 1.25, plats: [G, [4.4, 6.4, 1.6, 'crate'], [9.4, 11.4, 1.6, 'crate']] },
  '3.7': { scene: 'yard', seed: 37, track: 'x', plats: [[-6, 5.5, .6, 'container'], [5.5, 11, 1.8, 'container'], [11, 16.5, .9, 'container'],
    [17.9, 27, 1.4, 'container'], [27, 32, 2.6, 'container'], [34.2, 46, 1.4, 'container']] },
  '4.1': { scene: 'crane', seed: 41, track: 'y', plats: [[-60, 100, 0, 'steel', false], ...landings] },
  '4.4': { scene: 'crane', seed: 44, plats: [[-60, 100, 0, 'steel', false]] },
  '4.5': { scene: 'crane', seed: 45, plats: [[-60, 100, 0, 'steel', false]] },
  '5.5': { scene: 'end', text: 'TO BE CONTINUED...' },
};

THREE.ColorManagement.enabled = false;
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, stencil: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x17121a);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, 1, .1, 500);
let W = 1, H = 1;
function resize() { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

let pageTex = [], pageObjs = [];
const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.anisotropy = 4; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; pageTex.push(t); return t; };
const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
const FS = `uniform sampler2D map,mapB; uniform float focus,dim,alpha; uniform vec2 off,rep; varying vec2 vUv;
void main(){ vec2 u=vUv*rep+off; vec4 a=texture2D(map,u), b=texture2D(mapB,u); vec4 c=mix(b,a,focus); c.rgb*=mix(dim,1.0,focus); c.a*=alpha; gl_FragColor=c; }`;
const layerMat = (map, mapB, ref) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map }, mapB: { value: mapB }, focus: { value: 0 }, dim: { value: .6 }, alpha: { value: 1 }, off: { value: new THREE.Vector2() }, rep: { value: new THREE.Vector2(1, 1) } },
  vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false,
  stencilWrite: true, stencilRef: ref, stencilFunc: THREE.EqualStencilFunc });
const clipMat = (o, ref) => new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, stencilWrite: true, stencilRef: ref, stencilFunc: THREE.EqualStencilFunc, ...o });

let panels = [], P = {}, rainMats = [], L, manifest = {}, pageNo = 0, frameId = '';
let hero, thug, goon, w1, w2, w3, gage, chars = [], foes = [];
const imgCache = {};
const put = m => { scene.add(m); pageObjs.push(m); return m; };

async function buildPage(n) {
  pageNo = n; panels = []; P = {}; rainMats = [];
  const defs = LEVEL.pages[n].panels.map(d => ({ sharp: true, scene: d.kind === 'caption' ? 'end' : 'storyph', seed: Math.round(parseFloat(d.id) * 10), ...d, ...(GAME[d.id] || {}) }));
  const artFor = {};
  for (const d of defs) { const a = (manifest.panels || {})[d.id]; if (!a) continue; artFor[d.id] = {};
    for (const k in a) if (k === 'lettered') d.lettered = true; else artFor[d.id][k] = imgCache[a[k]] || (imgCache[a[k]] = await loadImage('./art/' + a[k])); }
  const rainTex = tex(rainCanvas(), true);
  const inkMat = new THREE.MeshBasicMaterial({ color: 0x0d0a12, transparent: true, depthTest: false, depthWrite: false });
  panels = defs.map((def, i) => {
    const [x0, y0, x1, y1] = def.r, w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ref = i + 1, base = 10 + i * 20;
    const p = { def, id: def.id, x0, y0, x1, y1, w, h, cx, cy, ref, base, mats: [], blocks: [], focus: 0, want: 0, charOrder: base + 9, seen: false, tease: 1, ncap: 0 };
    const mask = put(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x0d0a12, transparent: true, depthTest: false, depthWrite: false,
      stencilWrite: true, stencilRef: ref, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp })));
    mask.position.set(cx, cy, 0); mask.renderOrder = base;
    const art = artFor[def.id];
    panelLayers(def, art).forEach((ly, j) => {
      const mat = layerMat(tex(ly.canvas), tex(blurred(ly.canvas, ly.blur)), ref), mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(ly.plane.w, ly.plane.h), mat));
      mesh.position.set(cx, cy + ly.plane.cy, -ly.d);
      mesh.renderOrder = base + 1 + j + (ly.d < -ZACT ? 4 : 0);   // layers nearer than the action draw over the characters
      if (ly.d >= -ZACT) p.charOrder = base + 1 + j + .5;
      p.mats.push(mat);
    });
    // what the player stands on
    p.plats = (def.plats || [G]).map(([a, b, top, look, solid = true]) => ({ x0: x0 + a, x1: x0 + b, top, look, solid }));
    const hasArt = art && (art.far || art.story);
    p.plats.forEach((b, k) => { if (!b.look || (hasArt && !def.keepBlocks)) return;
      const bx0 = Math.max(b.x0, x0 - 1.5), bx1 = Math.min(b.x1, x1 + 1.5), bw = bx1 - bx0;
      const bh = b.look === 'steel' ? .32 : b.look === 'crate' ? b.top : b.top + GROUND + 1;
      const mat = clipMat({ map: tex(blockCanvas(b.look, bw, bh, k + i * 3)) }, ref), mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), mat));
      mesh.position.set((bx0 + bx1) / 2, y0 + GROUND + b.top - bh / 2, ZACT); mesh.renderOrder = p.charOrder - .1; p.blocks.push(mat); });
    // the frozen teaser, shown until the reader gets here
    if (art && art.teaser) { const ly = artLayer(def, art.teaser, .3), mat = layerMat(tex(ly.canvas), tex(blurred(ly.canvas, ly.blur)), ref);
      const mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(ly.plane.w, ly.plane.h), mat)); mesh.position.set(cx, cy + ly.plane.cy, -ly.d); mesh.renderOrder = base + 16;
      p.mats.push(mat); p.teaser = mat; }
    if (def.kind !== 'caption') {
      const mat = layerMat(rainTex, rainTex, ref); mat.uniforms.rep.value.set(w / 6, h / 6);
      const mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(w + 1.2, h + 1.2), mat)); mesh.position.set(cx, cy, -.1); mesh.renderOrder = base + 18;
      p.mats.push(mat); rainMats.push(mat);
    }
    const t = .17, bar = (bx, by, bw, bh) => { const m = put(new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), inkMat)); m.position.set(bx, by, 0); m.renderOrder = 900; };
    bar(cx, y0, w + t, t); bar(cx, y1, w + t, t); bar(x0, cy, t, h + t); bar(x1, cy, t, h + t);
    P[def.id] = p; return p;
  });
}
function clearPage() {
  for (const m of pageObjs) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  for (const t of pageTex) t.dispose();
  pageObjs = []; pageTex = [];
  for (const o of balloons) o.b.remove(); for (const o of captions) o.b.remove(); for (const o of bursts) o.b.remove();
  balloons.length = captions.length = bursts.length = drops.length = 0; spot = null; fork = null; foes = [];
  for (const c of chars) { c.shown = false; c.panel = null; c.hop = null; c.ai = false; c.mesh.visible = false; }
  focusOn.panel = null; focusOn.eye = null; control = false; hudOn = false; hud();
}

// ---------- characters
function floorAt(p, x, y) { let f = -99; for (const b of p.plats) if (x >= b.x0 - .15 && x <= b.x1 + .15 && b.top <= y + .02 && b.top > f) f = b.top; return f; }
class Char {
  constructor(kind) {
    this.pup = new Puppet(STYLES[kind]); this.tex = new THREE.CanvasTexture(this.pup.c);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(CW / PPU, CH / PPU), this.mat); this.mesh.visible = false; scene.add(this.mesh);
    Object.assign(this, { kind, x: 0, y: 0, vx: 0, vy: 0, wx: 0, wy: 0, face: 1, state: 'idle', st: 0, hp: 3, panel: null, relaxed: true, phase: 0,
      inv: 0, ai: false, wait: 1, hop: null, pose: null, free: true, shown: false, zlift: 0, spin: 0, ghost: false, struck: false, hitDone: false,
      grounded: true, reach: 2.05, windT: .42, speed: 2.5, gone: false, safe: null, knockTo: null, guard: null, noRespawn: false });
  }
  setPanel(p) { this.panel = p; this.mat.stencilWrite = true; this.mat.stencilRef = p.ref; this.mat.stencilFunc = THREE.EqualStencilFunc; this.mesh.renderOrder = p.charOrder; }
  unclip() { this.mat.stencilWrite = false; this.mesh.renderOrder = 950; }
  set(s) { if (this.state !== s) { this.state = s; this.st = 0; } }
  get busy() { return this.state === 'punch' || this.state === 'hurt' || this.state === 'down'; }
  fell() {
    if (this === hero && !this.noRespawn && this.safe) { this.x = this.safe.x; this.y = this.safe.y; this.vx = this.vy = 0; this.inv = 1.3; this.grounded = true; this.set('idle'); return; }
    this.gone = true; this.shown = false; this.vx = this.vy = 0; if (this !== hero) { this.hp = 0; this.ai = false; this.set('down'); }
  }
  tick(dt, t) {
    this.st += dt; this.inv = Math.max(0, this.inv - dt);
    const p = this.panel; if (!p || this.gone) { this.mesh.visible = false; return; }
    if (this.hop) { const h = this.hop; h.t += dt / h.dur; const u = Math.min(1, h.t), s = Math.sin(Math.PI * u);
      this.x = this.wx = h.x0 + (h.x1 - h.x0) * u; this.wy = h.y0 + (h.y1 - h.y0) * u + s * h.h; this.zlift = s * 1.1; this.spin = (h.spin || 0) * u;
      if (u >= 1) { this.hop = null; this.zlift = this.spin = 0; this.setPanel(h.to); this.x = h.x1; this.y = h.y1 - (h.to.y0 + GROUND); this.vx = this.vy = 0; this.grounded = true;
        if (!h.keep) this.set('idle'); h.done(); } }
    else {
      const px = this.x; this.x += this.vx * dt;
      for (const b of p.plats) if (b.solid && this.y < b.top - .25 && this.x > b.x0 - .35 && this.x < b.x1 + .35) this.x = px < (b.x0 + b.x1) / 2 ? b.x0 - .35 : b.x1 + .35;
      const fl = floorAt(p, this.x, this.y);
      if (this.vy > 0 || this.y > fl + 1e-4) { this.grounded = false; this.y += this.vy * dt; this.vy -= 28 * dt;
        if (this.vy <= 0 && this.y <= fl) { this.y = fl; this.vy = 0; this.grounded = true; if (this.state === 'jump') this.set('idle'); } }
      else { this.y = fl; this.grounded = true; }
      if (!this.free) this.x = clamp(this.x, p.x0 + .7, p.x1 - .7);
      if (this.y < -(GROUND + 3.5)) { this.fell(); if (this.gone) { this.mesh.visible = false; return; } }
      if (this === hero && this.grounded && !this.busy) this.safe = { x: this.x, y: this.y };
      this.wx = this.x; this.wy = p.y0 + GROUND + this.y;
    }
    if (this.state === 'walk') this.phase += Math.abs(this.vx) * dt * (this.pup.cycle ? 3.6 : 2.3);
    if (this.state === 'hurt' || this.state === 'down') this.vx *= Math.exp(-5 * dt);
    const [target, rate] = poseFor(this, t);
    this.pose = this.pose ? lerpPose(this.pose, target, 1 - Math.exp(-rate * dt)) : target;
    if (!this.shown) { this.mesh.visible = false; return; }
    const fr = this.hop ? (this.hop.keep ? 'hurt' : 'jump') : frameFor(this);
    if (this.pup.draw(this.pose, { air: !this.grounded || !!this.hop, hurt: this.state === 'hurt' || this.state === 'down', frame: fr })) this.tex.needsUpdate = true;
    this.mesh.visible = !(this.inv > 0 && Math.floor(t * 14) % 2 === 0);
    this.mesh.position.set(this.wx, this.wy + (BASE - CH / 2) / PPU, ZACT + this.zlift);
    this.mesh.scale.x = this.face; this.mesh.rotation.z = -this.spin * this.face;
    const f = this.hop ? 1 : this.panel.focus; this.mat.color.setScalar(.6 + .4 * f);
  }
}
function spawn(c, p, lx, o = {}) { c.setPanel(p); c.x = p.x0 + lx; c.y = o.y || 0; c.vx = c.vy = 0; c.hop = null; c.gone = false; c.shown = o.shown !== false; c.grounded = true;
  c.face = o.face || 1; c.state = 'idle'; c.st = 0; c.ai = false; c.free = true; c.ghost = false; c.relaxed = !!o.relaxed; c.knockTo = null; c.guard = null; c.spin = 0;
  if (o.hp) c.hp = o.hp; c.wx = c.x; c.wy = p.y0 + GROUND + c.y; if (c === hero) { c.safe = { x: c.x, y: c.y }; c.noRespawn = false; } }

// ---------- input
const keys = {}, pressed = {};
const MAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  KeyJ: 'punch', KeyX: 'punch', KeyK: 'punch', Enter: 'ok' };
addEventListener('keydown', e => { if (e.code === 'KeyR') location.reload(); const k = MAP[e.code]; if (!k) return; e.preventDefault();
  if (!keys[k]) { pressed[k] = true; if (k !== 'left' && k !== 'right') pressed.ok = true; } keys[k] = true; });
addEventListener('keyup', e => { const k = MAP[e.code]; if (k) keys[k] = false; });
$('gl').addEventListener('pointerdown', () => { pressed.ok = true; });
for (const [id, k] of [['bL', 'left'], ['bR', 'right'], ['bJ', 'jump'], ['bP', 'punch']]) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; pressed[k] = true; if (k !== 'left' && k !== 'right') pressed.ok = true; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { keys[k] = false; });
}

// ---------- little helpers for scripting the scenes
const waits = [];
const until = fn => new Promise(r => waits.push({ fn, r }));
const wait = s => { let t = 0; return until(dt => (t += dt) >= s); };
const hint = s => { const h = $('hint'); h.textContent = s || ''; h.style.opacity = s ? 1 : 0; };
function hud() { const h = $('hud'); h.style.display = hudOn ? 'block' : 'none'; if (!hero) return;
  h.innerHTML = '<b>MILO</b>' + '&#9829;'.repeat(Math.max(0, hero.hp)) + '<i>' + '&#9829;'.repeat(5 - Math.max(0, hero.hp)) + '</i>'; }

let control = false, hudOn = false, time = 0, hitstop = 0, shake = 0, combo = 0, spot = null, fork = null;
const balloons = [], bursts = [], captions = [], drops = [];
const view = { cx: PAGE.w / 2, cy: PAGE.h / 2, D: 80, ox: -.14 }, focusOn = { panel: null, fill: .74, eye: null };

function focusPanel(p, fill = .74) { focusOn.panel = p; focusOn.fill = fill; focusOn.eye = null; for (const q of panels) q.want = q === p ? 1 : 0; }
function enterPanel(p, fill) { p.seen = true; frameId = p.id; focusPanel(p, fill); }
function walkTo(c, x, sp = 3) { c.free = true; c.face = Math.sign(x - c.x) || 1; c.vx = c.face * sp; c.set('walk');
  return until(() => { if ((x - c.x) * c.face <= 0) { c.x = x; c.vx = 0; c.set('idle'); return true; } }); }
function hop(c, to, x1, o = {}) { return new Promise(res => { c.unclip(); c.set('jump'); c.vx = 0; c.face = Math.sign(x1 - c.x) || c.face; c.grounded = false;
  c.hop = { x0: c.x, y0: c.wy, x1, y1: to.y0 + GROUND + (o.y || 0), t: 0, dur: o.dur || .62, h: o.h == null ? 2.3 : o.h, to, done: res }; }); }
function addBalloon(c, text, kind) { const b = { b: L.balloon(text, kind), c }; balloons.push(b); return b; }
function dropBalloon(b) { const i = balloons.indexOf(b); if (i >= 0) { b.b.remove(); balloons.splice(i, 1); } }
async function tap() { hint('Space or tap to continue'); await wait(.3); pressed.ok = false; let t = 0; await until(dt => pressed.ok || (AUTO && (t += dt) > .5)); hint(''); }
async function say(c, text, kind = 'speech') { const b = addBalloon(c, text, kind); await tap(); dropBalloon(b); }
function shout(c, text, sec = 1.6, kind = 'speech') { const b = addBalloon(c, text, kind); wait(sec).then(() => dropBalloon(b)); }
const radio = (text, sec = 2.4) => shout(hero, text, sec, 'radio');
function burst(text, x, y, size = 1, variant = 0, life = .72) { bursts.push({ b: L.burst(text, variant), x, y, t: 0, size, life, rot: (Math.random() - .5) * 22 }); }
function caption(p, text) { captions.push({ b: L.caption(text), p, i: p.ncap++ }); }
function wrap(s, n = 21) { const out = []; let l = ''; for (const w of s.split(' ')) { if (l && (l + ' ' + w).length > n) { out.push(l); l = w; } else l = l ? l + ' ' + w : w; } out.push(l); return out.join('\n'); }
function parseLine(s) { let m;
  if ((m = s.match(/^\[CAPTION\]\s*(.*)/))) return { t: 'cap', text: m[1] };
  if ((m = s.match(/^\[SFX\]\s*(.*)/))) return { t: 'sfx', text: m[1] };
  m = s.match(/^([^:(]+?)\s*(?:\((radio|T)\))?:\s*(.*)$/);
  return { t: m[2] === 'radio' ? 'radio' : m[2] === 'T' ? 'thought' : 'speech', who: m[1], text: m[3] }; }

// A story frame: the camera settles on the illustration and the reader taps through its lettering.
async function storyFrame(id, hold = .9) {
  const p = P[id]; enterPanel(p, .8);
  if (p.def.track === 'x') { let u = 0; focusOn.eye = () => { u = Math.min(1, u + .0022); const e = u * u * (3 - 2 * u); return [p.x0 + p.w * (.15 + .7 * e), p.cy]; }; }
  await wait(hold);
  let n = 0, cur = null, k = clamp(p.w / 12, .62, 1);
  for (const s of p.def.lettered ? [] : p.def.lines) { const l = parseLine(s);
    if (l.t === 'cap') { caption(p, l.text); await wait(.8); continue; }
    if (l.t === 'sfx') { burst(l.text, p.cx + (n % 2 ? -1 : 1) * p.w * .1, p.cy + p.h * .1, clamp(p.w / 11, .55, 1.3), 2, 1.3); shake = .4; await wait(.9); continue; }
    if (cur) dropBalloon(cur);
    const b = L.balloon(wrap(l.text), l.t), rxW = b.rx * UNIT * k, ryW = b.ry * UNIT * k;
    const fx = clamp(p.x0 + p.w * (n % 2 ? .66 : .34), p.x0 + rxW + .3, Math.max(p.x0 + rxW + .3, p.x1 - rxW - .3)), fy = p.y1 - ryW - .4;
    cur = { b, fx, fy, tx: fx + (p.cx - fx) * .4, ty: p.cy - p.h * .02, k }; balloons.push(cur); n++;
    await tap(); }
  if (!n) await tap();
  if (cur) dropBalloon(cur);
}

// ---------- fighting
const WORDS = ['POW!', 'BAM!', 'WHAP!', 'THOK!'];
function knock(e) {   // the hit that sends someone out of this frame and into another
  const k = e.knockTo; e.knockTo = null; e.ai = false; e.free = true; e.set('down'); e.vx = e.vy = 0; e.grounded = false; e.flown = false; e.unclip(); e.face = -hero.face;
  e.hop = { x0: e.x, y0: e.wy + .5, x1: k.x, y1: k.p.y0 + GROUND + (k.y || 0), t: 0, dur: .8, h: k.h == null ? 2.6 : k.h, to: k.p, keep: true, spin: 6.283 * 1.5,
    done: () => { e.flown = true; shake = .8; if (k.word) burst(k.word, k.x, k.p.y0 + GROUND + (k.y || 0) + 2.6, 1.2, 2, 1); if (k.hide) e.shown = false; } };
  wait(.22).then(() => { k.p.seen = true; focusPanel(k.p); });
}
function heroHits(e) {
  hero.hitDone = true; e.hp--; combo++;
  if (e.hp <= 0 && e.guard && e.guard()) e.hp = 1;
  if (e.hp <= 0 && e.knockTo) {   // he only leaves the frame the way the punch sends him
    const k = e.knockTo, f = hero.face, lo = k.p.x0 + 3, hi = k.p.x1 - 3; let tx = k.fx != null ? k.fx : clamp(e.x + f * 4.5, lo, hi), ok = !k.dir || f === k.dir;
    if ((tx - e.x) * f < 0) { if (k.fx != null) ok = false; else { tx = clamp(e.x, lo, hi); if (Math.abs(tx - e.x) > .6) ok = false; } }
    if (ok) k.x = tx; else { e.hp = 1; e.held = true; } }
  const x = hero.x + hero.face * 1.55, y = hero.wy + 3.1;
  if (e.hp <= 0) { hitstop = .17; shake = .6; burst('KRAKK!', x, y + .3, 1.25, 2);
    if (e.knockTo) knock(e); else { e.set('down'); e.vx = hero.face * 7.5; e.vy = 7; e.ai = false; } }
  else if (e.held) { e.held = false; e.set('hurt'); e.st = 0; e.vx = hero.face * 5; hitstop = .085; shake = .35; burst(WORDS[combo % WORDS.length], x, y, 1, 0);
    hint(e.knockTo.dir < 0 ? 'Knock him  ◀  that way, into the next frame!' : e.knockTo.dir > 0 ? 'Knock him that way  ▶  into the next frame!' : 'Knock him toward the middle!'); }
  else { e.set('hurt'); e.st = 0; e.vx = hero.face * 3.6; hitstop = .085; shake = .35; burst(WORDS[combo % WORDS.length], x, y, 1, 0); }
}
function hurtHero(dir, word) {
  hero.hp--; hero.inv = .9; hero.vx = dir * 4.2; hitstop = .07; shake = .3;
  burst(word, hero.x, hero.wy + 2.7, .85, 1); hud();
  if (hero.hp <= 0) { hero.set('down'); hero.vy = 6;
    wait(1.7).then(() => { hero.hp = 5; hero.inv = 1.6; if (hero.state === 'down') hero.set('idle'); hud(); if (hero.shown) shout(hero, 'Not today.', 1.3); }); }
  else { hero.set('hurt'); hero.st = 0; }
}
function inReach(a, b) { const dx = (b.x - a.x) * a.face; return dx > .15 && dx < a.reach && Math.abs(a.y - b.y) < 1.5; }

function playHero() {
  let idle = hero.state === 'idle' || hero.state === 'walk';
  if (idle && !hero.grounded && !hero.hop) { hero.set('jump'); idle = false; }
  const air = hero.state === 'jump';
  if (control && (idle || air) && !hero.hop) {
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    hero.vx = dir * 4.4; if (dir) hero.face = dir;
    if (idle) hero.set(dir ? 'walk' : 'idle');
    if (pressed.jump && idle && hero.grounded) { hero.vy = 10.5; hero.grounded = false; hero.set('jump'); }
    if (pressed.punch) { hero.set('punch'); hero.st = 0; hero.hitDone = false; if (hero.grounded) hero.vx = hero.face * 1.4; }
  } else if (!control && idle && !hero.free) hero.vx = 0;
  if (hero.state === 'punch') {
    if (hero.st > .07 && hero.st < .2 && !hero.hitDone) for (const e of foes) if (e.shown && !e.ghost && e.state !== 'down' && e.panel === hero.panel && inReach(hero, e)) { heroHits(e); break; }
    if (hero.grounded) hero.vx *= .9;
    if (hero.st > .34) hero.set(hero.grounded ? 'idle' : 'jump');
  }
  if (hero.state === 'hurt' && hero.st > .32) hero.set('idle');
}
function playEnemy(e, dt) {
  if (!e.ai || e.hop) return;
  const dx = hero.x - e.x, dist = Math.abs(dx), level = Math.abs(hero.y - e.y) < 1.2;
  switch (e.state) {
    case 'idle': case 'walk':
      e.face = Math.sign(dx) || e.face;
      if (dist > e.reach - .3) { const ok = floorAt(e.panel, e.x + e.face * .7, e.y) >= e.y - .3 && !e.panel.plats.some(b => b.solid && e.y < b.top - .25 && e.x + e.face * .9 > b.x0 && e.x + e.face * .9 < b.x1);
        if (ok) { e.set('walk'); e.vx = e.face * e.speed; } else { e.set('idle'); e.vx = 0; } }
      else { e.set('idle'); e.vx = 0; e.wait -= dt; if (e.wait <= 0 && level && hero.state !== 'down') e.set('wind'); }
      break;
    case 'wind': e.vx = 0; if (e.st > e.windT) { e.set('strike'); e.struck = false; } break;
    case 'strike':
      if (!e.struck && e.st > .04 && hero.inv <= 0 && hero.state !== 'down' && inReach(e, hero)) { e.struck = true; hurtHero(e.face, 'THWACK!'); }
      if (e.st > .3) { e.set('idle'); e.wait = .6 + Math.random() * .9; }
      break;
    case 'hurt': if (e.st > .32) { e.set('idle'); e.wait = .3 + Math.random() * .5; } break;
  }
}
function arm(e, o = {}) { Object.assign(e, { reach: 2.05, windT: .42, speed: 2.5 }, o); e.free = false; e.ai = true; e.relaxed = false; e.ghost = false; e.wait = o.wait || 1.1; if (!foes.includes(e)) foes.push(e); }
function startAction(text) { hudOn = true; hud(); control = true; hero.free = false; hero.relaxed = false; hint(text); }
async function endAction() { control = false; hudOn = false; hud(); hint(''); hero.vx = 0; hero.relaxed = true; await until(() => hero.grounded && !hero.busy); hero.set('idle'); foes = []; }
async function heroEnters(p, to = 2.4, y = 0) { spawn(hero, p, -1.4, { y, relaxed: true }); await walkTo(hero, p.x0 + to, 3.2); hero.face = 1; }
async function diveAfter(p, x, text) { control = false; hero.vx = 0; await until(() => hero.grounded && !hero.busy); hero.set('idle'); hint(text); pressed.jump = false; let t = 0;
  await until(dt => pressed.jump || (AUTO && (t += dt) > .6)); hint(''); await hop(hero, p, x, { h: 2.8, dur: .7 }); hero.face = 1; }

// things in the frames that are not people
function dropCrate(p, x, y) { const mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), clipMat({ map: tex(blockCanvas('crate', 1.3, 1.3, 2)) }, p.ref)));
  mesh.renderOrder = p.charOrder + .1; drops.push({ mesh, p, x, y, vy: 0 }); }
function addSpot(p, r, pos) { const mesh = put(new THREE.Mesh(new THREE.CircleGeometry(r, 48), clipMat({ color: 0xfff3b0, opacity: .26, blending: THREE.AdditiveBlending }, p.ref)));
  mesh.renderOrder = p.base + 17; spot = { mesh, p, r, pos, heat: 0 }; }
function addFork(p) { const mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(5.6, 4.4), clipMat({ map: tex(forkliftCanvas()), side: THREE.DoubleSide }, p.ref)));
  mesh.renderOrder = p.charOrder + .2; mesh.visible = false; fork = { mesh, p, x: 0, vx: 0 }; }
function things(dt) {
  for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.vy -= 22 * dt; d.y += d.vy * dt; d.mesh.position.set(d.x, d.p.y0 + GROUND + d.y + .65, ZACT); d.mesh.rotation.z += dt * 2;
    const hit = hero.panel === d.p && hero.shown && hero.inv <= 0 && hero.state !== 'down' && Math.abs(hero.x - d.x) < .95 && d.y < hero.y + 3 && d.y > hero.y - .4;
    if (hit) hurtHero(Math.sign(hero.x - d.x) || 1, 'KLONK!');
    if (hit || d.y < hero.y - 9 || d.y < -GROUND - 2) { scene.remove(d.mesh); drops.splice(i, 1); } }
  if (spot) { const [lx, ly] = spot.pos(time), sx = spot.p.x0 + lx, sy = spot.p.y0 + ly; spot.mesh.position.set(sx, sy, ZACT + .05);
    const inside = control && hero.panel === spot.p && Math.hypot(hero.x - sx, hero.wy + 1.7 - sy) < spot.r;
    if (spot.heat < 0) spot.heat += dt; else if (inside) spot.heat += dt; else spot.heat = Math.max(0, spot.heat - dt);
    if (spot.heat > .45) { spot.heat = -2.2; burst('SPOTTED!', hero.x, hero.wy + 4.2, .7, 1); dropCrate(spot.p, hero.x + hero.vx * .45, hero.y + 9); } }
  if (fork && fork.vx) { const f = fork; f.x += f.vx * dt; f.mesh.visible = true; f.mesh.position.set(f.x, f.p.y0 + GROUND + 2.05, ZACT + .02); f.mesh.scale.x = f.vx < 0 ? 1 : -1;
    if (hero.panel === f.p && hero.inv <= 0 && hero.state !== 'down' && Math.abs(hero.x - f.x) < 1.9 && hero.y < 1.2) { hurtHero(Math.sign(f.vx), 'WHAM!'); hero.vy = 7; hero.vx = Math.sign(f.vx) * 7; }
    for (const e of chars) if (e !== hero && e.panel === f.p && e.shown && e.state === 'down' && Math.abs(e.x - f.x) < 2) { e.x = f.x + Math.sign(f.vx) * 2; if (e.x < f.p.x0 - 1.5 || e.x > f.p.x1 + 1.5) e.shown = false; } }
}

// ---------- the level, page by page, written out like a script
async function page1() {
  for (const id of ['1.1', '1.2', '1.3', '1.4', '1.5']) await storyFrame(id);
  const p = P['1.6']; enterPanel(p);
  await heroEnters(p, 2.2, 2.6);
  startAction('Arrow keys to run  •  Space to jump'); hudOn = false; hud();
  wait(1.5).then(() => radio("Clock's running, kid."));
  await until(() => hero.x > p.x0 + 18.9 && hero.grounded);
  control = false; hint(''); hero.noRespawn = true; hero.free = true; hero.face = 1; hero.vx = 4.4; hero.set('walk');
  await until(() => !hero.grounded); hero.vx = 1.4;
  await until(() => hero.gone);
  await storyFrame('1.7', .5);
}

async function page2() {
  const a = P['2.1'], b = P['2.3'], c = P['2.4'], d = P['2.5'];
  enterPanel(a);
  spawn(hero, a, -1.4, { relaxed: true }); spawn(thug, a, a.w + 1.4, { face: -1, shown: false, relaxed: true, hp: 4 });
  await wait(1.2); caption(a, 'The docks. 11:42 PM.');
  await walkTo(hero, a.x0 + 3.4, 2.6);
  await say(hero, 'Pier 27.\nAlmost there...', 'thought');
  hero.free = false; control = true; hint('Arrow keys to walk');
  await until(() => hero.x > a.x0 + 5.4);
  control = false; hint(''); hero.vx = 0; hero.set('idle'); hero.face = 1;
  thug.shown = true; await walkTo(thug, a.x1 - 2.7, 2.4); thug.face = -1;
  await say(thug, 'End of the line, kid.\nHand over the package.');
  await say(hero, 'Sorry. It needs\na signature.');
  await say(thug, 'Why do they always\ntalk back...', 'thought');
  await storyFrame('2.2', .6);
  hero.shown = thug.shown = false;
  // round one
  enterPanel(b); caption(b, 'Pier 27. No witnesses.');
  spawn(thug, b, 11.5, { face: -1, hp: 4 }); thug.knockTo = { p: c, dir: 0, word: 'KRASH!' };
  await heroEnters(b, 2.4); await wait(.3);
  arm(thug); startAction('J or X to punch  •  Space to jump');
  await until(() => thug.flown && !thug.hop); thug.flown = false;
  await diveAfter(c, clamp(thug.x - 4.5, c.x0 + 5, c.x1 - 3), 'Space: jump down after him');
  // round two
  thug.set('idle'); thug.hp = 2; arm(thug, { wait: .9 }); startAction('');
  spawn(goon, c, -1.4, { hp: 4 }); goon.ghost = true; goon.guard = () => thug.state !== 'down'; goon.knockTo = { p: d, dir: -1, fx: d.cx, y: d.h * .3, hide: true };   // Slim comes in behind Milo
  wait(2).then(async () => { await walkTo(goon, c.x0 + 2.3, 3); shout(goon, "Hey! That's\nmy brother!", 1.7); arm(goon, { wait: 1.2 }); });
  await until(() => goon.flown && !goon.hop);
  await endAction();
  await storyFrame('2.5', .1);
  await storyFrame('2.6'); await storyFrame('2.7');
}

async function page3() {
  if (QS.get('frame') !== '3.7') await page3a();
  await page3b();
}
async function page3a() {
  await storyFrame('3.1');
  const a = P['3.2'], b = P['3.3'];
  enterPanel(a);
  spawn(w1, a, a.w - 3.4, { face: -1, hp: 3 }); spawn(w2, a, -1.4, { hp: 3, shown: false });
  w2.guard = () => w1.state !== 'down'; w2.knockTo = { p: b, dir: -1, word: 'THUD!' };
  await heroEnters(a, 4.6);
  shout(w1, "Yard's closed,\ncourier.", 1.8); await wait(1.3);
  arm(w1, { reach: 2.7, windT: .55, speed: 2.2 }); wait(2.2).then(async () => { w2.shown = true; w2.ghost = true; await walkTo(w2, a.x0 + 1.6, 3); arm(w2, { reach: 2.7, windT: .55, speed: 2.0 }); });   // the second one boxes him in from behind
  startAction('Pipes reach further: step back, then hit');
  await until(() => w2.flown && !w2.hop);
  await diveAfter(b, b.x0 + 8, 'Space: jump down after him');
  // the forklift
  addFork(b); startAction('Jump up on the crates!'); foes = [];
  burst('VRRROOOM', b.cx + 2, b.y0 + GROUND + 4.6, .9, 2, 1.2); await wait(.9);
  fork.x = b.x1 + 4; fork.vx = -8.5; await until(() => fork.x < b.x0 - 4); fork.vx = 0;
  shout(hero, 'Okay.\nNot closed.', 1.5); await wait(1.5);
  fork.x = b.x0 - 4; fork.vx = 9.5; await until(() => fork.x > b.x1 + 4); fork.vx = 0;
  hint('Keep going  ▶');
  await until(() => hero.x > b.x1 - 1.3 && hero.grounded && !hero.busy);
  await endAction(); await walkTo(hero, b.x1 + 1.6, 4); hero.shown = false;
  await storyFrame('3.4'); await storyFrame('3.5'); await storyFrame('3.6');
}
async function page3b() {   // over the top
  const c = P['3.7']; enterPanel(c);
  spawn(w3, c, 24.5, { y: 1.4, face: -1, hp: 3 });
  await heroEnters(c, 2.2, .6);
  arm(w3, { reach: 2.7, windT: .55, speed: 2.0 });
  addSpot(c, 2.3, t => [20 + 13 * Math.sin(t * .55), GROUND + 3.6]);
  startAction('Run the container tops  •  stay out of the light');
  wait(2).then(() => radio('Six minutes, Milo.'));
  await until(() => hero.x > c.x1 - 2.4 && hero.grounded && !hero.busy);
  control = false; hint(''); hero.noRespawn = true; hero.free = true; hero.face = 1; hero.vx = 5.5; hero.vy = 11; hero.grounded = false; hero.set('jump');
  await until(() => hero.x > c.x1 + 1.6 || hero.gone); hero.shown = false; hudOn = false; hud();
}

async function page4() {
  const a = P['4.1']; enterPanel(a);
  await heroEnters(a, 2.4);
  caption(a, 'Crane 4. 11:55 PM.');
  await say(hero, "Don't look down.", 'thought');
  addSpot(a, 2.1, t => [a.w / 2 + 3 * Math.sin(t * .9), GROUND + 10.5 + 8.5 * Math.sin(t * .37)]);
  startAction('Space to jump up  •  stay out of the light');
  await until(() => hero.y > 18.5 && hero.grounded);
  await endAction(); spot.mesh.visible = false; spot = null; await wait(.4);
  await storyFrame('4.2'); hero.shown = false; await storyFrame('4.3');
  // the boss, part one
  const b = P['4.4'], c = P['4.5']; enterPanel(b);
  spawn(gage, b, b.w - 6, { face: -1, hp: 6 }); gage.knockTo = { p: c, dir: 0, word: 'KLANG!' };
  await heroEnters(b, 2.6);
  shout(gage, 'You should have dropped\nit at the gate.', 2); await wait(1.4);
  arm(gage, { reach: 3.4, windT: .7, speed: 2.0 });
  startAction('The hook is slow: dodge it, then hit');
  await until(() => gage.flown && !gage.hop); gage.flown = false;
  await diveAfter(c, clamp(gage.x - 4.5, c.x0 + 2, c.x1 - 3), 'Space: jump down after him');
  // part two
  gage.set('idle'); gage.hp = 5; shout(gage, "I'll throw you in\nthe harbor myself!", 1.8);
  arm(gage, { reach: 2.05, windT: .3, speed: 3.6, wait: 1.4 }); startAction('');
  await until(() => gage.state === 'down' && gage.grounded);
  await wait(.8); await endAction();
  await storyFrame('4.6');
}

async function page5() {
  for (const id of ['5.1', '5.2', '5.3', '5.4']) await storyFrame(id);
  enterPanel(P['5.5'], .5); await wait(1.8);
  await storyFrame('5.6', 1.2);
  focusPanel(null); frameId = 'end'; for (const q of panels) q.want = 1;
  hint(`End of ${LEVEL.series} #${LEVEL.issue}, "${LEVEL.title}".  To be continued...  Press R to read it again`);
}
const PAGES = [page1, page2, page3, page4, page5];

async function turnPage(n) {
  const pg = LEVEL.pages[n], w = $('wipe');
  $('wipeT').innerHTML = `Page ${n + 1}<small>${pg.title}  -  ${pg.time}</small>`;
  w.style.transition = ''; w.offsetWidth; w.style.transform = 'translateX(0)';
  await wait(.6); clearPage(); await buildPage(n);
  Object.assign(view, { cx: PAGE.w / 2, cy: PAGE.h / 2, D: 80 });
  await wait(.7); w.style.transform = 'translateX(-105%)';
  wait(.6).then(() => { w.style.transition = 'none'; w.style.transform = 'translateX(105%)'; });
}
async function run(start) {
  for (let n = start; n < PAGES.length; n++) { if (n > start) await turnPage(n); await PAGES[n](); await wait(.6); }
}

// ---------- every frame
const v3 = new THREE.Vector3();
const scr = (x, y, z = 0) => { v3.set(x, y, z).project(camera); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; };

function frame(dtReal) {
  const dtR = Math.min(dtReal, .05); time += dtR;
  let dt = dtR; if (hitstop > 0) { hitstop -= dtR; dt = 0; }
  for (let i = waits.length - 1; i >= 0; i--) if (waits[i].fn(dt)) { const w = waits[i]; waits.splice(i, 1); w.r(); }
  if (dt > 0) { playHero(); for (const e of foes) playEnemy(e, dt); for (const c of chars) c.tick(dt, time); things(dt); }
  if (dt > 0) for (const e of foes) {   // fighters can't stand inside each other
    if (!e.shown || e.ghost || e.hop || e.state === 'down' || hero.state === 'down' || e.panel !== hero.panel || Math.abs(hero.y - e.y) > 1.6) continue;
    const dx = hero.x - e.x, gap = 1.05;
    if (Math.abs(dx) < gap) { const push = (gap - Math.abs(dx)) * (dx >= 0 ? 1 : -1); hero.x += push * .6; e.x -= push * .4; }
  }
  for (const k in pressed) pressed[k] = false;

  // focus: the active frame sharpens, the rest fall soft; teasers fade once a frame is reached
  const kf = 1 - Math.exp(-dtR * 4);
  for (const p of panels) { p.focus += (p.want - p.focus) * kf; p.tease += ((p.seen ? 0 : 1) - p.tease) * kf;
    for (const m of p.mats) m.uniforms.focus.value = p.focus; if (p.teaser) p.teaser.uniforms.alpha.value = p.tease;
    for (const m of p.blocks) m.color.setScalar(.6 + .4 * p.focus); }
  for (const m of rainMats) m.uniforms.off.value.set(-time * .35 % 1, time * 1.7 % 1);

  // camera: frame the active panel, lean with the hero so the depth shifts
  const fp = focusOn.panel, th = Math.tan(FOV * Math.PI / 360), asp = camera.aspect;
  let gx = PAGE.w / 2, gy = PAGE.h / 2, gD = Math.max(PAGE.h / (2 * th), PAGE.w / (2 * th * asp)) / .95, gox = -.14;
  if (fp) {
    const eye = focusOn.eye ? focusOn.eye() : (hero.panel === fp && hero.shown ? [hero.x, hero.wy + 1.8] : null), tr = fp.def.track;
    const Dh = fp.h / (2 * th), Dw = fp.w / (2 * th * asp); let f = 0; gx = fp.cx; gy = fp.cy;
    if (tr === 'x' && Dw > Dh / .6) { gD = Dh / .6; const hv = gD * th * asp * .82; gx = clamp(eye ? eye[0] : fp.cx, fp.x0 + hv, fp.x1 - hv); f = (gx - fp.cx) / (fp.w / 2); }
    else if (tr === 'y' && Dh > Dw / .4) { gD = Dw / .4; const hv = gD * th * .82; gy = clamp(eye ? eye[1] : fp.cy, fp.y0 + hv, fp.y1 - hv); }
    else { gD = Math.max(Dh, Dw) / focusOn.fill; if (eye) { f = clamp((eye[0] - fp.cx) / (fp.w / 2), -1, 1); gx = fp.cx + f * fp.w * .06; } }
    gox = -.14 + .09 * f;
  }
  const kc = 1 - Math.exp(-dtR * 3.2);
  view.cx += (gx - view.cx) * kc; view.cy += (gy - view.cy) * kc; view.D += (gD - view.D) * kc; view.ox += (gox - view.ox) * kc;
  shake *= Math.exp(-dtR * 9);
  const sx = (Math.random() - .5) * shake, sy = (Math.random() - .5) * shake;
  const ox = view.ox + Math.sin(time * .5) * .012, oy = -.09 + Math.cos(time * .4) * .008;
  camera.position.set(view.cx + ox * view.D + sx, view.cy + oy * view.D + sy, view.D);
  camera.up.set(Math.sin(ROLL), Math.cos(ROLL), 0);
  camera.lookAt(view.cx + sx, view.cy + sy, 0);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);

  // lettering rides on top, lined up with the tilted page
  const a = scr(view.cx, view.cy), b = scr(view.cx + 1, view.cy);
  const ppu = Math.hypot(b[0] - a[0], b[1] - a[1]), rot = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, sc = ppu * UNIT;
  for (const o of balloons) {
    if (o.c) { const c = o.c, p = c.panel; if (!p) continue; const rxW = o.b.rx * UNIT, ryW = o.b.ry * UNIT, headY = c.wy + 3.6;
      const bx = clamp(c.x + Math.sign(p.cx - c.x) * rxW * .55, p.x0 + rxW + .35, Math.max(p.x0 + rxW + .35, p.x1 - rxW - .35)), by = Math.min(headY + .6 + ryW, p.y1 - ryW - .35);
      const s = scr(bx, by, ZACT), t = scr(c.x + c.face * .15, headY + .1, ZACT); o.b.set(s[0], s[1], sc, rot, t[0], t[1]); }
    else { const s = scr(o.fx, o.fy), t = scr(o.tx, o.ty); o.b.set(s[0], s[1], sc * o.k, rot, t[0], t[1]); } }
  const visL = view.cx - view.D * th * asp * .9;
  for (const o of captions) { const p = o.p, x = p.def.track === 'x' && p === fp ? clamp(visL, p.x0 + .3, p.x1 - 9) : p.x0 + .3, s = scr(x, p.y1 - .3 - o.i * .95);
    o.b.set(s[0], s[1], sc * 1.15, rot, .55 + .45 * p.focus, (1 - p.focus) * 5); }
  for (let i = bursts.length - 1; i >= 0; i--) { const o = bursts[i]; o.t += dtR;
    const u = Math.min(1, o.t / .13), pop = 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2), s = scr(o.x, o.y, ZACT), fade = o.life - .22;
    o.b.set(s[0], s[1], sc * .92 * o.size * pop, rot + o.rot, o.t > fade ? Math.max(0, 1 - (o.t - fade) / .22) : 1);
    if (o.t > o.life) { o.b.remove(); bursts.splice(i, 1); } }
}

async function boot() {
  try { await Promise.race([Promise.all([document.fonts.load('italic 700 20px "Comic Neue"'), document.fonts.load('40px "Bangers"')]), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  try { const r = await fetch('./art/manifest.json', { cache: 'no-store' }); if (r.ok) manifest = await r.json(); } catch (e) {}
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(PAGE.w, PAGE.h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(paperCanvas()), transparent: true, depthTest: false, depthWrite: false }));
  paper.position.set(PAGE.w / 2, PAGE.h / 2, 0); paper.renderOrder = 0; scene.add(paper);
  L = new Lettering($('ink'));
  hero = new Char('hero'); thug = new Char('thug'); goon = new Char('goon'); w1 = new Char('worker'); w2 = new Char('worker'); w3 = new Char('worker'); gage = new Char('gage');
  chars = [hero, thug, goon, w1, w2, w3, gage]; hero.hp = 5;
  const sheets = {};
  for (const c of chars) { const cfg = (manifest.sprites || {})[c.kind]; if (!cfg) continue;
    if (!sheets[c.kind]) { const s = sheets[c.kind] = {}; const img = await loadImage('./art/' + cfg.file);
      if (img) { try { s.sprites = sliceSprites(img, cfg); } catch (e) { console.error(e); } }
      if (cfg.walk && s.sprites) { const im2 = await loadImage('./art/' + cfg.walk.file);
        if (im2) { try { Object.assign(s.sprites, sliceSprites(im2, cfg.walk)); s.cycle = cfg.walk.cycle; } catch (e) { console.error(e); } } } }
    if (sheets[c.kind].sprites) { c.pup.sprites = sheets[c.kind].sprites; if (sheets[c.kind].cycle) c.pup.cycle = sheets[c.kind].cycle; } }
  const start = clamp((parseInt(QS.get('page')) || 1) - 1, 0, PAGES.length - 1);
  await buildPage(start);
  let last = performance.now();
  const loop = now => { frame((now - last) / 1000); last = now; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  window.__game = { hero, chars, view, keys, pressed, focusPanel, get P() { return P; }, get panels() { return panels; }, get foes() { return foes; },
    get at() { return { page: pageNo + 1, frame: frameId, control, hp: hero.hp, x: +(hero.x - (hero.panel ? hero.panel.x0 : 0)).toFixed(2), y: +hero.y.toFixed(2), state: hero.state }; } };
  await wait(1.2);
  run(start).catch(e => console.error(e));
}
boot().catch(e => { const d = $('err'); d.style.display = 'flex'; d.textContent = 'The game could not start:\n' + (e && e.stack || e); console.error(e); });
