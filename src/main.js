// Comic-book game, level 1. The level map lives in level1.js (pages, frames, shots,
// lettering). This file turns that map into pages you read and play through:
// story frames you tap through, action frames you play in, knock-throughs from one
// frame into another, and page turns.
import * as THREE from 'three';
import { panelLayers, paperCanvas, rainCanvas, blurred, loadImage, artLayer, blockCanvas, forkliftCanvas } from './art.js';
import { Puppet, STYLES, poseFor, lerpPose, frameFor, sliceSprites, CW, CH, BASE, PPU } from './puppet.js';
import { Lettering } from './letters.js';
import { LEVEL } from './level1.js';
const OPEN = LEVEL.pages.filter(q => q.label).length;   // pages before page 1: the prologue and tonight's earlier route

const PAGE = { w: 42, h: 27 };
const SOFT = .28;   // how soft the frames out of focus are (1 = the old heavy blur)
const GROUND = 1.25, ZACT = -.5, UNIT = .022, ROLL = .07, FOV = 35;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = id => document.getElementById(id);
const QS = new URLSearchParams(location.search), AUTO = QS.has('auto');

// What the action frames are made of. Platforms: [left, right, top, look, solid], measured
// from the frame's left edge and from its ground line. Stand-in scenery until art replaces it.
const G = [-60, 100, 0, null, false];
const landings = []; for (let i = 1; i <= 11; i++) landings.push(i % 2 ? [4.5, 9.2, i * 1.55, 'steel', false] : [.6, 5.3, i * 1.55, 'steel', false]);
landings.push([.6, 9.2, 12 * 1.55, 'steel', false]);
const fire = []; for (let i = 1; i <= 11; i++) fire.push(i % 3 === 0 ? (i % 2 ? [6.2, 9.2, i * 1.55, 'steel', false] : [.6, 3.6, i * 1.55, 'steel', false]) : landings[i - 1]);   // some flights have rusted away
fire.push([.6, 9.2, 12 * 1.55, 'steel', false]);
const FLOOR = [-60, 100, 0, 'steel', false];
const GAME = {
  'P0.1': { track: 'x' },
  'P0.2': { scene: 'roofs', seed: 61, plats: [[-6, 9.4, 2.2, 'roof'], [11, 16.6, 2.2, 'roof'], [18, 30, 3, 'roof']] },
  'P0.3': { plats: [FLOOR] },
  'P0.4': { scene: 'neon', seed: 64, plats: [G, [5.2, 7.2, 1, 'steel', false], [7.2, 9.4, 2, 'steel', false], [9.4, 24, 3, 'steel', false], [27.1, 45, 3, 'steel', false], [27.6, 29, 1.1, 'crate', false], [29.6, 33, 2.2, 'container']] },
  'P0.5': { scene: 'alley', plats: [G] },
  'R.2': { scene: 'neon', seed: 72, plats: [G, [6, 7.6, .95, 'crate', false], [8.4, 20.6, 1.9, 'steel', false]] },
  'R.5': { scene: 'alley', plats: [G, [4.6, 6.4, 1, 'crate', false], [7, 9.6, 1.9, 'crate', false], [11.4, 14.4, 1.9, 'crate', false], [16.2, 18.6, 1.9, 'crate', false]] },
  '7.6': { scene: 'dock', plats: [[-60, 22, 0, 'steel', false]] },
  '1.1': { track: 'x' },
  '1.6': { scene: 'roofs', seed: 12, plats: [[-6, 4.6, 2.6, 'roof'], [6.1, 10.1, 1.8, 'roof'], [12.1, 15.6, 2.2, 'roof'], [18.1, 26, 1.2, 'roof']] },
  '1.7': { scene: 'roofs', seed: 17, plats: [[-6, 5.6, -.75, 'roof'], [8.2, 9.6, -.2, 'steel', false], [12.6, 30, -.75, 'steel', false]] },
  '2.1': { scene: 'city', seed: 21, track: 'y', plats: [FLOOR, ...fire] },
  '2.3': { scene: 'neon', seed: 23, plats: [[-4, 3.4, -.3, 'roof'], [4.8, 8.2, -.3, 'roof'], [9.9, 12.6, -.3, 'roof'], [14.2, 30, -.3, 'roof']] },
  '2.4': { plats: [FLOOR] },
  '3.2': { seed: 32 },
  '3.4': { scene: 'neon', seed: 34, plats: [FLOOR, [2.6, 5.4, 1.3, 'crate'], [6.4, 9.2, 1.3, 'crate'], [10.3, 13.7, 1.0, 'crate'], [14.9, 19.5, 2.5, 'container'], [20.7, 27.4, 2.9, 'container']] },
  '3.6': { scene: 'alley', plats: [G, [4.6, 5.1, 1.5, 'crate'], [8.2, 10.2, 1.3, 'crate']] },
  '4.1': { scene: 'alley' }, '4.3': { scene: 'dock' }, '4.4': { scene: 'dock' },
  '5.2': { scene: 'yard', seed: 31, floor: 1.25 },
  '5.3': { scene: 'yard', seed: 33, floor: 1.25, plats: [G, [4.4, 6.4, 1.6, 'crate'], [9.4, 11.4, 1.6, 'crate']] },
  '5.7': { scene: 'yard', seed: 37, plats: [[-6, 5.5, .6, 'container'], [5.5, 11, 1.8, 'container'], [11, 16.5, .9, 'container'], [17.9, 32, 1.4, 'container']] },
  '5.8': { scene: 'yard', seed: 38, plats: [[-6, 3.6, 1.4, 'container'], [5.0, 8.4, 2.0, 'container'], [10.0, 14, 2.6, 'container']] },
  '6.1': { scene: 'crane', seed: 41, track: 'y', plats: [FLOOR, ...landings] },
  '6.3': { scene: 'crane', seed: 43, plats: [[-4, 4.6, .8, 'steel', false], [6.2, 10.4, .8, 'steel', false], [12, 15.6, .8, 'steel', false], [17.2, 30, .8, 'steel', false]] },
  '6.5': { scene: 'crane', seed: 44, plats: [[-60, 6, 0, 'steel', false], [8.6, 100, 0, 'steel', false]] },   // a section of the walkway is missing
  '6.6': { scene: 'crane', seed: 45, plats: [FLOOR] },
  '7.1': { scene: 'dock', plats: [G, [6, 7, .7, 'crate'], [11, 12.2, .9, 'crate'], [16, 17, .7, 'crate']] },
  '7.7': { scene: 'end', text: 'TO BE CONTINUED...' },
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
  uniforms: { map: { value: map }, mapB: { value: mapB }, focus: { value: 0 }, dim: { value: .84 }, alpha: { value: 1 }, off: { value: new THREE.Vector2() }, rep: { value: new THREE.Vector2(1, 1) } },
  vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false,
  stencilWrite: true, stencilRef: ref, stencilFunc: THREE.EqualStencilFunc });
const clipMat = (o, ref) => new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, stencilWrite: true, stencilRef: ref, stencilFunc: THREE.EqualStencilFunc, ...o });

let panels = [], P = {}, rainMats = [], L, manifest = {}, pageNo = 0, frameId = '';
let hero, thug, goon, w1, w2, w3, gage, tax1, tax2, cor1, cor2, brick, keeper, chars = [], foes = [], onDown = null;
const imgCache = {};
const put = m => { scene.add(m); pageObjs.push(m); return m; };

async function buildPage(n) {
  pageNo = n; panels = []; P = {}; rainMats = [];
  const defs = LEVEL.pages[n].panels.map(d => ({ sharp: true, scene: d.kind === 'caption' ? 'end' : 'storyph', seed: Math.round(parseFloat(d.id) * 10), ...d, ...(GAME[d.id] || {}) }));
  const artFor = {};
  for (const d of defs) { const a = (manifest.panels || {})[d.id]; if (!a) continue; artFor[d.id] = {};
    for (const k in a) if (k === 'lettered') d.lettered = true; else if (k === 'poi') artFor[d.id].poi = a.poi; else artFor[d.id][k] = imgCache[a[k]] || (imgCache[a[k]] = await loadImage('./art/' + a[k])); }
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
      const mat = layerMat(tex(ly.canvas), tex(blurred(ly.canvas, ly.blur * SOFT)), ref), mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(ly.plane.w, ly.plane.h), mat));
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
    if (art && art.teaser) { const ly = artLayer(def, art.teaser, .3), mat = layerMat(tex(ly.canvas), tex(blurred(ly.canvas, ly.blur * SOFT)), ref);
      const mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(ly.plane.w, ly.plane.h), mat)); mesh.position.set(cx, cy + ly.plane.cy, -ly.d); mesh.renderOrder = base + 16;
      p.mats.push(mat); p.teaser = mat; }
    if (def.kind !== 'caption') {
      const mat = layerMat(rainTex, rainTex, ref); mat.uniforms.rep.value.set(w / 6, h / 6);
      const mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(w + 1.2, h + 1.2), mat)); mesh.position.set(cx, cy, -.1); mesh.renderOrder = base + 18;
      p.mats.push(mat); rainMats.push(mat);
    }
    // the border: plain and straight; the soft edges of the screen (the vignette in index.html) blur it away from the centre
    { const bw = w + 2 * BPAD, bh = h + 2 * BPAD; p.border = [];
      for (const [cv, o] of [[borderCanvas(w, h, .17), 900]]) { const mat = new THREE.MeshBasicMaterial({ map: tex(cv), transparent: true, depthTest: false, depthWrite: false });
        const m = put(new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), mat)); m.position.set(cx, cy, 0); m.renderOrder = o; p.border.push(mat); } }
    P[def.id] = p; return p;
  });
}
const BPAD = .6;
// a plain straight border; `t` is its thickness. The out-of-focus copy is drawn a little heavier and then blurred, so it stays black instead of washing out to grey.
function borderCanvas(w, h, t) { const k = 44, c = document.createElement('canvas'); c.width = Math.round((w + 2 * BPAD) * k); c.height = Math.round((h + 2 * BPAD) * k);
  const g = c.getContext('2d'); g.strokeStyle = '#0d0a12'; g.lineWidth = t * k; g.strokeRect(BPAD * k, BPAD * k, w * k, h * k); return c; }
function clearPage() {
  for (const m of pageObjs) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  for (const t of pageTex) t.dispose();
  pageObjs = []; pageTex = [];
  for (const o of balloons) o.b.remove(); for (const o of captions) o.b.remove(); for (const o of bursts) o.b.remove();
  balloons.length = captions.length = bursts.length = drops.length = 0; spot = null; fork = null; xing = null; foes = [];
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
    if (this === hero && !this.noRespawn && this.safe) { this.x = this.safe.x; this.y = this.safe.y; this.vx = this.vy = 0; this.inv = 1.3; this.grounded = true; this.set('idle'); lose(5); return; }
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
      if (!this.free) { const m = this === hero ? .7 : 1.9; this.x = clamp(this.x, p.x0 + m, p.x1 - m); }   // foes stop short of the frame edge, so Milo can always get round behind them
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
    const f = this.hop ? 1 : this.panel.focus; this.mat.color.setScalar(.84 + .16 * f);
  }
}
function spawn(c, p, lx, o = {}) { c.setPanel(p); c.x = p.x0 + lx; c.y = o.y || 0; c.vx = c.vy = 0; c.hop = null; c.gone = false; c.shown = o.shown !== false; c.grounded = true;
  c.face = o.face || 1; c.state = 'idle'; c.st = 0; c.ai = false; c.free = true; c.ghost = false; c.relaxed = !!o.relaxed; c.knockTo = null; c.guard = null; c.spin = 0; c.snatch = c.hasCase = false; c.heavy = false;
  if (o.hp) c.hp = o.hp; c.wx = c.x; c.wy = p.y0 + GROUND + c.y; if (c === hero) { c.safe = { x: c.x, y: c.y }; c.noRespawn = false; } }

// ---------- input
const keys = {}, pressed = {};
const MAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', ArrowDown: 'down', KeyS: 'down',
  KeyJ: 'punch', KeyX: 'punch', KeyK: 'block', KeyC: 'block', KeyL: 'dodge', KeyV: 'dodge', ShiftLeft: 'dodge', Enter: 'ok' };
const QUIET = { left: 1, right: 1, down: 1, block: 1, dodge: 1 };   // keys that never turn a story page
addEventListener('keydown', e => { if (e.code === 'KeyR') location.reload(); const k = MAP[e.code]; if (!k) return; e.preventDefault();
  if (!keys[k]) { pressed[k] = true; if (!QUIET[k]) pressed.ok = true; } keys[k] = true; });
addEventListener('keyup', e => { const k = MAP[e.code]; if (k) keys[k] = false; });
$('gl').addEventListener('pointerdown', () => { pressed.ok = true; });
for (const [id, k] of [['bL', 'left'], ['bR', 'right'], ['bJ', 'jump'], ['bP', 'punch'], ['bD', 'down'], ['bB', 'block'], ['bG', 'dodge']]) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; pressed[k] = true; if (!QUIET[k]) pressed.ok = true; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { keys[k] = false; });
}

// ---------- little helpers for scripting the scenes
const waits = [];
const until = fn => new Promise(r => waits.push({ fn, r }));
const wait = s => { let t = 0; return until(dt => (t += dt) >= s); };
const hint = s => { const h = $('hint'); h.textContent = s || ''; h.style.opacity = s ? 1 : 0; };
function hud() { const h = $('hud'); h.style.display = hudOn ? 'block' : 'none'; if (!hero) return;
  h.innerHTML = '<b>MILO</b>' + '&#9829;'.repeat(Math.max(0, hero.hp)) + '<i>' + '&#9829;'.repeat(5 - Math.max(0, hero.hp)) + '</i>'; }

// The clock: starts when Milo takes the case and only runs while the player is playing.
const clock = { on: false, t: 0, par: 480, mins: 36, base: 23 * 60 + 24, tip: true, shown: '' }, spm = () => clock.par / clock.mins;   // real seconds of play per story minute
function setClock(mins, par, h, m) { Object.assign(clock, { on: true, t: 0, mins, par, base: h * 60 + m, tip: true }); }
function stopClock() { clock.on = false; clock.t = 0; }
// the money: every delivery pays into it
const wallet = { cash: 0, log: [] };
async function payout(label, amount, note) { wallet.cash += amount; wallet.log.push([label, amount]); const c = $('cash'); c.textContent = 'TONIGHT  $' + wallet.cash; c.style.display = 'block';
  hint(`${label}:  ${amount > 0 ? '+$' + amount : '$0'}${note ? '  •  ' + note : ''}`); await wait(AUTO ? 1.2 : 2.8); hint(''); }
const fastPay = (base, bonus) => { const early = clock.t <= clock.par; return [base + (early ? bonus : -Math.round(base / 4)), early ? 'early: bonus' : 'late: pay docked']; };
function clockTime() { const m = Math.floor(clock.base + clock.t / spm()), h = Math.floor(m / 60) % 24; return (h % 12 || 12) + ':' + String(m % 60).padStart(2, '0') + (h >= 12 ? ' PM' : ' AM'); }
function showClock() { const c = $('clock'); if (!clock.on && !clock.t) { if (clock.shown) { clock.shown = ''; c.style.display = 'none'; } return; }
  const left = Math.ceil(clock.mins - clock.t / spm()), s = clockTime() + '<small>' + (left > 0 ? left + ' min left' : 'LATE') + '</small>';
  if (s !== clock.shown) { clock.shown = s; c.innerHTML = s; c.style.display = 'block'; c.className = left <= 0 ? 'late' : left <= 5 ? 'near' : ''; } }
function lose(sec, x = hero.wx, y = hero.wy + 4.6) { if (!clock.on) return; clock.t += sec; burst('-' + sec + ' SEC', x, y, .7, 1, 1.1); }
function result() { const u = clock.t / clock.par, early = Math.floor(clock.mins - clock.t / spm());
  const pay = result.pay = (u <= 1 ? Math.round(300 - 200 * u) : Math.max(20, Math.round(100 - 240 * (u - 1)))) + (clock.tip && u <= 1 ? 50 : 0);
  return u <= 1 ? `Delivered at ${clockTime()}, ${early} min to spare. Pay $${pay}${clock.tip ? ' (with tip)' : ' (no tip: the case was snatched)'}` : `Delivered LATE at ${clockTime()}. Pay docked to $${pay}`; }

let xing = null, control = false, hudOn = false, time = 0, hitstop = 0, shake = 0, combo = 0, spot = null, fork = null;
const balloons = [], bursts = [], captions = [], drops = [];
const view = { cx: PAGE.w / 2, cy: PAGE.h / 2, D: 80, ox: .3 }, focusOn = { panel: null, fill: .74, eye: null };

// the subject of a frame's picture (marked per picture in the art list), so a small screen knows what to keep in shot
function poiOf(p) { const a = manifest.panels && manifest.panels[p.id]; return a && a.poi ? [p.x0 + a.poi[0] * p.w, p.y1 - a.poi[1] * p.h] : null; }
function focusPanel(p, fill = .74) { focusOn.panel = p; focusOn.fill = fill; focusOn.eye = null;
  for (const q of panels) { if (q === p || !p) { q.want = q === p ? 1 : 0; continue; }
    const dx = Math.max(0, q.x0 - p.x1, p.x0 - q.x1), dy = Math.max(0, q.y0 - p.y1, p.y0 - q.y1);   // the gap between the two frames
    q.want = Math.max(0, .5 - Math.hypot(dx, dy) / 22); } }   // next-door frames stay half sharp, far ones go fully soft
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
async function storyFrame(id, hold = .9, v) {
  const p = P[id], lines = v && p.def.variants && p.def.variants[v] ? p.def.variants[v].lines : p.def.lines; enterPanel(p, .8);
  if (p.def.track === 'x') { let u = 0; const a = poiOf(p), end = a ? (a[0] - p.x0) / p.w : .85, start = end > .5 ? .15 : .85;   // the pan ends on the subject
    focusOn.eye = () => { u = Math.min(1, u + .0022); const e = u * u * (3 - 2 * u); return [p.x0 + p.w * (start + (end - start) * e), a ? a[1] : p.cy]; }; }
  await wait(hold);
  let n = 0, cur = null, k = clamp(p.w / 12, .62, 1);
  for (const s of p.def.lettered ? [] : lines) { const l = parseLine(s);
    if (l.t === 'cap') { caption(p, l.text); await wait(.8); continue; }
    if (l.t === 'sfx') { burst(l.text, p.cx + (n % 2 ? -1 : 1) * p.w * .1, p.cy + p.h * .1, clamp(p.w / 11, .55, 1.3), 2, 1.3); shake = .4; await wait(.9); continue; }
    if (cur) dropBalloon(cur);
    const b = L.balloon(wrap(l.text), l.t), rxW = b.rx * UNIT * k, ryW = b.ry * UNIT * k;
    const fx = clamp(p.x0 + p.w * (n % 2 ? .66 : .34), p.x0 + rxW + .3, Math.max(p.x0 + rxW + .3, p.x1 - rxW - .3)), fy = p.y1 - ryW - .4;
    cur = { b, fx, fy, tx: fx + (p.cx - fx) * .4, ty: p.cy - p.h * .02, k }; balloons.push(cur); n++;
    await tap(); }
  if (!n) { if (p.def.auto) await wait(p.def.auto); else await tap(); }
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
  hero.hitDone = true; if (e.hasCase) { e.hasCase = false; e.hp = 1; burst('GOT IT BACK!', e.x, e.wy + 5, .8, 1, 1.2); hint(''); } e.hp--; combo++;
  if (e.hp <= 0 && e.guard && e.guard()) e.hp = 1;
  const pit = e.knockTo && e.knockTo.pit; if (pit && e.hp <= 0) e.hp = 1;   // he goes down the gap, not down to a punch
  if (e.hp <= 0 && e.knockTo) {   // he only leaves the frame the way the punch sends him
    const k = e.knockTo, f = hero.face, lo = k.p.x0 + 1.9, hi = k.p.x1 - 1.9; let tx = k.fx != null ? k.fx : clamp(e.x + f * 4.5, lo, hi), ok = !k.dir || f === k.dir;
    if ((tx - e.x) * f < 0) { if (k.fx != null) ok = false; else { tx = clamp(e.x, lo, hi); if (Math.abs(tx - e.x) > .6) ok = false; } }
    if (ok) k.x = tx; else { e.hp = 1; e.held = true; } }
  const x = hero.x + hero.face * 1.55, y = hero.wy + 3.1;
  if (e.hp <= 0) { hitstop = .17; shake = .6; burst('KRAKK!', x, y + .3, 1.25, 2);
    if (e.knockTo) knock(e); else { e.set('down'); e.vx = hero.face * 7.5; e.vy = 7; e.ai = false; } }
  else if (e.held) { e.held = false; e.set('hurt'); e.st = 0; e.vx = hero.face * 5; hitstop = .085; shake = .35; burst(WORDS[combo % WORDS.length], x, y, 1, 0);
    const kd = e.knockTo.dir || Math.sign(e.knockTo.p.cx - e.x);
    hint(kd < 0 ? 'Get behind him (jump over) and knock him  ◀  that way, into the next frame!' : 'Get behind him (jump over) and knock him that way  ▶  into the next frame!'); }
  else { e.set('hurt'); e.st = 0; e.vx = hero.face * (pit ? (e.hp <= 3 ? 6 : 1.5) : 3.6); hitstop = .085; shake = .35; burst(WORDS[combo % WORDS.length], x, y, 1, 0);
    if (pit && e.hp === 3) hint("He's reeling: now drive him back into the gap!"); }
}
function hurtHero(dir, word) {
  hero.hp--; hero.inv = .9; hero.vx = dir * 4.2; hitstop = .07; shake = .3;
  burst(word, hero.x, hero.wy + 2.7, .85, 1); hud();
  if (hero.hp <= 0 && onDown) { hero.set('down'); hero.vy = 6; const f = onDown; onDown = null; f(); }   // this time he stays down, and it costs him the package
  else if (hero.hp <= 0) { hero.set('down'); hero.vy = 6;
    lose(10); wait(1.7).then(() => { hero.hp = 5; hero.inv = 1.6; if (hero.state === 'down') hero.set('idle'); hud(); if (hero.shown) shout(hero, 'Not today.', 1.3); }); }
  else { hero.set('hurt'); hero.st = 0; }
}
function inReach(a, b) { const dx = (b.x - a.x) * a.face; return dx > .15 && dx < a.reach && Math.abs(a.y - b.y) < 1.5; }

function playHero() {
  if (xing && xing.live) return;
  let idle = hero.state === 'idle' || hero.state === 'walk';
  if (idle && !hero.grounded && !hero.hop) { hero.set('jump'); idle = false; }
  const air = hero.state === 'jump';
  if (control && (idle || air) && !hero.hop) {
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    hero.vx = dir * 4.4; if (dir) hero.face = dir;
    if (idle) hero.set(dir ? 'walk' : 'idle');
    if (idle && hero.grounded && pressed.dodge && time > (hero.cool || 0)) { hero.set('dodge'); hero.inv = Math.max(hero.inv, .36); hero.vx = -hero.face * 9; hero.cool = time + .75; }   // a quick step back out of reach
    else if (idle && hero.grounded && keys.block && !pressed.punch && !pressed.jump) { hero.set('block'); hero.vx = 0; }
    if (pressed.jump && idle && hero.grounded) { hero.vy = 10.5; hero.grounded = false; hero.set('jump'); }
    if (pressed.punch) { hero.set('punch'); hero.st = 0; hero.hitDone = false; if (hero.grounded) hero.vx = hero.face * 1.4; }
  } else if (!control && idle && !hero.free) hero.vx = 0;
  if (hero.state === 'punch') {
    if (hero.st > .07 && hero.st < .2 && !hero.hitDone) for (const e of foes) if (e.shown && !e.ghost && e.state !== 'down' && e.panel === hero.panel && inReach(hero, e)) { heroHits(e); break; }
    if (hero.grounded) hero.vx *= .9;
    if (hero.st > .34) hero.set(hero.grounded ? 'idle' : 'jump');
  }
  if (hero.state === 'hurt' && hero.st > .32) hero.set('idle');
  if (hero.state === 'block') { hero.vx *= .8; if (!keys.block || !control) hero.set('idle'); }
  if (hero.state === 'dodge') { hero.vx *= .93; if (hero.st > .26) hero.set('idle'); }
}
function playEnemy(e, dt) {
  if (!e.ai || e.hop) return;
  const dx = hero.x - e.x, dist = Math.abs(dx), level = Math.abs(hero.y - e.y) < 1.2;
  switch (e.state) {
    case 'idle': case 'walk':
      e.face = Math.sign(dx) || e.face;
      if (dist > e.reach - .3) { const ok = floorAt(e.panel, e.x + e.face * .7, e.y) >= e.y - .3 && !e.panel.plats.some(b => b.solid && e.y < b.top - .25 && e.x + e.face * .9 > b.x0 && e.x + e.face * .9 < b.x1);
        if (ok) { e.set('walk'); e.vx = e.face * e.speed; e.leapT = 0; } else { e.set('idle'); e.vx = 0;
          if (e.leaps && e.grounded && level && (e.leapT = (e.leapT || 0) + dt) > .55) { e.leapT = 0;   // he jumps the gap to get at Milo
            for (let d = .9; d < 5; d += .3) if (floorAt(e.panel, e.x + e.face * d, e.y) >= e.y - .3) { hop(e, e.panel, e.x + e.face * (d + 1.6), { h: 1.8, dur: .55 }); break; } } } }
      else { e.set('idle'); e.vx = 0; e.wait -= dt; if (e.wait <= 0 && level && hero.state !== 'down') e.set('wind'); }
      break;
    case 'wind': e.vx = 0; if (e.st > e.windT) { e.set('strike'); e.struck = false; } break;
    case 'strike':
      if (!e.struck && e.st > .04 && hero.state === 'dodge' && dist < e.reach + 2.6) { e.struck = true; burst('WHIFF!', e.x + e.face * 1.4, e.wy + 3.6, .8, 1, .8); e.set('hurt'); e.st = -.4; e.vx = e.face * 2; break; }   // he swings at air and is wide open
      if (!e.struck && e.st > .04 && hero.inv <= 0 && hero.state === 'block' && hero.face === -e.face && !e.heavy && inReach(e, hero)) { e.struck = true; burst('BLOCK!', hero.x + hero.face * .9, hero.wy + 3.2, .75, 0, .7); hero.vx = e.face * 2.6; hitstop = .05; shake = .15; }
      else if (!e.struck && e.st > .04 && hero.inv <= 0 && hero.state !== 'down' && inReach(e, hero)) { e.struck = true; hurtHero(e.face, e.snatch ? 'YOINK!' : hero.state === 'block' ? 'CRACK!' : 'THWACK!');
        if (e.snatch) { e.snatch = false; e.hasCase = true; e.ai = false; e.free = true; e.face = 1; e.vx = 3; e.set('walk'); hint('He has the case! Catch him and hit him!'); } }
      if (e.st > .3) { e.set('idle'); e.wait = .6 + Math.random() * .9; }
      break;
    case 'hurt': if (e.st > .32) { e.set('idle'); e.wait = .3 + Math.random() * .5; } break;
  }
}
function arm(e, o = {}) { Object.assign(e, { reach: 2.05, windT: .42, speed: 2.5, heavy: false }, o); e.free = false; e.ai = true; e.relaxed = false; e.ghost = false; e.wait = o.wait || 1.1; if (!foes.includes(e)) foes.push(e); }
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
// The avenue seen from above: lanes run up and down the frame and Milo crosses left to right.
const LANE0 = 3, LANEW = 3.2;
function roadCanvas(w, h) { const k = 40, c = document.createElement('canvas'); c.width = w * k; c.height = h * k; const g = c.getContext('2d');
  g.fillStyle = '#23263a'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#4b4763'; g.fillRect(0, 0, LANE0 * k, c.height); g.fillRect((LANE0 + 6 * LANEW) * k, 0, c.width, c.height);
  g.fillStyle = '#31344d'; g.fillRect((LANE0 + 4 * LANEW) * k, 0, LANEW * k, c.height);
  g.strokeStyle = '#8a8fa8'; g.lineWidth = 4; for (const u of [.25, .75]) { g.beginPath(); g.moveTo((LANE0 + (4 + u) * LANEW) * k, 0); g.lineTo((LANE0 + (4 + u) * LANEW) * k, c.height); g.stroke(); }
  g.strokeStyle = '#d8d2bd'; g.lineWidth = 3; g.setLineDash([k * .8, k * .6]);
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo((LANE0 + i * LANEW) * k, 0); g.lineTo((LANE0 + i * LANEW) * k, c.height); g.stroke(); }
  return c; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function carCanvas(len, col) { const k = 48, c = document.createElement('canvas'); c.width = 1.8 * k; c.height = len * k; const g = c.getContext('2d'), W2 = c.width, H2 = c.height;
  g.fillStyle = col; g.strokeStyle = '#0d0a12'; g.lineWidth = 5; rr(g, 4, 4, W2 - 8, H2 - 8, 14); g.fill(); g.stroke();
  g.fillStyle = '#10142c'; g.fillRect(W2 * .18, Math.min(H2 * .2, 34), W2 * .64, 16); if (len < 4) g.fillRect(W2 * .18, H2 - 40, W2 * .64, 12);
  g.fillStyle = '#fff3b0'; g.fillRect(W2 * .14, 6, 14, 7); g.fillRect(W2 * .86 - 14, 6, 14, 7);
  return c; }
function markerCanvas() { const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  g.fillStyle = '#5a3a1e'; g.strokeStyle = '#0d0a12'; g.lineWidth = 5; rr(g, 8, 32, 30, 34, 6); g.fill(); g.stroke();   // the bag
  g.fillStyle = '#f2b21c'; g.beginPath(); g.ellipse(54, 48, 28, 38, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#c98a0f'; g.beginPath(); g.arc(58, 48, 16, 0, 7); g.fill(); g.stroke();
  return c; }
async function crossing(p) {
  enterPanel(p);
  const flat = (w, h, canvas, order) => { const m = put(new THREE.Mesh(new THREE.PlaneGeometry(w, h), clipMat({ map: tex(canvas) }, p.ref))); m.renderOrder = p.base + order; return m; };
  flat(p.w, p.h, roadCanvas(p.w, p.h), 8).position.set(p.cx, p.cy, 0);
  const defs = [[-3, 2.4, 7, '#c9302c'], [3.6, 2.4, 7.5, '#3f7fd0'], [-5, 2.4, 8.5, '#e8e2d0'], [2.8, 5.2, 11, '#e09a1f'], [-9.5, 9, 24, '#7fb8a8'], [5.5, 2.4, 10, '#8a5ac0']];
  const lanes = defs.map(([v, len, gap, col], i) => { const n = Math.ceil((p.h + 2 * len + 2) / gap) + 1, cv = tex(carCanvas(len, col));
    return { v, len, cyc: n * gap, cx: LANE0 + (i + .5) * LANEW, cars: Array.from({ length: n }, (_, j) => {
      const m = put(new THREE.Mesh(new THREE.PlaneGeometry(1.8, len), clipMat({ map: cv }, p.ref))); m.renderOrder = p.base + 9; m.scale.y = v > 0 ? 1 : -1; return { y: j * gap + i * 1.7, m }; }) }; });
  const marker = flat(1.2, 1.2, markerCanvas(), 10);
  xing = { p, lanes, marker, tx: 1.4, ty: p.h * .5, inv: 0, live: true };
  focusOn.eye = () => [p.x0 + xing.tx, p.y0 + xing.ty];
  hudOn = true; hud(); control = true; hint('Cross the avenue:  ◀ ▶  to move,  UP / DOWN  to dodge'); $('bD').style.display = '';
  burst('HOOONK!', p.cx, p.y1 - 1.6, .8, 2, 1.2);
  await until(() => xing.tx > LANE0 + 6 * LANEW + .8);
  $('bD').style.display = 'none'; xing.live = false; marker.visible = false; control = false; hudOn = false; hud(); hint(''); await wait(.3);
}
function crossTick(dt) { const X = xing, p = X.p;
  for (const l of X.lanes) for (const c of l.cars) { c.y += l.v * dt; if (c.y > p.h + l.len + 1) c.y -= l.cyc; else if (c.y < -l.len - 1) c.y += l.cyc; c.m.position.set(p.x0 + l.cx, p.y0 + c.y, ZACT); }
  if (!X.live) return;
  X.inv = Math.max(0, X.inv - dt);
  if (control) { X.tx = clamp(X.tx + ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * 4.2 * dt, .7, p.w - .7); X.ty = clamp(X.ty + ((keys.jump ? 1 : 0) - (keys.down ? 1 : 0)) * 4.2 * dt, .8, p.h - .8); }
  X.lanes.forEach((l, i) => { for (const c of l.cars) if (X.inv <= 0 && Math.abs(X.tx - l.cx) < 1.32 && Math.abs(X.ty - c.y) < l.len / 2 + .4) {
    hero.hp--; X.inv = 1; shake = .5; hitstop = .07; burst(i === 4 ? 'CLANG!' : 'HONK!', p.x0 + X.tx, p.y0 + X.ty + 1.2, .8, 1); X.tx = LANE0 + i * LANEW;   // back to the lane line behind him
    if (hero.hp <= 0) { hero.hp = 5; X.tx = 1.4; lose(10, p.x0 + X.tx + 2, p.y0 + X.ty + 1.5); } hud(); } });
  X.marker.position.set(p.x0 + X.tx, p.y0 + X.ty, ZACT); X.marker.visible = !(X.inv > 0 && Math.floor(time * 14) % 2 === 0);
}
function things(dt) {
  if (xing) crossTick(dt);
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
async function leapOff(p, vx = 5.5) { control = false; hint(''); hero.noRespawn = true; hero.free = true; hero.face = 1; hero.vx = vx; hero.vy = 11; hero.grounded = false; hero.set('jump');
  await until(() => hero.x > p.x1 + 1.6 || hero.gone); hero.shown = false; hudOn = false; hud(); }
// a dramatic cut-in in the middle of a played frame: cut away, tap through it, cut back
async function cutIn(id, back) { const h = $('hint').textContent; control = false; hero.vx = 0; if (hero.state === 'walk') hero.set('idle');
  await storyFrame(id, .4); enterPanel(back); control = true; hint(h); }

// ---------- the opening: prologue, then tonight's earlier deliveries
// lines spoken while the player keeps moving: [who, text, seconds, kind]
async function chat(list) { for (const [c, text, sec = 1.7, kind = 'speech'] of list) { if (!c.shown) continue; shout(c, text, sec, kind); await wait(sec + .25); } }
const dot = (text, sec = 1.9) => [hero, text, sec, 'radio'];
async function press(text) { hint(text); pressed.punch = false; let t = 0; await until(dt => pressed.punch || (AUTO && (t += dt) > .6)); hint(''); }
// A fight over a package that can end three ways. The story frame after it shows which.
async function encounter(p, men, o = {}) {
  let out = null; onDown = () => { out = 'robbed'; };
  await until(() => out || (out = men.every(e => e.state === 'down') ? 'won' : !o.noExit && hero.grounded && hero.x > p.x1 - 1.3 ? 'fled' : null));
  onDown = null; control = false; hint('');
  if (out === 'robbed') {   // they take it and go; he gets up without it
    burst('YOINK!', hero.x, hero.wy + 3.4, .9, 1, 1); await wait(.9);
    for (const e of men) if (e.state !== 'down') { e.ai = false; e.free = true; e.ghost = true; walkTo(e, p.x1 + 2.5, 5).then(() => { e.shown = false; }); }
    await wait(1.5); hero.hp = 5; hero.inv = 0; hero.set('idle'); hud(); }
  return out;
}

async function prologue1() {
  await storyFrame('P0.1');
  // the route: move and jump
  const a = P['P0.2'], b = P['P0.3'], c = P['P0.4']; enterPanel(a);
  await heroEnters(a, 2.4, 2.2);
  await say(hero, 'You at the pickup?', 'radio'); await say(hero, "I'm looking at it."); await say(hero, "That's not\nwhat I asked.", 'radio'); await say(hero, 'Then ask a\nbetter question.');
  startAction('Arrow keys (or A and D) to run  •  Space to jump'); hudOn = false; hud();
  await until(() => hero.x > a.x0 + 11.6 && hero.grounded);
  chat([dot('Danny never needed\nthis long.'), [hero, "Danny isn't here.", 1.5], dot('...', 1.3), dot("No. He isn't.", 1.6)]);
  await until(() => hero.x > a.x0 + 21.5 && hero.grounded && !hero.busy);
  await endAction(); await walkTo(hero, a.x1 + 1.6, 3.6); hero.shown = false;
  // the pickup
  enterPanel(b); spawn(keeper, b, b.w - 3.6, { face: -1, relaxed: true }); await heroEnters(b, 2);
  await say(keeper, "You're the new kid?"); await say(hero, "Depends who's asking."); await say(keeper, "You Danny's brother?"); await say(hero, '...'); await say(hero, 'Was.');
  hero.free = false; control = true; hint('Walk to the counter');
  await until(() => hero.x > keeper.x - 2.7); control = false; hero.vx = 0; hero.set('idle'); hero.face = 1;
  await press('J or X: take the package'); burst('GOT IT', hero.x + 1.2, hero.wy + 3, .7, 1, .9);
  await say(keeper, 'He was better at this.'); await say(hero, "I'm getting that a lot.");
  hero.free = true; await walkTo(hero, b.x0 - 1.6, 3.6); hero.shown = false; keeper.shown = false;
  // the clock
  enterPanel(c); await heroEnters(c, 2.2);
  await say(hero, 'You have eight minutes.', 'radio'); await say(hero, 'For three blocks?'); await say(hero, 'Then this should\nbe easy.', 'radio');
  setClock(8, 26, 18, 12);
  startAction('Beat the clock for a bonus  •  the jump up top is quicker, if you make it'); hudOn = false; hud();
  chat([[hero, 'You ever consider\nbeing encouraging?', 1.8], dot('No.', 1.1)]);
  await until(() => hero.x > c.x1 - 1.6 && hero.grounded && !hero.busy);
  await endAction(); await walkTo(hero, c.x1 + 1.6, 4); hero.shown = false;
}

async function prologue2() {
  const a = P['P0.5']; enterPanel(a);
  if (!clock.on) setClock(8, 26, 18, 12);
  spawn(tax1, a, a.w - 6.5, { face: -1, relaxed: true, hp: 9 }); spawn(tax2, a, a.w - 4.2, { face: -1, relaxed: true, hp: 9 });
  await heroEnters(a, 4.5);
  await say(tax1, 'Package tax.'); await say(hero, "There's no\npackage tax."); await say(tax2, 'There is now.');
  tax1.guard = tax2.guard = () => true;   // try as he might
  arm(tax1, { speed: 3, wait: .5, windT: .34 }); arm(tax2, { speed: 2.6, wait: 1.1, windT: .38 });
  startAction('J punch  •  K block  •  L dodge'); hero.hp = 3; hud();
  await Promise.race([encounter(a, [tax1, tax2], { noExit: true }), wait(11).then(() => { if (onDown) { onDown = null; hero.inv = 0; hero.hp = 1; hurtHero(-1, 'SHOVE!'); hero.set('down'); control = false; hint(''); burst('YOINK!', hero.x, hero.wy + 3.4, .9, 1, 1);
    for (const e of [tax1, tax2]) { e.ai = false; e.free = true; e.ghost = true; walkTo(e, a.x1 + 2.5, 5).then(() => { e.shown = false; }); } } })]);
  await until(() => !tax1.shown && !tax2.shown); foes = [];
  hero.hp = 5; hero.inv = 0; hero.set('idle'); hero.face = 1; hudOn = false; hud(); hero.relaxed = true;
  await say(hero, 'Hey! Come back!'); clock.on = false;
  await say(hero, 'Milo? Status?', 'radio'); await say(hero, 'Package is gone.'); await say(hero, 'You lose it?', 'radio');
  await say(hero, "No, Dot. I gave it away.\nThought I'd be generous."); await say(hero, "I'll mark it lost.", 'radio'); await say(hero, "That's it?"); await say(hero, "That's the job.", 'radio');
  stopClock(); await payout('First delivery: LOST', 0, 'a lost package costs the pay, never the game');
  hero.shown = false;
  for (const id of ['P0.6', 'P0.7a', 'P0.7b', 'P0.7c', 'P0.7d']) await storyFrame(id, id === 'P0.6' ? 1.6 : .7);
  wallet.cash = 0; $('cash').style.display = 'none';   // a year on: tonight's money starts from nothing
}

async function route() {
  await storyFrame('R.1');
  // the toll: fight, or go over the top
  const a = P['R.2']; enterPanel(a);
  spawn(cor1, a, 12.5, { face: -1, relaxed: true, hp: 3 }); spawn(cor2, a, 15.6, { face: -1, relaxed: true, hp: 3 });
  await heroEnters(a, 2.6);
  await say(cor1, 'Toll road,\ndelivery boy.'); await say(hero, "It's cough syrup."); await say(cor2, "Then it's a\ncheap toll.");
  setClock(12, 34, 21, 40);
  arm(cor1, { speed: 2.6, wait: .8 }); arm(cor2, { speed: 2.2, wait: 1.6 });
  startAction('Your call: fight them (J  K  L), or up the crate and over the scaffolding');
  const one = await encounter(a, [cor1, cor2]);
  await endAction(); clock.on = false;
  if (one === 'fled') { hero.free = true; await walkTo(hero, a.x1 + 1.6, 4.6); }
  hero.shown = false; cor1.shown = cor2.shown = false;
  await storyFrame('R.3', .9, one);
  { const [pay, note] = fastPay(40, 15);
    if (one === 'robbed') await payout('Prescription: LOST', 0, 'no package, no pay');
    else await payout('Prescription: DELIVERED', pay, (one === 'won' ? 'fought through' : 'got away clean') + ', ' + note); }
  stopClock();
  // the Anchor: the one he cannot win
  await storyFrame('R.4');
  const b = P['R.5']; enterPanel(b);
  spawn(brick, b, 13, { face: -1, relaxed: true, hp: 9 }); spawn(tax1, b, 17, { face: -1, relaxed: true, hp: 9 }); spawn(tax2, b, 19.6, { face: -1, relaxed: true, hp: 9 });
  await heroEnters(b, 2.4);
  await say(brick, "Dot's boy.\nYou're light."); await say(hero, "I haven't opened it."); await say(brick, "Didn't say you did.");
  brick.guard = tax1.guard = tax2.guard = () => true;
  setClock(10, 30, 22, 25);
  arm(brick, { reach: 2.6, windT: .5, speed: 2.1, heavy: true, wait: .9 }); arm(tax1, { speed: 2.4, wait: 1.8 }); arm(tax2, { speed: 2.2, wait: 2.6 });
  startAction("You can't beat him  •  over the crates to the back door  ▶");
  const two = await encounter(b, [brick, tax1, tax2]);
  await endAction(); clock.on = false;
  if (two === 'fled') { hero.free = true; await walkTo(hero, b.x1 + 1.6, 4.6); }
  hero.shown = false; brick.shown = tax1.shown = tax2.shown = false;
  await storyFrame('R.6', .9, two === 'robbed' ? 'robbed' : 'fled');
  { const [pay, note] = fastPay(60, 20);
    if (two === 'robbed') await payout('Envelope: TAKEN', 0, 'no envelope, no pay');
    else await payout('Envelope: DELIVERED', pay, note); }
  stopClock();
}

// the last frame: run the pier and time the jump for the trailing line
async function lastJump() {
  const p = P['7.6']; enterPanel(p, .9);
  spawn(hero, p, 2.2, { relaxed: true }); await wait(.5);
  await say(hero, "You'll never make it!", 'speech'); await say(hero, 'Milo? What are\nyou doing?', 'radio'); await say(hero, 'Something stupid.');
  shout(hero, "Milo, don't...", 1.4, 'radio');
  const edge = p.x0 + 22, line = p.x0 + 31;
  for (;;) {
    hero.free = false; hero.relaxed = false; control = true; hero.noRespawn = true; hint('RUN!  Space to jump at the very end of the pier');
    let got = false; hero.gone = false; hero.shown = true;
    await until(() => { if (pressed.jump && hero.grounded && hero.x > edge - 2.6) got = true; return got || hero.gone || hero.y < -2; });
    control = false; hint('');
    if (got) { hero.free = true; await hop(hero, p, line, { y: 2.2, h: 3.4, dur: 1.05 }); break; }
    burst('SPLASH!', hero.x, p.y0 + GROUND + .6, 1, 2, 1.1); await wait(1.2);   // too early or not at all: hauled out to try again
    spawn(hero, p, 2.2, { relaxed: true });
  }
  hero.set('jump'); hero.vx = hero.vy = 0; hero.y = 2.2; hero.grounded = true; p.plats.push({ x0: line - 1, x1: line + 1, top: 2.2, look: null, solid: false });
  burst('GOT IT!', line, hero.wy + 4.4, 1, 2, 1.2); await wait(1.2);
  await say(hero, "Danny's alive.", 'thought'); await say(hero, "This wasn't on\nthe route sheet.", 'thought');
}

async function page1() {
  for (const id of ['1.1', '1.2', '1.3', '1.4', '1.5']) await storyFrame(id);
  const p = P['1.6'], q = P['1.7']; enterPanel(p);
  await heroEnters(p, 2.2, 2.6);
  startAction('Arrow keys to run  •  Space to jump'); hudOn = false; hud();
  wait(1.5).then(() => radio("Fourth floor, Calder Street.\nHe's expecting you.", 2.8));
  await until(() => hero.x > p.x0 + 18.9 && hero.grounded && !hero.busy);
  await endAction(); enterPanel(q); await hop(hero, q, q.x0 + 2.2, { y: -.75, h: 3, dur: .8 }); hero.face = 1;   // out of one frame and into the next
  startAction('The big one: jump to the flagpole, then across'); hudOn = false; hud();
  wait(1).then(() => shout(hero, 'Danny did this\nevery night.', 2.2, 'thought'));
  await until(() => hero.x > q.x0 + 14.4 && hero.grounded && !hero.busy);
  await endAction(); await wait(.8);
}

async function page2() {
  const a = P['2.1'], b = P['2.3'], c = P['2.4'];
  enterPanel(a); await heroEnters(a, 2.4); caption(a, 'Calder Street. 11:24 PM.');
  startAction('Space to jump up the fire escape'); hudOn = false; hud();
  await until(() => hero.y > 9.2 && hero.grounded && !hero.busy); await cutIn('2.2', a);
  await until(() => hero.y > 18.5 && hero.grounded && !hero.busy);
  await endAction(); enterPanel(b); await hop(hero, b, b.x0 + 1.6, { y: -.3, h: 2.2, dur: .95 }); hero.face = 1;
  startAction('Along the ledge  •  mind the gaps and the flowerpots');
  wait(.8).then(() => shout(hero, 'Who picks a pickup\nwith no front door?', 2.2, 'thought'));
  let pot = 2.6;
  await until(dt => { if (control && (pot -= dt) < 0) { pot = 2.3; dropCrate(b, hero.x + 1.7, hero.y + 6); } return hero.x > b.x0 + 16.6 && hero.grounded && !hero.busy; });
  await endAction(); hero.shown = false; await wait(.4);
  // the pickup
  enterPanel(c); spawn(w1, c, c.w - 4.2, { face: -1, relaxed: true }); await heroEnters(c, 2.2);
  await say(w1, "You're the courier?"); await say(hero, "That's what the slip says."); await say(w1, 'Take it. Quickly.');
  hero.free = false; control = true; hint('Walk to the desk');
  await until(() => hero.x > w1.x - 2.7); control = false; hero.vx = 0; hero.set('idle'); hero.face = 1;
  hint('J or X: take the case'); pressed.punch = false; { let t = 0; await until(dt => pressed.punch || (AUTO && (t += dt) > .6)); } hint('');
  burst('CLICK', hero.x + 1.2, hero.wy + 3, .7, 1, .9);
  await say(w1, 'Only to her. Nobody else.\nGet it signed.'); await say(hero, "That's the job.");
  setClock(36, 480, 23, 24); radio("Thirty-six minutes, kid.\nClock's running.", 2.6); await wait(2.4);
  await walkTo(hero, c.x0 - 1.6, 3.6); hero.shown = false;
  for (const id of ['2.5', '2.6', '2.7', '2.8']) await storyFrame(id);
}

async function page3() {
  await storyFrame('3.1'); await crossing(P['3.2']); await storyFrame('3.3');
  const b = P['3.4'], c = P['3.6']; enterPanel(b); await heroEnters(b, 1.6);
  startAction('The far lanes are jammed: go over the top');
  wait(1.2).then(() => shout(hero, 'Quicker than waiting\nfor the light.', 2, 'thought'));
  await until(() => hero.x > b.x1 - 2.8 && hero.y > 2 && hero.grounded && !hero.busy);
  await leapOff(b); await storyFrame('3.5');
  // the back alleys and the bag-snatcher
  enterPanel(c); spawn(w3, c, 16.5, { face: -1, hp: 3, shown: false }); await heroEnters(c, 2.2);
  startAction('Vault the fences  ▶');
  await until(() => hero.x > c.x0 + 9.5);
  w3.shown = true; shout(w3, "Nice bag.\nI'll take it.", 1.6); arm(w3, { speed: 2.8, wait: .7 }); w3.snatch = true;
  hint('If he lands a hit he grabs the case and runs');
  wait(1.3).then(() => shout(hero, "It's not for you.", 1.4));
  await until(() => (w3.state === 'down' && !w3.hasCase) || (w3.hasCase && w3.x > c.x1 + 1));
  if (w3.hasCase) { w3.shown = false; w3.hasCase = false; clock.tip = false; lose(30); hint('He got a block away before Milo ran him down. Bonus lost.'); await wait(2.6); }
  hint('Keep going  ▶');
  await until(() => hero.x > c.x1 - 1.3 && hero.grounded && !hero.busy);
  await endAction(); await walkTo(hero, c.x1 + 1.6, 4); hero.shown = false;
}

async function page4() {
  const a = P['4.1'], b = P['4.3'], c = P['4.4'], d = P['4.5'];
  enterPanel(a);
  spawn(hero, a, -1.4, { relaxed: true }); spawn(thug, a, a.w + 1.4, { face: -1, shown: false, relaxed: true, hp: 4 });
  await wait(1.2); caption(a, 'Pier 27. 11:42 PM.');
  await walkTo(hero, a.x0 + 3.4, 2.6);
  await say(hero, 'Almost there.', 'thought');
  hero.free = false; control = true; hint('Arrow keys to walk');
  await until(() => hero.x > a.x0 + 5.4);
  control = false; hint(''); hero.vx = 0; hero.set('idle'); hero.face = 1;
  thug.shown = true; await walkTo(thug, a.x1 - 2.7, 2.4); thug.face = -1;
  await say(thug, 'End of the line, kid.\nHand over the case.');
  await say(hero, 'Sorry. It needs\na signature.');
  await say(thug, 'Funny.'); await say(hero, 'I get that a lot.');
  await storyFrame('4.2', .6);
  hero.shown = thug.shown = false;
  // round one
  enterPanel(b);
  spawn(thug, b, 11.5, { face: -1, hp: 4 }); thug.knockTo = { p: c, dir: 0, word: 'KRASH!' };
  await heroEnters(b, 2.4); await wait(.3);
  arm(thug); startAction('J punch  •  K block  •  L dodge  •  Space jump');
  await until(() => thug.flown && !thug.hop); thug.flown = false;
  await diveAfter(c, clamp(thug.x - 4.5, c.x0 + 5, c.x1 - 3), 'Space: jump down after him');
  // round two
  thug.set('idle'); thug.hp = 2; arm(thug, { wait: .9 }); startAction('');
  spawn(goon, c, -1.4, { hp: 4 }); goon.ghost = true; goon.guard = () => thug.state !== 'down'; goon.knockTo = { p: d, dir: -1, fx: d.cx, y: d.h * .3, hide: true };   // Slim comes in behind Milo
  wait(2).then(async () => { await walkTo(goon, c.x0 + 2.3, 3); shout(goon, "Hey! That's\nmy brother!", 1.7); arm(goon, { wait: 1.2 }); wait(1.8).then(() => shout(hero, 'I gathered that.', 1.3)); });
  await until(() => goon.flown && !goon.hop);
  await endAction();
  await storyFrame('4.5', .1);
  for (const id of ['4.6', '4.7', '4.8']) await storyFrame(id);   // the theft the player cannot stop
}

async function page5() {
  if (QS.get('frame') !== '5.7') await page5a();
  await page5b();
}
async function page5a() {
  await storyFrame('5.1');
  const a = P['5.2'], b = P['5.3'];
  enterPanel(a);
  spawn(w1, a, a.w - 3.4, { face: -1, hp: 3 }); spawn(w2, a, -1.4, { hp: 3, shown: false });
  w2.guard = () => w1.state !== 'down'; w2.knockTo = { p: b, dir: -1, word: 'THUD!' };
  await heroEnters(a, 4.6);
  await say(w1, "Yard's closed,\ncourier."); await say(hero, "I'm looking for someone."); shout(w1, 'Everybody is.', 1.5); await wait(.9);
  arm(w1, { reach: 2.7, windT: .55, speed: 2.2, heavy: true }); wait(2.2).then(async () => { w2.shown = true; w2.ghost = true; await walkTo(w2, a.x0 + 1.6, 3); arm(w2, { reach: 2.7, windT: .55, speed: 2.0, heavy: true }); });   // the second one boxes him in from behind
  startAction('Pipes go through a block: dodge (L), then hit');
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
  await storyFrame('5.4'); await storyFrame('5.5'); await storyFrame('5.6');
}
async function page5b() {   // over the top, then the searchlight
  const c = P['5.7'], d = P['5.8']; enterPanel(c);
  spawn(w3, c, 22.5, { y: 1.4, face: -1, hp: 3 });
  await heroEnters(c, 2.2, .6);
  arm(w3, { reach: 2.7, windT: .55, speed: 2.0 });
  startAction('Run the container tops  ▶');
  wait(2).then(() => radio('Six minutes, Milo.'));
  await until(() => hero.x > c.x1 - 1.5 && hero.grounded && !hero.busy);
  await endAction(); enterPanel(d); await hop(hero, d, d.x0 + 1.6, { y: 1.4, h: 2, dur: .6 }); hero.face = 1;
  addSpot(d, 1.9, t => [6.8 + 4.6 * Math.sin(t * .9), GROUND + 4.9]);
  startAction('Go between sweeps of the light');
  wait(.6).then(() => shout(hero, 'Wait for it...', 1.6, 'thought')); wait(3).then(() => shout(hero, 'Now!', 1, 'thought'));
  await until(() => hero.x > d.x1 - 2.1 && hero.grounded && !hero.busy);
  await leapOff(d);
}

async function page6() {
  const a = P['6.1'], bm = P['6.3']; enterPanel(a);
  await heroEnters(a, 2.4);
  caption(a, 'Crane 4. 11:55 PM.');
  addSpot(a, 2.1, t => [a.w / 2 + 3 * Math.sin(t * .9), GROUND + 10.5 + 8.5 * Math.sin(t * .37)]);
  startAction('Space to jump up  •  stay out of the light');
  await until(() => hero.y > 9.2 && hero.grounded && !hero.busy); await cutIn('6.2', a);
  await until(() => hero.y > 18.5 && hero.grounded && !hero.busy);
  await endAction(); spot.mesh.visible = false; spot = null;
  // the boom
  enterPanel(bm); await hop(hero, bm, bm.x0 + 1.8, { y: .8, h: 2.2, dur: .95 }); hero.face = 1;
  startAction('Along the boom  •  the wind pushes you back');
  wait(.8).then(() => shout(hero, 'Danny, what did you\nget into?', 2.2, 'thought'));
  let g = 2.5;
  await until(dt => { const was = g; g -= dt; if (g < -.9) g = 2 + Math.random(); else if (g < 0 && control) { if (was >= 0) burst('WHOOSH', hero.x + 2.5, hero.wy + 4, .7, 1, .8); hero.x -= 3.4 * dt; }
    return hero.x > bm.x0 + 18 && hero.grounded && !hero.busy; });
  await endAction(); hero.shown = false; await wait(.3);
  await storyFrame('6.4');
  // the boss, part one
  const b = P['6.5'], c = P['6.6']; enterPanel(b);
  spawn(gage, b, b.w - 6, { face: -1, hp: 6 }); gage.knockTo = { p: c, pit: true, word: 'KLANG!', h: .2 };
  await heroEnters(b, 2.6);
  await say(gage, "The last courier didn't\nlisten either."); await say(hero, '...'); shout(hero, 'What last courier?', 1.4); await wait(.5);
  arm(gage, { reach: 3.4, windT: .7, speed: 2.0, leaps: true, heavy: true });
  startAction('No blocking the hook: dodge it (L), then hit  •  mind the gap');
  await until(() => { if (gage.knockTo && !gage.hop && gage.y < -1) { gage.knockTo.x = clamp(gage.x, c.x0 + 2, c.x1 - 2); knock(gage); }   // down through the gap and into the frame below
    return gage.flown && !gage.hop; }); gage.flown = false; gage.leaps = false;
  await diveAfter(c, clamp(gage.x - 4.5, c.x0 + 2, c.x1 - 3), 'Space: jump down after him');
  // part two
  gage.set('idle'); gage.hp = 5; shout(hero, 'What last courier?!', 1.6); wait(1.7).then(() => { if (gage.state !== 'down') shout(gage, "I'll throw you in\nthe harbor myself!", 1.8); });
  arm(gage, { reach: 2.05, windT: .3, speed: 3.6, wait: 1.4 }); startAction('');
  await until(() => gage.state === 'down' && gage.grounded);
  await wait(.8); await endAction();
  await storyFrame('6.7');
}

async function page7() {
  const a = P['7.1']; enterPanel(a); caption(a, '11:58 PM.');
  await heroEnters(a, 2);
  startAction('RUN!  Jump the ropes'); hudOn = false; hud();
  radio('Ninety seconds.', 1.3); wait(1.5).then(() => shout(hero, 'I know!', 1)); wait(2.8).then(() => radio("Don't miss the deadline.", 1.6)); wait(4.6).then(() => shout(hero, "I'm trying not to die!", 1.5));
  await until(() => hero.x > a.x1 - 2.4 && hero.grounded && !hero.busy);
  await endAction(); clock.on = false; hero.shown = false;
  for (const id of ['7.2', '7.3', '7.4', '7.5']) await storyFrame(id);
  await lastJump();
  enterPanel(P['7.7'], .5); await wait(1.8);
  await storyFrame('7.8', 1.2);
  focusPanel(null); frameId = 'end'; for (const q of panels) q.want = 1;
  const text = result(); wallet.cash += result.pay; $('cash').textContent = 'TONIGHT  $' + wallet.cash; $('cash').style.display = 'block';
  hint(`${text}  •  Night's take $${wallet.cash}  •  End of ${LEVEL.series} #${LEVEL.issue}. To be continued...  Press R to read it again`);
}
const PAGES = [prologue1, prologue2, route, page1, page2, page3, page4, page5, page6, page7];

async function turnPage(n) {
  const pg = LEVEL.pages[n], w = $('wipe');
  $('wipeT').innerHTML = `${pg.label || 'Page ' + (n + 1 - OPEN)}<small>${pg.title}  -  ${pg.time}</small>`;
  w.style.transition = ''; w.offsetWidth; w.style.transform = 'translateX(0)';
  await wait(.6); clearPage(); await buildPage(n);
  Object.assign(view, { cx: PAGE.w / 2, cy: PAGE.h / 2, D: 80 });
  await wait(.7); w.style.transform = 'translateX(-105%)';
  wait(.6).then(() => { w.style.transition = 'none'; w.style.transform = 'translateX(105%)'; });
}
async function run(start) {
  if (start >= OPEN + 2) { setClock(36, 480, 23, 24); clock.t = [0, 0, 9, 18, 25, 31, 34][start - OPEN] * spm(); }
  for (let n = start; n < PAGES.length; n++) { if (n > start) await turnPage(n);
    if (clock.on && n - OPEN >= 2) clock.t = Math.max(clock.t, [0, 0, 9, 18, 25, 31, 34][n - OPEN] * spm());   // the clock never reads earlier than the story says it is
    await PAGES[n](); await wait(.6); }
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
    if (!e.shown || e.ghost || e.hop || e.state === 'down' || hero.state === 'down' || e.panel !== hero.panel || !hero.grounded || Math.abs(hero.y - e.y) > 1.6) continue;   // he can jump over them
    const dx = hero.x - e.x, gap = 1.05;
    if (Math.abs(dx) < gap) { const push = (gap - Math.abs(dx)) * (dx >= 0 ? 1 : -1); hero.x += push * .6; e.x -= push * .4; }
  }
  if (clock.on && control && dt > 0) clock.t += dt;
  showClock();
  for (const k in pressed) pressed[k] = false;

  // focus: the active frame sharpens, the rest fall soft; teasers fade once a frame is reached
  const kf = 1 - Math.exp(-dtR * 4);
  for (const p of panels) { p.focus += (p.want - p.focus) * kf; p.tease += ((p === focusOn.panel ? 0 : 1) - p.tease) * kf;   // any frame not being played shows its freeze frame, before and after
    for (const m of p.mats) m.uniforms.focus.value = p.focus; if (p.teaser) p.teaser.uniforms.alpha.value = p.tease;
    for (const m of p.blocks) m.color.setScalar(.84 + .16 * p.focus);
    }
  for (const m of rainMats) m.uniforms.off.value.set(-time * .35 % 1, time * 1.7 % 1);

  // camera: frame the active panel, lean with the hero so the depth shifts
  const fp = focusOn.panel, th = Math.tan(FOV * Math.PI / 360), asp = camera.aspect;
  let gx = PAGE.w / 2, gy = PAGE.h / 2, gD = Math.max(PAGE.h / (2 * th), PAGE.w / (2 * th * asp)) / .95, gox = asp < 1 ? .15 : .3;
  if (fp) {
    const eye = focusOn.eye ? focusOn.eye() : poiOf(fp) || (hero.panel === fp && hero.shown ? [hero.x, hero.wy + 1.8] : null), tr = fp.def.track, kx = asp < 1 ? .45 : .6;
    const Dh = fp.h / (2 * th), Dw = fp.w / (2 * th * asp); let f = 0; gx = fp.cx; gy = fp.cy;
    if (tr === 'x' && Dw > Dh / kx) { gD = Dh / kx; const hv = gD * th * asp * .82; gx = clamp(eye ? eye[0] : fp.cx, fp.x0 + hv, fp.x1 - hv); f = (gx - fp.cx) / (fp.w / 2); }
    else if (tr === 'y' && Dh > Dw / .4) { gD = Dw / .4; const hv = gD * th * .82; gy = clamp(eye ? eye[1] : fp.cy, fp.y0 + hv, fp.y1 - hv); }
    else {   // show the whole frame when it fits; on a screen where it would end up tiny (a phone), move in and keep the subject in shot
      gD = Math.min(Math.max(Dh, Dw) / focusOn.fill, Math.min(Dh, Dw) / (Dw > Dh ? .4 : .3));
      const hx = gD * th * asp * .84, hy = gD * th * .84;
      if (fp.w / 2 > hx) { gx = clamp(eye ? eye[0] : fp.cx, fp.x0 + hx, fp.x1 - hx); f = (gx - fp.cx) / (fp.w / 2); }
      else if (eye) { f = clamp((eye[0] - fp.cx) / (fp.w / 2), -1, 1); gx = fp.cx + f * fp.w * .06; }
      if (fp.h / 2 > hy) gy = clamp(eye ? eye[1] : fp.cy, fp.y0 + hy, fp.y1 - hy); }
    gox = (asp < 1 ? .15 : .3) + .06 * f;   // an upright phone leans less, or the frame's near edge runs off the narrow screen
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
  const keep = (s, hw, hh) => { if (2 * hw < W - 12) s[0] = clamp(s[0], hw + 6, W - hw - 6); if (2 * hh < H - 110) s[1] = clamp(s[1], hh + 48, H - hh - 62); return s; };   // lettering never leaves the screen
  for (const o of balloons) {
    if (o.c) { const c = o.c, p = c.panel; if (!p) continue; const rxW = o.b.rx * UNIT, ryW = o.b.ry * UNIT, headY = c.wy + 3.6;
      const bx = clamp(c.x + Math.sign(p.cx - c.x) * rxW * .55, p.x0 + rxW + .35, Math.max(p.x0 + rxW + .35, p.x1 - rxW - .35)), by = Math.min(headY + .6 + ryW, p.y1 - ryW - .35 + (p.h < 7 ? ryW * 2 : 0));   // in a shallow frame the balloon breaks out over the top border instead of covering him
      const s = keep(scr(bx, by, ZACT), o.b.rx * sc, o.b.ry * sc), t = scr(c.x + c.face * .15, headY + .1, ZACT); o.b.set(s[0], s[1], sc, rot, t[0], t[1]); }
    else { const s = keep(scr(o.fx, o.fy), o.b.rx * sc * o.k, o.b.ry * sc * o.k), t = scr(o.tx, o.ty); o.b.set(s[0], s[1], sc * o.k, rot, t[0], t[1]); } }
  const visL = view.cx - view.D * th * asp * .9;
  for (const o of captions) { const p = o.p, x = p.def.track === 'x' && p === fp ? clamp(visL, p.x0 + .3, p.x1 - 9) : p.x0 + .3, s = scr(x, p.y1 - .3 - o.i * .95);
    o.b.set(s[0], s[1], sc * 1.15, rot, .7 + .3 * p.focus, (1 - p.focus) * 2); }
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
  tax1 = new Char('tax1'); tax2 = new Char('tax2'); cor1 = new Char('corner1'); cor2 = new Char('corner2'); brick = new Char('brick'); keeper = new Char('keeper');
  chars = [hero, thug, goon, w1, w2, w3, gage, tax1, tax2, cor1, cor2, brick, keeper]; hero.hp = 5;
  const sheets = {};
  for (const c of chars) { const cfg = (manifest.sprites || {})[c.kind]; if (!cfg) continue;
    if (!sheets[c.kind]) { const s = sheets[c.kind] = {}; const img = await loadImage('./art/' + cfg.file);
      if (img) { try { s.sprites = sliceSprites(img, cfg); } catch (e) { console.error(e); } }
      if (cfg.walk && s.sprites) { const im2 = await loadImage('./art/' + cfg.walk.file);
        if (im2) { try { Object.assign(s.sprites, sliceSprites(im2, cfg.walk)); s.cycle = cfg.walk.cycle; } catch (e) { console.error(e); } } } }
    if (sheets[c.kind].sprites) { c.pup.sprites = sheets[c.kind].sprites; if (sheets[c.kind].cycle) c.pup.cycle = sheets[c.kind].cycle; } }
  const want = QS.get('page'), key = LEVEL.pages.findIndex(q => q.key === want);   // ?page=P1, P2, R or the page number 1 to 7
  const start = key >= 0 ? key : want ? clamp(OPEN + (parseInt(want) || 1) - 1, 0, PAGES.length - 1) : 0;
  await buildPage(start);
  let last = performance.now();
  const loop = now => { frame((now - last) / 1000); last = now; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  window.__game = { hero, chars, view, keys, pressed, focusPanel, get P() { return P; }, get panels() { return panels; }, get foes() { return foes; },
    get xing() { return xing; }, clock,
    wallet, get at() { return { page: pageNo + 1, frame: frameId, control, hp: hero.hp, x: +(hero.x - (hero.panel ? hero.panel.x0 : 0)).toFixed(2), y: +hero.y.toFixed(2), state: hero.state }; } };
  await wait(1.2);
  run(start).catch(e => console.error(e));
}
boot().catch(e => { const d = $('err'); d.style.display = 'flex'; d.textContent = 'The game could not start:\n' + (e && e.stack || e); console.error(e); });
