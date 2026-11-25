// Comic-book game, level 1. The level map lives in level1.js (pages, frames, shots,
// lettering). This file turns that map into pages you read and play through:
// story frames you tap through, action frames you play in, knock-throughs from one
// frame into another, and page turns.
import * as THREE from 'three';
import { panelLayers, paperCanvas, rainCanvas, blurred, loadImage, artLayer, blockCanvas, forkliftCanvas, keyGreen } from './art.js';
import { Puppet, STYLES, poseFor, lerpPose, frameFor, sliceSprites, CW, CH, BASE, PPU } from './puppet.js';
import { Lettering } from './letters.js';
import { LEVEL } from './level1.js';
const OPEN = LEVEL.pages.filter(q => q.label).length;   // pages before page 1: the prologue and tonight's earlier route

const PAGE = { w: 42, h: 27 };
const SOFT = .28;   // how soft the frames out of focus are (1 = the old heavy blur)
const SHOWPLATS = new URLSearchParams(location.search).has('plats');
const GROUND = 1.25, ZACT = -.5, UNIT = .022, FLAT = new URLSearchParams(location.search).has('flat'), ROLL = FLAT ? 0 : .07, FOV = 35;
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
  // measured from the painted rooftops (art/bg_P0_2.png): three roofs at one height, two short gaps
  'P0.2': { scene: 'roofs', seed: 61, plats: [[-6, 7.9, 2.2, 'roof'], [9, 15.57, 2.2, 'roof'], [16.95, 30, 2.2, 'roof']] },
  'P0.3': { plats: [FLOOR] },
  // measured from the painted loading platform (art/bg_P0_4.png): two steps, the platform, a truck bay too wide to jump, the far stub of platform, a crate
  'P0.4': { scene: 'neon', seed: 64, plats: [G, [5.96, 8, 1, 'steel', false], [8, 10.2, 2.04, 'steel', false], [10.2, 29.03, 3.07, 'steel', false], [34.38, 37.55, 3.07, 'steel', false], [37.86, 39.78, 1.68, 'crate', false]] },   // the things standing about (crates, drums, a dumpster, pallets) are painted props listed in the manifest ("dress"), which makes their platforms too
  'P0.5': { scene: 'alley', plats: [G] },
  // measured from the painted street (art/bg_R_2.png): the crate, then the flatbed trailer loaded with scaffold boards and poles
  'R.2': { scene: 'neon', seed: 72, plats: [[-60, 100, -.6, null, false], [6.54, 7.98, 1.32, 'crate', false], [10.18, 24.07, 2.06, 'steel', false]] },   // the street is the ground: .6 below the wall line, so nobody stands on the trailer's wheels
  // measured from the painted back lot (art/bg_R_5.png): crate stacks, kegs and the dumpster lid
  'R.5': { scene: 'alley', plats: [G, [4.28, 6.3, 1.6, 'crate', false], [6.44, 7.79, 3.2, 'crate', false], [7.79, 8.75, 2.36, 'crate', false],
    [11.1, 13.34, 3.06, 'crate', false], [13.38, 14.39, 2.36, 'crate', false], [14.98, 19.6, 3.1, 'crate', false]] },
  '7.6': { scene: 'dock', plats: [[-60, 20.6, 0, 'steel', false]] },
  '1.1': { track: 'x' },
  '1.6': { scene: 'roofs', seed: 12, plats: [[-6, 4.6, 2.6, 'roof'], [6.1, 10.1, 1.8, 'roof'], [12.1, 15.6, 2.2, 'roof'], [18.1, 26, 1.2, 'roof']] },
  '1.7': { scene: 'roofs', seed: 17, plats: [[-6, 5.6, -.75, 'roof'], [8.2, 9.6, -.2, 'steel', false], [12.6, 30, -.75, 'steel', false]] },
  '2.1': { scene: 'city', seed: 21, track: 'y', keepBlocks: true, deck: 'landing', plats: [FLOOR, ...fire] },
  '2.3': { scene: 'neon', seed: 23, plats: [[-4, 3.6, -.3, 'roof'], [4.85, 7.7, -.3, 'roof'], [9.2, 11.4, -.3, 'roof'], [12.8, 30, -.3, 'roof']] },
  '2.4': { plats: [FLOOR] },
  '3.2': { seed: 32 },
  '3.4': { scene: 'neon', seed: 34, plats: [G, [1.5, 2.8, 1.4, 'crate', false], [2.9, 5.3, 2.5, 'crate', false], [5.5, 7.3, 1.4, 'crate', false], [8.4, 13.0, 2.7, 'crate', false], [13.1, 14.4, 1.7, 'crate', false],
    [15.5, 16.8, 1.45, 'crate', false], [17.0, 19.3, 2.5, 'crate', false], [19.6, 21.3, 1.4, 'crate', false], [22.6, 26.6, 2.6, 'crate', false], [26.7, 28.2, 1.6, 'crate', false]] },   // measured from the painted jam (art/bg_3_4c.png): boot, roof and bonnet of each vehicle
  '3.6': { scene: 'alley', plats: [G, [4.6, 5.3, 2.0, 'crate'], [7.0, 10.2, 2.2, 'crate']] },   // measured from the painted fence and dumpster
  '4.1': { scene: 'alley' }, '4.3': { scene: 'dock' }, '4.4': { scene: 'dock' },
  '5.2': { scene: 'yard', seed: 31, floor: 1.25 },
  '5.3': { scene: 'yard', seed: 33, floor: 1.25, plats: [G, [4.6, 6.5, 1.5, 'crate'], [9.6, 11.4, 1.5, 'crate']] },
  '5.7': { scene: 'yard', seed: 37, plats: [[-6, 5.5, .6, 'container'], [5.5, 11, 1.8, 'container'], [11, 16.5, .9, 'container'], [17.9, 32, 1.4, 'container']] },
  '5.8': { scene: 'yard', seed: 38, plats: [[-6, 3.6, 1.4, 'container'], [5.0, 8.4, 2.0, 'container'], [10.0, 14, 2.6, 'container']] },
  '6.1': { scene: 'crane', seed: 41, track: 'y', keepBlocks: true, deck: 'catwalk', plats: [FLOOR, ...landings] },
  '6.3': { scene: 'crane', seed: 43, plats: [[-4, 4.6, .8, 'steel', false], [6.2, 10.4, .8, 'steel', false], [12, 15.6, .8, 'steel', false], [17.2, 30, .8, 'steel', false]] },
  '6.5': { scene: 'crane', seed: 44, plats: [[-60, 6, 0, 'steel', false], [8.6, 100, 0, 'steel', false]] },   // a section of the walkway is missing
  '6.6': { scene: 'crane', seed: 45, plats: [FLOOR] },
  '7.1': { scene: 'dock', plats: [G, [5.7, 6.8, .65, 'crate'], [10.9, 12.2, .85, 'crate'], [15.9, 17.1, .7, 'crate']] },
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
let hero, thug, goon, w1, w2, w3, gage, tax1, tax2, cor1, cor2, brick, keeper, clerk, chars = [], foes = [], onDown = null;
const imgCache = {};
const put = m => { scene.add(m); pageObjs.push(m); return m; };

async function buildPage(n) {
  pageNo = n; panels = []; P = {}; rainMats = [];
  const defs = LEVEL.pages[n].panels.map(d => ({ sharp: true, scene: d.kind === 'caption' ? 'end' : 'storyph', seed: Math.round(parseFloat(d.id) * 10), ...d, ...(GAME[d.id] || {}) }));
  const artFor = {};
  if (!TOP.done) { TOP.done = true; const t = manifest.top || {};   // painted pieces for the two overhead frames: whole pictures (road, floor) and cut-out sheets (cars, yard)
    for (const k of ['road', 'floor']) if (t[k]) TOP[k] = await loadImage('./art/' + t[k]);
    if (t.fork) { const img = await loadImage('./art/' + t.fork); if (img) { const c = keyGreen(img), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x0 = c.width, x1 = 0, y0 = c.height, y1 = 0;   // the painted forklift, trimmed to its own edges
        for (let j = 0; j < c.height; j += 2) for (let i = 0; i < c.width; i += 2) if (d[(j * c.width + i) * 4 + 3] > 128) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
        const o = document.createElement('canvas'); o.width = x1 - x0; o.height = y1 - y0; o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height); TOP.fork = o; } }
    for (const k of ['cars', 'yard', 'props', 'run']) if (t[k]) { const img = await loadImage('./art/' + t[k].file); if (img) TOP[k] = { sheet: keyGreen(img), rects: t[k].rects, f: img.width / (t[k].guide || 1360) }; } }
  for (const d of defs) { const a = (manifest.panels || {})[d.id]; if (!a) continue; artFor[d.id] = {};
    for (const k in a) if (k === 'lettered') d.lettered = true; else if (k === 'variants') { artFor[d.id].variants = {}; for (const v in a[k]) artFor[d.id].variants[v] = await loadImage('./art/' + a[k][v]); } else if (typeof a[k] !== 'string') artFor[d.id][k] = a[k]; else artFor[d.id][k] = imgCache[a[k]] || (imgCache[a[k]] = await loadImage('./art/' + a[k])); }
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
      mesh.renderOrder = base + 1 + j + (ly.d < -ZACT || ly.over ? 4 : 0);   // layers nearer than the action draw over the characters
      if (ly.d >= -ZACT && !ly.over) p.charOrder = base + 1 + j + .5;
      p.mats.push(mat);
    });
    // what the player stands on
    p.plats = (def.plats || [G]).map(([a, b, top, look, solid = true, base = -99]) => ({ x0: x0 + a, x1: x0 + b, top, look, solid, base })); p.art = art;
    const hasArt = art && (art.far || art.near || art.story), ghost = hasArt && !def.keepBlocks;   // painted frames hide the stand-in blocks; ?plats=1 shows them faintly for lining art up
    for (const [name, a, b, base = 0, solid = true] of (art && art.dress) || []) { const pc = propCanvas(name); if (!pc) continue; const bw = b - a, bh = bw * pc.height / pc.width;   // painted things set down in the frame: each is also something to stand on
      const mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), clipMat({ map: tex(pc) }, ref))); mesh.position.set(x0 + (a + b) / 2, y0 + GROUND + base + bh / 2, ZACT); mesh.renderOrder = p.charOrder - .1;
      p.plats.push({ x0: x0 + a + .08, x1: x0 + b - .08, top: base + bh - .06, look: null, solid, base: base > 0 ? base : -99 }); }
    const deck = def.deck && propCanvas(def.deck);
    p.plats.forEach((b, k) => { if (deck && b.look) { if (b.top <= 0) return; const bx0 = Math.max(b.x0, x0 - 1.5), bx1 = Math.min(b.x1, x1 + 1.5), bw = bx1 - bx0, bh = Math.min(1.1, bw * deck.height / deck.width);   // a painted landing in place of the plain slab
        const mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), clipMat({ map: tex(deck) }, ref))); mesh.position.set((bx0 + bx1) / 2, y0 + GROUND + b.top - bh / 2 + .04, ZACT); mesh.renderOrder = p.charOrder - .1; return; }
      if (!b.look && !(ghost && SHOWPLATS)) return; if (ghost && !SHOWPLATS) return;
      const bx0 = Math.max(b.x0, x0 - 1.5), bx1 = Math.min(b.x1, x1 + 1.5), bw = bx1 - bx0;
      const bh = !b.look || b.look === 'steel' ? .32 : b.look === 'crate' ? b.top : b.top + GROUND + 1;
      const mat = clipMat({ map: tex(blockCanvas(b.look || 'steel', bw, bh, k + i * 3)), ...(ghost ? { transparent: true, opacity: FLAT ? .6 : .45, ...(FLAT ? { color: 0xff40ff } : {}) } : {}) }, ref), mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), mat));
      mesh.position.set((bx0 + bx1) / 2, y0 + GROUND + b.top - bh / 2, ZACT); mesh.renderOrder = p.charOrder - .1; p.blocks.push(mat); });
    if (FLAT && def.kind === 'action') { const k = 40, c = document.createElement('canvas'); c.width = w * k; c.height = h * k; const g = c.getContext('2d'), gy = c.height - GROUND * k;   // a measuring grid: a line every unit across and up from the ground line, numbered
      g.font = 'bold 13px sans-serif'; g.lineWidth = 1;
      for (let u = 0; u <= w; u++) { g.strokeStyle = u % 5 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,0,.8)'; g.beginPath(); g.moveTo(u * k, 0); g.lineTo(u * k, c.height); g.stroke(); g.fillStyle = '#ff0'; g.fillText(u, u * k + 2, gy + 14); }
      for (let v = -1; v <= h; v++) { g.strokeStyle = v ? 'rgba(255,255,255,.35)' : 'rgba(0,255,255,.9)'; g.beginPath(); g.moveTo(0, gy - v * k); g.lineTo(c.width, gy - v * k); g.stroke(); g.fillStyle = '#0ff'; for (let u = 2; u < w; u += 6) g.fillText(v, u * k + 3, gy - v * k - 2); }
      const gm = put(new THREE.Mesh(new THREE.PlaneGeometry(w, h), clipMat({ map: tex(c) }, ref))); gm.position.set(cx, cy, ZACT); gm.renderOrder = base + 17; }
    // the frozen teaser, shown until the reader gets here
    if (art && art.teaser) { const ly = artLayer(def, art.teaser, .3), mat = layerMat(tex(ly.canvas), tex(blurred(ly.canvas, ly.blur * SOFT)), ref);
      const mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(ly.plane.w, ly.plane.h), mat)); mesh.position.set(cx, cy + ly.plane.cy, -ly.d); mesh.renderOrder = base + 16;
      p.mats.push(mat); p.teaser = mat; }
    if (def.kind !== 'caption' && !(art && art.indoor) && !FLAT) {   // no rain inside a room
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
  balloons.length = captions.length = bursts.length = drops.length = 0; gusts = []; wind = null; ship = null; spot = null; fork = null; xing = null; mz = null; foes = [];
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
      size: 1, tint: null, alpha: 1, float: false, grounded: true, reach: 2.05, windT: .42, speed: 2.5, gone: false, safe: null, knockTo: null, guard: null, noRespawn: false });
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
    else if (this.float) { this.x += this.vx * dt; this.wx = this.x; this.wy = p.y0 + GROUND + this.y; }   // moved by a scene, not by the ground
    else {
      const px = this.x; this.x += this.vx * dt;
      for (const b of p.plats) if (b.solid && this.y < b.top - .25 && this.y > b.base - .3 && this.x > b.x0 - .35 && this.x < b.x1 + .35) this.x = px < (b.x0 + b.x1) / 2 ? b.x0 - .35 : b.x1 + .35;
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
    this.mesh.position.set(this.wx, this.wy + this.size * (BASE - CH / 2) / PPU, ZACT + this.zlift);
    this.mesh.scale.set(this.face * this.size, this.size, 1); this.mat.opacity = this.alpha; this.mesh.rotation.z = -this.spin * this.face;
    const f = this.hop ? 1 : this.panel.focus; this.mat.color.setScalar(this.tint != null ? this.tint : .84 + .16 * f);
  }
}
function spawn(c, p, lx, o = {}) { c.setPanel(p); c.x = p.x0 + lx; c.y = o.y || 0; if (o.y == null) { const f = floorAt(p, c.x, .3); if (f > -5) c.y = f; } c.vx = c.vy = 0; c.hop = null; c.gone = false; c.shown = o.shown !== false; c.grounded = true;
  c.face = o.face || 1; c.size = 1; c.tint = null; c.alpha = 1; c.float = false; c.state = 'idle'; c.st = 0; c.ai = false; c.free = true; c.ghost = false; c.relaxed = !!o.relaxed; c.knockTo = null; c.guard = null; c.spin = 0; c.snatch = c.hasCase = false; c.heavy = false;
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

let xing = null, mz = null, control = false, hudOn = false, time = 0, hitstop = 0, shake = 0, combo = 0, spot = null, fork = null;
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

// Where a story frame's balloon goes. The manifest says where each speaker's head is in the picture ("who": name -> [x, y, size], in fractions
// of the frame from its top-left; a speaker outside 0..1 is off-panel) and what else must stay readable ("keep"). The balloon takes the spot
// nearest its speaker that covers no face, and its tail points at the speaker.
function whoOf(p, v) { const m = (manifest.panels || {})[p.id] || {}; return { who: (v && m.vwho && m.vwho[v]) || m.who || {}, keep: (v && m.vkeep && m.vkeep[v]) || m.keep || [], sfx: (v && m.vsfx && m.vsfx[v]) || m.sfx }; }
function placeStory(p, v, l, rxW, ryW, n) {
  const { who, keep } = whoOf(p, v), W = (x, y) => [p.x0 + x * p.w, p.y1 - y * p.h];
  const heads = Object.entries(who).map(([name, [x, y, r = .11]]) => ({ name, on: x >= 0 && x <= 1 && y >= 0 && y <= 1, c: W(x, y), r: r * p.h }));
  const zones = keep.map(([x, y, r = .15]) => ({ c: W(x, y), r: r * p.h }));
  const key = (l.who || '').toLowerCase().trim(), me = l.t === 'radio' ? null : heads.find(h => h.name === key) || heads.find(h => key.startsWith(h.name) || h.name.startsWith(key));
  const inEll = (cx, cy, q, pad) => { const d = Math.hypot((cx - q.c[0]) / (rxW + q.r + pad), (cy - q.c[1]) / (ryW + q.r + pad)); return d < 1 ? 1 - d : 0; };
  let best = null, bc = 1e9;
  const xa = p.x0 + rxW + .25, xb = Math.max(xa, p.x1 - rxW - .25), ya = p.y0 + ryW + .3, yb = Math.max(ya, p.y1 - ryW * .45);   // may break out over the top border by half its height
  for (let i = 0; i <= 14; i++) for (let j = 0; j <= 10; j++) { const cx = xa + (xb - xa) * i / 14, cy = ya + (yb - ya) * j / 10; let c = 0;
    for (const h of heads) if (h.on) { const o = inEll(cx, cy, h, .25); if (o) c += 60 + 120 * o; }
    for (const z of zones) { const o = inEll(cx, cy, z, .1); if (o) c += 35 + 70 * o; }
    if (me) { const d = Math.hypot(cx - me.c[0], cy - me.c[1]); c += d / p.h * (me.on ? 14 : 6); if (me.on && cy < me.c[1]) c += 5;
      if (me.on) for (const h of heads) if (h !== me && h.on) for (let u = .25; u < 1; u += .15) if (Math.hypot(cx + (me.c[0] - cx) * u - h.c[0], cy + (me.c[1] - cy) * u - h.c[1]) < h.r) { c += 45; break; } }   // the tail must not cross somebody else's face
    else c += (p.y1 - cy) / p.h * 5 + Math.abs(cx - (n % 2 ? p.x1 - rxW - .3 : p.x0 + rxW + .3)) / p.w * 2;   // a voice with no body in the picture: up in a corner
    if (c < bc) { bc = c; best = [cx, cy]; } }
  const [fx, fy] = best; let tx = null, ty = null;
  if (me) { const dx = fx - me.c[0], dy = fy - me.c[1], d = Math.hypot(dx, dy) || 1;
    if (me.on) { tx = me.c[0] + dx / d * me.r * .7; ty = me.c[1] + dy / d * me.r * .7; }
    else { const u = Math.min(1, (Math.hypot(rxW, ryW) * .75 + 1.1) / d); tx = fx - dx * u; ty = fy - dy * u; } }   // an off-panel speaker: a short tail toward where they stand
  return { fx, fy, tx, ty };
}
// A story frame: the camera settles on the illustration and the reader taps through its lettering.
// a story frame with a picture per ending: put up the one that matches how the frame before it was played
function swapStory(p, v) { const img = v && p.art && p.art.variants && p.art.variants[v]; if (!img || p.shownV === v) return; p.shownV = v;
  const ly = panelLayers(p.def, { story: img, poi: (p.art.vpoi || {})[v] || p.art.poi })[0], u = p.mats[0].uniforms;
  u.map.value = tex(ly.canvas); u.mapB.value = tex(blurred(ly.canvas, ly.blur * SOFT)); }
async function storyFrame(id, hold = .9, v) {
  if (QS.has('skip')) return;   // ?skip=1 passes over the story frames, for checking the played ones
  const p = P[id], lines = v && p.def.variants && p.def.variants[v] ? p.def.variants[v].lines : p.def.lines;
  swapStory(p, v); enterPanel(p, .8);
  if (p.def.track === 'x') { let u = 0; const a = poiOf(p), end = a ? (a[0] - p.x0) / p.w : .85, start = end > .5 ? .15 : .85;   // the pan ends on the subject
    focusOn.eye = () => { u = Math.min(1, u + .0022); const e = u * u * (3 - 2 * u); return [p.x0 + p.w * (start + (end - start) * e), a ? a[1] : p.cy]; }; }
  await wait(hold);
  let n = 0, cur = null, k = clamp(p.w / 12, .62, 1);
  for (const s of p.def.lettered ? [] : lines) { const l = parseLine(s);
    if (l.t === 'cap') { caption(p, l.text); await wait(.8); continue; }
    if (l.t === 'sfx') { if (p.sfx) { await p.sfx(l.text); continue; } { const f = whoOf(p, v).sfx; burst(l.text, f ? p.x0 + f[0] * p.w : p.cx + (n % 2 ? -1 : 1) * p.w * .1, f ? p.y1 - f[1] * p.h : p.cy + p.h * .1, clamp(p.w / 11, .55, 1.3) * (f && f[2] || 1), 2, 1.3); } shake = .4; await wait(.9); continue; }
    if (cur) dropBalloon(cur);
    const b = L.balloon(wrap(l.text), l.t), rxW = b.rx * UNIT * k, ryW = b.ry * UNIT * k;
    cur = { b, k, ...placeStory(p, v, l, rxW, ryW, n) }; balloons.push(cur); n++;
    await tap(); }
  if (!n) { if (p.def.auto) await wait(p.def.auto); else await tap(); }
  if (cur) dropBalloon(cur);
}

// ---------- fighting
const WORDS = ['POW!', 'BAM!', 'WHAP!', 'THOK!'];
function knock(e) {   // the hit that sends someone out of this frame and into another
  const k = e.knockTo; e.knockTo = null; e.ai = false; e.free = true; e.set('down'); e.vx = e.vy = 0; e.grounded = false; e.flown = false; e.unclip(); e.face = -hero.face;
  e.hop = { x0: e.x, y0: e.wy + .5, x1: k.x, y1: k.p.y0 + GROUND + (k.y || 0), t: 0, dur: .8, h: k.h == null ? 2.6 : k.h, to: k.p, keep: true, spin: 6.283 * 1.5,
    done: () => { e.flown = true; shake = .8; if (k.word) burst(k.word, k.x, k.p.y0 + GROUND + (k.y || 0) + 5.2, 1.2, 2, 1); if (k.hide) e.shown = false; } };
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
  const x = hero.x + hero.face * 1.55, y = Math.max(hero.wy, e.wy) + 5.5;   // the word goes over their heads, not across them
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
  burst(word, hero.x, hero.wy + 5.3, .85, 1); hud();
  if (hero.hp <= 0 && onDown) { hero.set('down'); hero.vy = 6; const f = onDown; onDown = null; f(); }   // this time he stays down, and it costs him the package
  else if (hero.hp <= 0) { hero.set('down'); hero.vy = 6;
    lose(10); wait(1.7).then(() => { hero.hp = 5; hero.inv = 1.6; if (hero.state === 'down') hero.set('idle'); hud(); if (hero.shown) shout(hero, 'Not today.', 1.3); }); }
  else { hero.set('hurt'); hero.st = 0; }
}
function inReach(a, b) { const dx = (b.x - a.x) * a.face; return dx > .15 && dx < a.reach && Math.abs(a.y - b.y) < 1.5; }

function playHero() {
  if (xing && xing.live || mz && mz.live) return;
  let idle = hero.state === 'idle' || hero.state === 'walk';
  if (idle && !hero.grounded && !hero.hop) { hero.set('jump'); idle = false; }
  const air = hero.state === 'jump';
  if (control && (idle || air) && !hero.hop) {
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    hero.vx = dir * 4.4; if (dir) hero.face = dir;
    if (idle) hero.set(dir ? 'walk' : 'idle');
    if (idle && hero.grounded && pressed.dodge && time > (hero.cool || 0)) { hero.set('dodge'); hero.inv = Math.max(hero.inv, .36); hero.vx = -hero.face * 9; hero.cool = time + .75; }   // a quick step back out of reach
    else if (idle && hero.grounded && keys.block && !pressed.punch && !pressed.jump) { hero.set('block'); hero.vx = 0; }
    if (pressed.jump && idle && hero.grounded) { hero.vy = 11.4; hero.grounded = false; hero.set('jump'); }
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
      if (!e.struck && e.st > .04 && hero.state === 'dodge' && dist < e.reach + 2.6) { e.struck = true; burst('WHIFF!', e.x + e.face * 1.4, e.wy + 5.6, .8, 1, .8); e.set('hurt'); e.st = -.4; e.vx = e.face * 2; break; }   // he swings at air and is wide open
      if (!e.struck && e.st > .04 && hero.inv <= 0 && hero.state === 'block' && hero.face === -e.face && !e.heavy && inReach(e, hero)) { e.struck = true; burst('BLOCK!', hero.x + hero.face * .9, hero.wy + 5.3, .75, 0, .7); hero.vx = e.face * 2.6; hitstop = .05; shake = .15; }
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
// Painted objects cut from the props sheet (art/props.png, manifest "top.props"): one canvas per object, trimmed to its own edges.
const propCache = {};
function propCanvas(name, kind = 'props') { const key = kind + '/' + name; if (key in propCache) return propCache[key];
  const T = TOP[kind], r0 = T && T.rects[name]; if (!r0) return propCache[key] = null; if (!T.trim && kind !== 'run') topTrim(T);   // the runners keep their full squares, so every step is the same size
  const r = T.rects[name], f = T.f, c = document.createElement('canvas'); c.width = Math.round(r[2] * f); c.height = Math.round(r[3] * f);
  c.getContext('2d').drawImage(T.sheet, r[0] * f, r[1] * f, r[2] * f, r[3] * f, 0, 0, c.width, c.height); if (kind === 'run') clearDisc(c); return propCache[key] = c; }
// The painter keeps the guide's coloured disc behind each overhead runner: take it away, working in from the edges and stopping at the figure's ink outline.
function clearDisc(c) { const g = c.getContext('2d'), W = c.width, H = c.height, im = g.getImageData(0, 0, W, H), d = im.data; let R = 0, G = 0, B = 0, n = 0;
  for (let a = 0; a < 64; a++) { const x = Math.round(W / 2 + Math.cos(a / 64 * 6.283) * W * .44), y = Math.round(H / 2 + Math.sin(a / 64 * 6.283) * H * .44), i = (y * W + x) * 4; if (d[i + 3] > 200) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; } }
  if (n < 8) return; R /= n; G /= n; B /= n; const seen = new Uint8Array(W * H), st = [];
  for (let x = 0; x < W; x++) st.push(x, x + (H - 1) * W); for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) { const j = st.pop(); if (seen[j]) continue; const i = j * 4; if (!(d[i + 3] < 40 || Math.abs(d[i] - R) + Math.abs(d[i + 1] - G) + Math.abs(d[i + 2] - B) < 70)) continue;
    seen[j] = 1; d[i + 3] = 0; const x = j % W; if (x > 0) st.push(j - 1); if (x < W - 1) st.push(j + 1); if (j >= W) st.push(j - W); if (j < W * (H - 1)) st.push(j + W); }
  g.putImageData(im, 0, 0); }
function propMesh(p, name, w, order = .1) { const c = propCanvas(name); if (!c) return null; const h = w * c.height / c.width;
  const m = put(new THREE.Mesh(new THREE.PlaneGeometry(w, h), clipMat({ map: tex(c), side: THREE.DoubleSide }, p.ref))); m.renderOrder = p.charOrder + order; m.userData = { w, h }; return m; }
// Something Milo picks up: it sits where the picture has a surface for it, and when he takes it it swings to his hands and is gone.
function setDown(p, name, x, y, w) { const m = propMesh(p, name, w, -.05); if (!m) return null; m.renderOrder = p.base + 15; m.position.set(p.x0 + x, p.y0 + GROUND + y + m.userData.h / 2, ZACT); return m; }
async function takeUp(m, word) { hero.set('punch'); if (!m) { burst(word, hero.x + 1.2, hero.wy + 2.6, .6, 1, .9); await wait(.3); return; }
  const x0 = m.position.x, y0 = m.position.y; burst(word, x0, y0 + .2, .6, 1, .9); let u = 0; m.renderOrder = hero.mesh.renderOrder + .1;
  await until(dt => { u = Math.min(1, u + dt / .38); const e = u * u * (3 - 2 * u); m.position.set(x0 + (hero.x + hero.face * .5 - x0) * e, y0 + (hero.wy + 1.7 - y0) * e + Math.sin(Math.PI * u) * .5, ZACT); m.scale.setScalar(1 - .45 * e); return u >= 1; });
  m.visible = false; hero.set('idle'); }
function dropCrate(p, x, y, name = 'box') { const pc = propCanvas(name), mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(pc ? 1.3 * pc.width / pc.height : 1.3, 1.3), clipMat({ map: tex(pc || blockCanvas('crate', 1.3, 1.3, 2)) }, p.ref)));
  mesh.renderOrder = p.charOrder + .1; drops.push({ mesh, p, x, y, vy: 0 }); }
// Where a point of a story picture (fractions from its left and top) sits on the page, and a patch laid over part of the picture.
function picRect(p, fx0, fy0, fx1, fy1) { const img = p.art && p.art.story; if (!img) return null; const poi = p.art.poi || [.5, .5], S = 1.03;
  const Bw = p.w + .8, Bh = p.h + .8, su = Math.max(Bw / img.width, Bh / img.height), left = -.4 + (Bw - img.width * su) * poi[0], top = p.h + .4 - (Bh - img.height * su) * poi[1];
  const X = f => p.cx + (left + f * img.width * su - p.w / 2) * S, Y = f => p.cy + (top - f * img.height * su - p.h / 2) * S;
  return { x: (X(fx0) + X(fx1)) / 2, y: (Y(fy0) + Y(fy1)) / 2, w: X(fx1) - X(fx0), h: Y(fy0) - Y(fy1), X, Y }; }
function picQuad(p, r, canvas) { const q = picRect(p, ...r); if (!q) return null;
  const mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(q.w, q.h), clipMat({ map: tex(canvas) }, p.ref))); mesh.position.set(q.x, q.y, -.58); mesh.renderOrder = p.charOrder; return mesh; }
function shadeCanvas() { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.translate(128, 112); g.scale(1, 1.25); const gr = g.createRadialGradient(0, 0, 30, 0, 0, 100); gr.addColorStop(0, 'rgba(10,13,30,.93)'); gr.addColorStop(.55, 'rgba(10,13,30,.86)'); gr.addColorStop(1, 'rgba(10,13,30,0)');
  g.fillStyle = gr; g.fillRect(-128, -128, 256, 256); return c; }
// The men from the van, as dark figures crossing the pavement and going in at the front door. Needs the version of the picture without the painted men (manifest: "clean": true).
let vanMan = null;
async function vanWalk() { const p = P['2.6'], a = (manifest.panels || {})['2.6'] || {}; if (!a.clean || !picRect(p, 0, 0, 1, 1)) return;
  for (const [sx, sy, w, h, dx] of a.cover || []) { const img = p.art.story, c = document.createElement('canvas'), g = c.getContext('2d'), f = 14;   // paint over the men drawn in the picture with a clean piece of wall and pavement from beside them
    c.width = w; c.height = h; g.drawImage(img, sx, sy, w, h, 0, 0, w, h); g.globalCompositeOperation = 'destination-in';
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(f / w, '#000'); gr.addColorStop(1 - f / w, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    picQuad(p, [dx / img.width, sy / img.height, (dx + w) / img.width, (sy + h) / img.height], c); }
  const q = picRect(p, 0, 0, 1, 1), at = (fx, fy) => [q.X(fx), q.Y(fy) - (p.y0 + GROUND)], men = [thug, goon, tax1];
  await wait(1.4);
  await Promise.all(men.map(async (c, i) => { await wait(i * 1.0);
    const [x0, y0] = at(.33, .865 + i * .012), [x1] = at(.50, 0), [x2, y2] = at(.497, .71);
    spawn(c, p, x0 - p.x0, { face: 1 }); c.float = true; c.y = y0; c.size = .58; c.tint = .03;
    await walkTo(c, x1, 1.5); c.set('walk'); let u = 0;
    await until(dt => { u = Math.min(1, u + dt / 1.5); c.x = x1 + (x2 - x1) * u; c.y = y0 + (y2 - y0) * u; c.size = .58 - .24 * u; c.alpha = u < .75 ? 1 : 1 - (u - .75) / .25; c.phase += dt * 5; return u >= 1; });
    c.shown = false; c.alpha = 1; c.size = 1; c.tint = null; c.float = false; })); }
// A figure moved through a story picture by the script, nobody at the controls (the picture is painted with nobody in it).
// Each point is [across, down, size, seconds, how]: where the feet are as fractions of the picture, how big the figure is there,
// how long the leg to that point takes, and how it is done: a number = a jump that high, 'slip' = a stumble on arrival, 'word:TEXT' = a sound word on arrival.
async function runThrough(id, c, pts, o = {}) { const p = P[id]; enterPanel(p, .8); const q = picRect(p, 0, 0, 1, 1);
  if (!o.talk) for (const s of p.def.lines || []) { const l = parseLine(s); if (l.t === 'cap') caption(p, l.text); }   // what this stretch of the year was
  if (!q) { await wait(p.def.auto || 1.5); return; }
  const at = ([fx, fy, s]) => [q.X(fx), q.Y(fy) - (p.y0 + GROUND), s];
  await wait(o.hold == null ? .7 : o.hold);
  const [sx, sy, ss] = at(pts[0]); spawn(c, p, sx - p.x0, { face: 1 }); c.float = true; c.y = sy; c.size = ss; c.grounded = true; c.wx = c.x; c.wy = p.y0 + GROUND + c.y;
  if (o.talk) { c.set('idle'); await o.talk(); }   // he stands there for the frame's conversation first
  for (let i = 1; i < pts.length; i++) { const [x1, y1, s1] = at(pts[i]), dur = pts[i][3] || 1, how = pts[i][4], x0 = c.x, y0 = c.y, s0 = c.size, up = typeof how === 'number' ? how : 0; let u = 0;
    c.face = Math.sign(x1 - x0) || c.face; c.set(up ? 'jump' : 'walk'); c.grounded = !up;
    await until(dt => { u = Math.min(1, u + dt / dur); c.x = x0 + (x1 - x0) * u; c.y = y0 + (y1 - y0) * u + Math.sin(Math.PI * u) * up; c.size = s0 + (s1 - s0) * u; if (o.fade && i === pts.length - 1) c.alpha = 1 - u * u; if (!up) c.phase += dt * 11; return u >= 1; });
    c.grounded = true;
    if (how === 'slip') { c.set('hurt'); shake = .25; burst('WHOA!', c.x + 1.2, c.wy + 4.6 * c.size, .8, 1, .8); await wait(.55); }
    else if (typeof how === 'string' && how.startsWith('word:')) { burst(how.slice(5), c.x, c.wy + 5 * c.size, .9, 2, .9); shake = .35; } }
  c.shown = false; c.size = 1; c.alpha = 1; c.float = false; c.set('idle'); await wait(o.after == null ? .5 : o.after);
}
function addSpot(p, r, pos) { const mesh = put(new THREE.Mesh(new THREE.CircleGeometry(r, 48), clipMat({ color: 0xfff3b0, opacity: .26, blending: THREE.AdditiveBlending }, p.ref)));
  mesh.renderOrder = p.base + 17; spot = { mesh, p, r, pos, heat: 0 }; }
function addFork(p) { const fc = TOP.fork || forkliftCanvas(), mesh = put(new THREE.Mesh(new THREE.PlaneGeometry(4.4 * fc.width / fc.height, 4.4), clipMat({ map: tex(fc), side: THREE.DoubleSide }, p.ref)));
  mesh.renderOrder = p.charOrder + .2; mesh.visible = false; fork = { mesh, p, x: 0, vx: 0 }; }
// The avenue seen from above: lanes run up and down the frame and Milo crosses left to right.
const LANE0 = 3, LANEW = 3.2;
const TOP = {};
// one painted piece cut from a sheet (rectangles are in the layout guide's pixels, see tools/topguides.py), drawn to fill x, y, w, h; turn = lying on its side
function topTrim(T) { const g = T.sheet.getContext('2d'), f = T.f;   // the painter leaves a little green round each piece: tighten every rectangle to what is really there
  for (const k in T.rects) { const [x, y, w, h] = T.rects[k].map(v => Math.round(v * f)), d = g.getImageData(x, y, w, h).data; let x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (d[(j * w + i) * 4 + 3] > 128) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    if (x1 > x0 && y1 > y0) T.rects[k] = [(x + x0) / f, (y + y0) / f, (x1 - x0 + 1) / f, (y1 - y0 + 1) / f]; } T.trim = true; }
function topPiece(g, kind, name, x, y, w, h, turn) { const T = TOP[kind], r0 = T && T.rects[name]; if (!r0) return false; if (!T.trim) topTrim(T); const r = T.rects[name], f = T.f;
  g.save(); if (turn) { g.translate(x + w, y); g.rotate(Math.PI / 2); g.drawImage(T.sheet, r[0] * f, r[1] * f, r[2] * f, r[3] * f, 0, 0, h, w); } else g.drawImage(T.sheet, r[0] * f, r[1] * f, r[2] * f, r[3] * f, x, y, w, h);
  g.restore(); return true; }
function topFill(g, img, W, H) { const s = Math.max(W / img.width, H / img.height), sw = W / s, sh = H / s; g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H); }   // a whole picture laid over the frame, middle kept
function roadCanvas(w, h) { const k = 40, c = document.createElement('canvas'); c.width = w * k; c.height = h * k; const g = c.getContext('2d');
  if (TOP.road) { topFill(g, TOP.road, c.width, c.height); return c; }
  g.fillStyle = '#23263a'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#4b4763'; g.fillRect(0, 0, LANE0 * k, c.height); g.fillRect((LANE0 + 6 * LANEW) * k, 0, c.width, c.height);
  g.fillStyle = '#31344d'; g.fillRect((LANE0 + 4 * LANEW) * k, 0, LANEW * k, c.height);
  g.strokeStyle = '#8a8fa8'; g.lineWidth = 4; for (const u of [.25, .75]) { g.beginPath(); g.moveTo((LANE0 + (4 + u) * LANEW) * k, 0); g.lineTo((LANE0 + (4 + u) * LANEW) * k, c.height); g.stroke(); }
  g.strokeStyle = '#d8d2bd'; g.lineWidth = 3; g.setLineDash([k * .8, k * .6]);
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo((LANE0 + i * LANEW) * k, 0); g.lineTo((LANE0 + i * LANEW) * k, c.height); g.stroke(); }
  return c; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function carCanvas(len, col, name) { const k = 64, c = document.createElement('canvas'); c.width = 1.8 * k; c.height = len * k; const g = c.getContext('2d'), W2 = c.width, H2 = c.height;
  if (topPiece(g, 'cars', name, 0, 0, W2, H2)) return c;
  g.fillStyle = col; g.strokeStyle = '#0d0a12'; g.lineWidth = 5; rr(g, 4, 4, W2 - 8, H2 - 8, 14); g.fill(); g.stroke();
  g.fillStyle = '#10142c'; g.fillRect(W2 * .18, Math.min(H2 * .2, 34), W2 * .64, 16); if (len < 4) g.fillRect(W2 * .18, H2 - 40, W2 * .64, 12);
  g.fillStyle = '#fff3b0'; g.fillRect(W2 * .14, 6, 14, 7); g.fillRect(W2 * .86 - 14, 6, 14, 7);
  return c; }
function markerCanvas() { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  if (topPiece(g, 'yard', 'milo', 0, 0, 128, 128)) return c; g.scale(128 / 96, 128 / 96);
  g.fillStyle = '#5a3a1e'; g.strokeStyle = '#0d0a12'; g.lineWidth = 5; rr(g, 8, 32, 30, 34, 6); g.fill(); g.stroke();   // the bag
  g.fillStyle = '#f2b21c'; g.beginPath(); g.ellipse(54, 48, 28, 38, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#c98a0f'; g.beginPath(); g.arc(58, 48, 16, 0, 7); g.fill(); g.stroke();
  return c; }
// Somebody seen from straight above, running: four painted steps (art/top_run.png) played by how far they have gone, turned to face the way they are heading.
function runner(p, kind, size, order) { const fr = [0, 1, 2, 3].map(i => propCanvas(kind + i, 'run')); if (!fr[0]) return null;
  const texs = fr.map(c => tex(c)), m = put(new THREE.Mesh(new THREE.PlaneGeometry(size, size), clipMat({ map: texs[1] }, p.ref))); m.renderOrder = p.base + order;
  return { m, d: 0, px: null, py: 0, set(x, y) { if (this.px != null) { const dx = x - this.px, dy = y - this.py, d = Math.hypot(dx, dy);
      if (d > .004 && d < 1) { this.d += d; m.rotation.z = Math.atan2(dy, dx); m.material.map = texs[Math.floor(this.d / (size * .5)) % 4]; } else if (d <= .004) m.material.map = texs[1]; }
    this.px = x; this.py = y; m.position.set(x, y, ZACT); } }; }
async function crossing(p) {
  enterPanel(p);
  const flat = (w, h, canvas, order) => { const m = put(new THREE.Mesh(new THREE.PlaneGeometry(w, h), clipMat({ map: tex(canvas) }, p.ref))); m.renderOrder = p.base + order; return m; };
  flat(p.w, p.h, roadCanvas(p.w, p.h), 8).position.set(p.cx, p.cy, 0);
  const defs = [[-3, 2.4, 7, '#c9302c'], [3.6, 2.4, 7.5, '#3f7fd0'], [-5, 2.4, 8.5, '#e8e2d0'], [2.8, 5.2, 11, '#e09a1f'], [-9.5, 9, 24, '#7fb8a8'], [5.5, 2.4, 10, '#8a5ac0']];
  const lanes = defs.map(([v, len, gap, col], i) => { const n = Math.ceil((p.h + 2 * len + 2) / gap) + 1, cv = tex(carCanvas(len, col, ['car_red', 'car_blue', 'car_white', 'truck', 'tram', 'car_purple'][i]));
    return { v, len, cyc: n * gap, cx: LANE0 + (i + .5) * LANEW, cars: Array.from({ length: n }, (_, j) => {
      const m = put(new THREE.Mesh(new THREE.PlaneGeometry(1.8, len), clipMat({ map: cv }, p.ref))); m.renderOrder = p.base + 9; m.scale.y = v > 0 ? 1 : -1; return { y: j * gap + i * 1.7, m }; }) }; });
  const rn = runner(p, 'milo', 1.5, 10), marker = rn ? rn.m : flat(1.2, 1.2, markerCanvas(), 10);
  xing = { p, lanes, marker, rn, tx: 1.4, ty: p.h * .5, inv: 0, live: true };
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
  if (X.rn) X.rn.set(p.x0 + X.tx, p.y0 + X.ty); else X.marker.position.set(p.x0 + X.tx, p.y0 + X.ty, ZACT); X.marker.visible = !(X.inv > 0 && Math.floor(time * 14) % 2 === 0);
}
// The container maze, seen from straight overhead like the avenue: stacked containers are the walls, the lanes between them are the way through.
// Milo comes in at the gate on the left and has to reach the lane to Crane 4 on the right, with a yard man on his heels and a second one cutting him off.
const MZ = { C: 35, R: 9, s: .7, ox: .15, oy: .25, in: 3, out: 5 };
function mazeGrid(seed) { const { C, R } = MZ; let a = seed >>> 0; const rnd = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const g = Array.from({ length: R }, () => Array(C).fill(1)), st = [[1, MZ.in]]; g[MZ.in][1] = 0;
  while (st.length) { const [c, r] = st[st.length - 1], o = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dc, dr]) => c + dc > 0 && c + dc < C - 1 && r + dr > 0 && r + dr < R - 1 && g[r + dr][c + dc]);
    if (!o.length) { st.pop(); continue; } const [dc, dr] = o[Math.floor(rnd() * o.length)]; g[r + dr / 2][c + dc / 2] = 0; g[r + dr][c + dc] = 0; st.push([c + dc, r + dr]); }
  for (let n = 0; n < 16;) { const c = 1 + Math.floor(rnd() * (C - 2)), r = 1 + Math.floor(rnd() * (R - 2)); if ((c + r) % 2 && g[r][c]) { g[r][c] = 0; n++; } }   // extra gaps: more than one way round, so he can double back on them
  g[MZ.in][0] = 0; g[MZ.out][C - 1] = 0; return g; }
function mazeCanvas(p, grid) { const k = 64, { C, R, s, ox, oy } = MZ, c = document.createElement('canvas'); c.width = p.w * k; c.height = p.h * k; const g = c.getContext('2d'), H = c.height;
  const X = cc => (ox + cc * s) * k, Y = r => H - (oy + (r + 1) * s) * k, S = s * k;
  const art = !!TOP.yard;
  if (TOP.floor) { topFill(g, TOP.floor, c.width, H); g.fillStyle = 'rgba(8,8,20,.35)'; g.fillRect(0, 0, c.width, H); } else {
  g.fillStyle = '#1c1f29'; g.fillRect(0, 0, c.width, H);
    for (let i = 0; i < 900; i++) { g.fillStyle = i % 3 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.22)'; g.fillRect(Math.random() * c.width, Math.random() * H, 2 + Math.random() * 5, 2); }   // wet tarmac
    for (const [fx, fy] of [[.12, .3], [.38, .75], [.62, .25], [.88, .7]]) { const q = g.createRadialGradient(fx * c.width, fy * H, 0, fx * c.width, fy * H, 3.4 * k); q.addColorStop(0, 'rgba(255,214,140,.30)'); q.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = q; g.fillRect(0, 0, c.width, H); }   // floodlight pools
    g.fillStyle = '#e8b21c'; for (let r = 1; r < R; r += 2) for (let cc = 1; cc < C - 1; cc++) if (!grid[r][cc] && cc % 2 === 0) g.fillRect(X(cc) + S * .3, Y(r) + S * .47, S * .4, S * .06);   // lane dashes
  }
  const cols = ['#a8402f', '#2f5f93', '#3f7a52', '#c97a24', '#3d8a8a', '#6b6f7a', '#8c2f3a', '#b89a2e'], done = grid.map(r => r.map(() => 0)); let n = 0;
  const box = (x, y, w, h, col, tall) => { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x + 7, y + 8, w, h);   // its shadow
    if (art && topPiece(g, 'yard', col, x + 1, y + 1, w - 2, h - 2, tall)) return;
    g.fillStyle = col; g.strokeStyle = '#0d0a12'; g.lineWidth = 4; rr(g, x + 2, y + 2, w - 4, h - 4, 3); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2; g.beginPath(); if (tall) for (let v = y + 9; v < y + h - 6; v += 7) { g.moveTo(x + 6, v); g.lineTo(x + w - 6, v); } else for (let u = x + 9; u < x + w - 6; u += 7) { g.moveTo(u, y + 6); g.lineTo(u, y + h - 6); } g.stroke();   // the ribbed roof
    g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x + 5, y + 5, w - 10, 4); };
  for (let r = R - 1; r >= 0; r--) for (let cc = 0; cc < C; cc++) { if (!grid[r][cc] || done[r][cc]) continue;
    let w = 1; while (w < 3 && cc + w < C && grid[r][cc + w] && !done[r][cc + w]) w++;
    let h = 1; if (w === 1) while (h < 3 && r - h >= 0 && grid[r - h][cc] && !done[r - h][cc]) h++;
    for (let i = 0; i < w; i++) done[r][cc + i] = 1; for (let i = 0; i < h; i++) done[r - i][cc] = 1;
    if (w === 1 && h === 1) { if (art) { box(X(cc), Y(r), S, S, 'crate' + n++ % 2); continue; } box(X(cc), Y(r), S, S, '#7a5a34'); g.strokeStyle = '#0d0a12'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(cc) + 6, Y(r) + 6); g.lineTo(X(cc) + S - 6, Y(r) + S - 6); g.moveTo(X(cc) + S - 6, Y(r) + 6); g.lineTo(X(cc) + 6, Y(r) + S - 6); g.stroke(); }   // a lone crate
    else { const len = Math.max(w, h); box(X(cc), Y(r), w * S, h * S, art ? (len > 2 ? 'long' + n++ * 5 % 6 : 'short' + n++ * 3 % 4) : cols[n++ * 5 % cols.length], h > 1); } }
  g.fillStyle = '#e8b21c'; g.font = 'bold 22px Impact, sans-serif'; g.textAlign = 'right'; g.fillText('CRANE 4  ▶', c.width - 6, Y(MZ.out) - 4);
  return c; }
function manCanvas() { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');   // a yard man from above: orange vest, white hard hat
  if (topPiece(g, 'yard', 'man', 0, 0, 128, 128)) return c; g.scale(128 / 96, 128 / 96);
  g.strokeStyle = '#0d0a12'; g.lineWidth = 5; g.fillStyle = '#e2681c'; g.beginPath(); g.ellipse(48, 48, 30, 40, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#f2e63a'; g.fillRect(22, 30, 52, 6); g.fillRect(22, 60, 52, 6);
  g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(52, 48, 18, 0, 7); g.fill(); g.stroke(); return c; }
const mzCell = (x, y) => [Math.floor((x - MZ.ox) / MZ.s), Math.floor((y - MZ.oy) / MZ.s)], mzMid = n => n * MZ.s + MZ.s / 2;
const mzWall = (M, c, r) => c < 0 || r < 0 || c >= MZ.C || r >= MZ.R || M.grid[r][c] === 1;
function mzStep(M, from, to) {   // the next square on the shortest way from one square to another
  const { C, R } = MZ, prev = new Map([[to[0] + to[1] * C, -1]]), q = [to];
  while (q.length) { const [c, r] = q.shift(); if (c === from[0] && r === from[1]) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = c + dc + (r + dr) * C; if (!mzWall(M, c + dc, r + dr) && !prev.has(k)) { prev.set(k, c + r * C); q.push([c + dc, r + dr]); } } }
  const k = prev.get(from[0] + from[1] * C); return k == null || k < 0 ? from : [k % C, Math.floor(k / C)]; }
async function maze(p) {
  enterPanel(p);
  const flat = (w, h, canvas, order) => { const m = put(new THREE.Mesh(new THREE.PlaneGeometry(w, h), clipMat({ map: tex(canvas) }, p.ref))); m.renderOrder = p.base + order; return m; };
  const grid = mazeGrid(51); flat(p.w, p.h, mazeCanvas(p, grid), 8).position.set(p.cx, p.cy, 0);
  const man = () => { const rn = runner(p, 'man', .95, 9); return { rn, m: rn ? rn.m : flat(.62, .62, manCanvas(), 9), c: 0, r: MZ.in, x: 0, y: 0, to: null, stun: 0, on: false }; };
  const mrn = runner(p, 'milo', .95, 10);
  mz = { p, grid, rn: mrn, marker: mrn ? mrn.m : flat(.6, .6, markerCanvas(), 10), x: MZ.ox + mzMid(0), y: MZ.oy + mzMid(MZ.in), inv: 0, live: true, t: 0, men: [Object.assign(man(), { v: 2.45, at: 2.2 }), Object.assign(man(), { v: 2.1, at: -1, c: MZ.C - 1, r: MZ.out })] };
  for (const w of mz.men) { w.x = MZ.ox + mzMid(w.c); w.y = MZ.oy + mzMid(w.r); w.m.visible = false; }
  focusOn.eye = () => [p.x0 + mz.x, p.y0 + mz.y];
  hudOn = true; hud(); control = true; hint('Through the yard to Crane 4:  ◀ ▶  and  UP / DOWN  -  lose the yard men'); $('bD').style.display = '';
  wait(2.2).then(() => { if (mz && mz.live) burst('HEY!', p.x0 + 1.2, p.y0 + MZ.oy + mzMid(MZ.in) + .9, .6, 2, 1); });
  await until(() => mzCell(mz.x, mz.y)[0] >= MZ.C - 1);
  $('bD').style.display = 'none'; mz.live = false; mz.marker.visible = false; for (const w of mz.men) w.m.visible = false; control = false; hudOn = false; hud(); hint(''); await wait(.3);
}
function mazeTick(dt) { const M = mz, p = M.p, { s, ox, oy } = MZ; if (!M.live) return;
  M.t += dt; M.inv = Math.max(0, M.inv - dt);
  const hit = (x, y) => { for (const [a, b] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) { const [c, r] = mzCell(x + a, y + b); if (mzWall(M, c, r)) return true; } return false; };
  if (control) { const dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), dy = (keys.jump ? 1 : 0) - (keys.down ? 1 : 0), v = 3.4 * dt, [c, r] = mzCell(M.x, M.y);
    if (dx && !hit(M.x + dx * v, M.y)) M.x += dx * v; if (dy && !hit(M.x, M.y + dy * v)) M.y += dy * v;
    if (dx && !dy) { const y = M.y + clamp(oy + mzMid(r) - M.y, -v * .8, v * .8); if (!hit(M.x, y)) M.y = y; }   // ease him on to the middle of the lane, so turning a corner never snags
    if (dy && !dx) { const x = M.x + clamp(ox + mzMid(c) - M.x, -v * .8, v * .8); if (!hit(x, M.y)) M.x = x; } }
  const me = mzCell(M.x, M.y);
  if (M.men[1].at < 0 && me[0] >= 15) { M.men[1].at = M.t; burst('THERE!', p.x0 + ox + mzMid(MZ.C - 2), p.y0 + oy + mzMid(MZ.out) + .9, .6, 2, 1); }   // the second one comes in from the far end
  for (const w of M.men) { w.on = w.at >= 0 && M.t >= w.at; w.m.visible = w.on; if (!w.on) continue;
    w.stun = Math.max(0, w.stun - dt);
    if (w.stun <= 0) { if (!w.to) w.to = mzStep(M, [w.c, w.r], me);
      const tx = ox + mzMid(w.to[0]), ty = oy + mzMid(w.to[1]), d = Math.hypot(tx - w.x, ty - w.y), v = w.v * dt;
      if (d <= v) { w.x = tx; w.y = ty; [w.c, w.r] = w.to; w.to = null; } else { w.x += (tx - w.x) / d * v; w.y += (ty - w.y) / d * v; } }
    if (M.inv <= 0 && Math.hypot(w.x - M.x, w.y - M.y) < .46) { hero.hp--; M.inv = 1.8; shake = .5; hitstop = .07; burst('GOTCHA!', p.x0 + M.x, p.y0 + M.y + .9, .6, 1); for (const o of M.men) o.stun = 1.5;   // he twists loose: both of them lose a step
      if (hero.hp <= 0) { hero.hp = 5; M.x = ox + mzMid(0); M.y = oy + mzMid(MZ.in); M.t = 0; M.men[0].at = 2.2; M.men[1].at = -1; M.men.forEach((o, i) => { o.c = i ? MZ.C - 1 : 0; o.r = i ? MZ.out : MZ.in; o.x = ox + mzMid(o.c); o.y = oy + mzMid(o.r); o.to = null; }); lose(10, p.x0 + M.x + 1.5, p.y0 + M.y + 1); } hud(); }
    if (w.rn) w.rn.set(p.x0 + w.x, p.y0 + w.y); else w.m.position.set(p.x0 + w.x, p.y0 + w.y, ZACT); }
  if (M.rn) M.rn.set(p.x0 + M.x, p.y0 + M.y); else M.marker.position.set(p.x0 + M.x, p.y0 + M.y, ZACT); M.marker.visible = !(M.inv > 0 && Math.floor(time * 14) % 2 === 0);
}
// A gust of wind: painted streaks that blow across the frame from one side, with the word riding on them. `wind` keeps them coming in a frame and shoves Milo while each one passes.
let gusts = [], wind = null;
function gust(p, y, dir, word = 'WHOOSH') { const m = propMesh(p, Math.random() < .5 ? 'gust1' : 'gust2', 7.5, .2); if (!m) { burst(word, hero.x + 2.5 * -dir, y + 1.5, .7, 1, .8); return; }
  m.scale.x = dir; m.material.opacity = .9; gusts.push({ m, p, x: dir > 0 ? p.x0 - 4 : p.x1 + 4, y, dir, v: p.w < 14 ? 13 : 21 });
  burst(word, dir > 0 ? p.x0 + 2.6 : p.x1 - 2.6, y + 1.3, .55, 1, .7); }
function things(dt) {
  if (ship) shipTick(dt);
  for (let i = gusts.length - 1; i >= 0; i--) { const g = gusts[i]; g.x += g.dir * g.v * dt; g.m.position.set(g.x, g.y + Math.sin(g.x * .7) * .15, ZACT + .03);
    if (g.x < g.p.x0 - 6 || g.x > g.p.x1 + 6) { scene.remove(g.m); gusts.splice(i, 1); } }
  if (wind && control && hero.panel === wind.p) { const w = wind; w.t -= dt;
    if (w.t < 0 && w.push <= 0) { w.dir = w.alt ? -w.dir : w.dir; gust(w.p, hero.wy + 2.3, w.dir); w.push = w.dur; w.t = w.gap[0] + Math.random() * (w.gap[1] - w.gap[0]); }
    if (w.push > 0) { w.push -= dt; hero.x += w.dir * w.force * dt; } }
  if (xing) crossTick(dt);
  if (mz) mazeTick(dt);
  for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.vy -= 22 * dt; d.y += d.vy * dt; d.mesh.position.set(d.x, d.p.y0 + GROUND + d.y + .65, ZACT); d.mesh.rotation.z += dt * 2;
    const hit = hero.panel === d.p && hero.shown && hero.inv <= 0 && hero.state !== 'down' && Math.abs(hero.x - d.x) < .95 && d.y < hero.y + 3 && d.y > hero.y - .4;
    if (hit) hurtHero(Math.sign(hero.x - d.x) || 1, 'KLONK!');
    if (hit || d.y < hero.y - 9 || d.y < -GROUND - 2) { scene.remove(d.mesh); drops.splice(i, 1); } }
  if (spot) { const [lx, ly] = spot.pos(time), sx = spot.p.x0 + lx, sy = spot.p.y0 + ly; spot.mesh.position.set(sx, sy, ZACT + .05);
    const inside = control && hero.panel === spot.p && Math.hypot(hero.x - sx, hero.wy + 1.7 - sy) < spot.r;
    if (spot.heat < 0) spot.heat += dt; else if (inside) spot.heat += dt; else spot.heat = Math.max(0, spot.heat - dt);
    if (spot.heat > .45) { spot.heat = -2.2; burst('SPOTTED!', hero.x, hero.wy + 4.2, .7, 1); dropCrate(spot.p, hero.x + hero.vx * .45, hero.y + 9, 'crate'); } }
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
    burst('YOINK!', hero.x, hero.wy + 5.3, .9, 1, 1); await wait(.9);
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
  enterPanel(b); spawn(keeper, b, 11.7, { face: -1, relaxed: true }); const parcel = setDown(b, 'package', ...((manifest.panels['P0.3'] || {}).item || [8.6, 2.2, 1.0])); await heroEnters(b, 2);   // he stands at the far end of the counter, in full view
  await say(keeper, "You're the new kid?"); await say(hero, "Depends who's asking."); await say(keeper, "You Danny's brother?"); await say(hero, '...'); await say(hero, 'Was.');
  hero.free = false; control = true; hint('Walk to the counter');
  await until(() => hero.x > b.x0 + 7.0); control = false; hero.vx = 0; hero.set('idle'); hero.face = 1;
  await press('J or X: take the package'); await takeUp(parcel, 'GOT IT');
  await say(keeper, 'He was better at this.'); await say(hero, "I'm getting that a lot.");
  hero.free = true; await walkTo(hero, b.x0 - 1.6, 3.6); hero.shown = false; keeper.shown = false;
  // the clock
  enterPanel(c); await heroEnters(c, 2.2);
  await say(hero, 'You have eight minutes.', 'radio'); await say(hero, 'For three blocks?'); await say(hero, 'Then this should\nbe easy.', 'radio');
  setClock(8, 26, 18, 12);
  startAction('Beat the clock for a bonus  •  along the street or up on the platform, just keep moving'); hudOn = false; hud();
  chat([[hero, 'You ever consider\nbeing encouraging?', 1.8], dot('No.', 1.1)]);
  await until(() => hero.x > c.x1 - 1.6 && hero.grounded && !hero.busy);
  await endAction(); await walkTo(hero, c.x1 + 1.6, 4); hero.shown = false;
}

async function prologue2() {
  if (QS.get('frame') !== 'P0.6') await packageTax();   // ?page=P2&frame=P0.6 starts at Danny's book
  await yearPasses();
}
async function packageTax() {
  const a = P['P0.5']; enterPanel(a);
  if (!clock.on) setClock(8, 26, 18, 12);
  spawn(tax1, a, a.w - 6.5, { face: -1, relaxed: true, hp: 9 }); spawn(tax2, a, a.w - 4.2, { face: -1, relaxed: true, hp: 9 });
  await heroEnters(a, 4.5);
  await say(tax1, 'Package tax.'); await say(hero, "There's no\npackage tax."); await say(tax2, 'There is now.');
  tax1.guard = tax2.guard = () => true;   // try as he might
  arm(tax1, { speed: 3, wait: .5, windT: .34 }); arm(tax2, { speed: 2.6, wait: 1.1, windT: .38 });
  startAction('J punch  •  K block  •  L dodge'); hero.hp = 3; hud();
  await Promise.race([encounter(a, [tax1, tax2], { noExit: true }), wait(11).then(() => { if (onDown) { onDown = null; hero.inv = 0; hero.hp = 1; hurtHero(-1, 'SHOVE!'); hero.set('down'); control = false; hint(''); burst('YOINK!', hero.x, hero.wy + 5.3, .9, 1, 1);
    for (const e of [tax1, tax2]) { e.ai = false; e.free = true; e.ghost = true; walkTo(e, a.x1 + 2.5, 5).then(() => { e.shown = false; }); } } })]);
  await until(() => !tax1.shown && !tax2.shown); foes = [];
  hero.hp = 5; hero.inv = 0; hero.set('idle'); hero.face = 1; hudOn = false; hud(); hero.relaxed = true;
  await say(hero, 'Hey! Come back!'); clock.on = false;
  await say(hero, 'Milo? Status?', 'radio'); await say(hero, 'Package is gone.'); await say(hero, 'You lose it?', 'radio');
  await say(hero, "No, Dot. I gave it away.\nThought I'd be generous."); await say(hero, "I'll mark it lost.", 'radio'); await say(hero, "That's it?"); await say(hero, "That's the job.", 'radio');
  stopClock(); await payout('First delivery: LOST', 0, 'a lost package costs the pay, never the game');
  hero.shown = false;
}
async function yearPasses() {
  await storyFrame('P0.6', 1.6);
  // a year of learning the job, played out by itself: up the fire escape (and nearly off it), across the roofs, through the traffic
  await runThrough('P0.7a', hero, [[.66, .97, 1.9], [.47, .76, 1.6, 1.1, 'slip'], [.22, .5, 1.15, 1.5], [.3, .5, 1.1, .35], [.47, .31, .7, 1.3], [.56, .2, .5, .9]]);
  await runThrough('P0.7b', hero, [[-.2, .8, 1.7], [.2, .8, 1.7, .8], [.78, .8, 1.7, .7, 2.6], [1.25, .8, 1.7, .8]]);
  await runThrough('P0.7c', hero, [[-.2, .96, 2.4], [.3, .96, 2.4, .9], [.62, .97, 2.4, .5, 'word:HOOONK!'], [.8, .97, 2.4, .45, 1.6], [1.3, .97, 2.4, .7]]);   // sized against the van
  await storyFrame('P0.7d', .7);
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
  // the Anchor: he takes Dot's call out on the pavement, then walks in through the yard gate
  if (QS.has('skip')) await storyFrame('R.4'); else await runThrough('R.4', hero, (manifest.panels['R.4'] || {}).walk || [[.42, .755, .85], [.7, .755, .85, 2.4], [.775, .72, .66, 1.2]], { hold: .5, fade: true, talk: () => storyFrame('R.4', .3) });
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
// The Halcyon, pulling away from the end of the pier. `ship.x` is the left edge of the picture; the stern deck Milo can land on is `ship.dx` along from it, `ship.dy` up.
let ship = null;
function waterCanvas(w, h) { const k = 48, c = document.createElement('canvas'); c.width = w * k; c.height = h * k; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, c.height);
  gr.addColorStop(0, '#22345a'); gr.addColorStop(1, '#0b1226'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height); let a = 7;
  const rnd = () => (a = (a * 16807) % 2147483647) / 2147483647; g.lineCap = 'round';
  for (let i = 0; i < 90; i++) { const x = rnd() * c.width, y = 4 + rnd() * (c.height - 6), l = 14 + rnd() * 40; g.strokeStyle = rnd() < .3 ? 'rgba(190,215,240,.75)' : 'rgba(13,10,18,.8)'; g.lineWidth = 1.5 + rnd() * 2;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 5, x + l, y); g.stroke(); }
  g.fillStyle = '#0d0a12'; g.fillRect(0, 0, c.width, 3); return c; }
async function lastJump() {
  const p = P['7.6']; enterPanel(p, .9);
  const edge = p.x0 + 20.6, img = await loadImage('./art/ship.png');
  { const w = p.x1 - edge + 1, m = put(new THREE.Mesh(new THREE.PlaneGeometry(w, .95), clipMat({ map: tex(waterCanvas(w, .95)) }, p.ref))); m.position.set(edge - .3 + w / 2, p.y0 + .47, ZACT); m.renderOrder = p.charOrder - .4; }   // open water past the end of the pier
  if (img) { const k = .0154, c = keyGreen(img), w = c.width * k, h = c.height * k, m = put(new THREE.Mesh(new THREE.PlaneGeometry(w, h), clipMat({ map: tex(c) }, p.ref))); m.renderOrder = p.charOrder - .3;
    ship = { m, p, w, h, x: edge - .2, v: 0, a: 0, dx: 180 * k, dy: (600 - 392) * k - 1.0, base: p.y0 + GROUND - 1.0 - (c.height - 600) * k, t: 0 }; shipTick(0); }
  spawn(hero, p, 2.2, { relaxed: true }); await wait(.5);
  if (ship) { burst('HOOOOONK!', ship.x + 6, p.y0 + GROUND + 4.4, .9, 2, 1.2); ship.v = .12; }   // she is already moving, slowly
  await say(hero, "You'll never make it!", 'speech'); await say(hero, 'Milo? What are\nyou doing?', 'radio'); await say(hero, 'Something stupid.');
  shout(hero, "Milo, don't...", 1.4, 'radio');
  const REACH = 7.4, target = () => ship ? ship.x + ship.dx : edge + 10.4, ty = ship ? ship.dy : 2.2; let made = false, wet = false;
  if (ship) { ship.v = .35; ship.a = .3; }   // and now she is pulling away for good: every second on the pier is a longer jump
  hero.free = false; hero.relaxed = false; control = true; hero.noRespawn = true; hint('RUN!  The Halcyon is pulling away  -  Space to jump at the very end of the pier');
  for (;;) { let got = false; hero.gone = false; hero.shown = true;
    await until(() => { if (pressed.jump && hero.grounded && hero.x > edge - 2.6) got = true; return got || hero.gone || hero.y < -2 || target() - edge > REACH + 3; });
    control = false; hint(''); const gap = target() - hero.x;
    if (got && gap <= REACH) { hero.free = true; const dur = .95 + gap * .03, lead = ship ? (ship.v + ship.a * dur / 2) * dur : 0; await hop(hero, p, target() + lead, { y: ty, h: 3.2, dur }); made = true; break; }
    if (got) { hero.free = true; await hop(hero, p, hero.x + REACH * .8, { y: -2.2, h: 2.6, dur: .9 }); hero.shown = false; }   // a real jump, but she is too far gone: he falls short
    if (got || hero.gone || hero.y < -2) { burst('SPLASH!', hero.x, p.y0 + GROUND - .3, 1, 2, 1.1); wet = true; await wait(1.1); }
    if (target() - edge > REACH - 1.2) break;   // by the time he is out of the water, or if he just stood there, she is out of reach
    spawn(hero, p, 12, { relaxed: true }); hero.inv = 1; hero.free = false; hero.relaxed = false; control = true; hero.noRespawn = true; hint('Again, quick!  Space at the very end of the pier');   // hauled out with the ship still in reach: one more go, and the clock has not stopped
  }
  if (made) { hero.set('jump'); hero.vx = hero.vy = 0; hero.float = true; hero.y = ty; hero.grounded = true; if (ship) { ship.rider = hero; ship.a = 0; ship.v = Math.min(ship.v, .9); }
    burst('GOT IT!', hero.x, hero.wy + 4.4, 1, 2, 1.2); await wait(1.2); hero.set('idle');
    await say(hero, "Danny's alive.", 'thought'); await say(hero, "This wasn't on\nthe route sheet.", 'thought'); return true; }
  // the other ending: the Halcyon sails without him
  if (ship) { ship.a = .9; } spawn(hero, p, 18.6, { relaxed: true, face: 1 }); hero.free = true; if (wet) hero.set('hurt');
  await wait(1.6); hero.set('idle'); burst('HOOOOONK!', p.x1 - 4, p.y0 + GROUND + 4.2, .8, 2, 1.3); await wait(1.0);
  await say(hero, 'DANNY!'); await say(hero, 'Milo? Milo,\ntalk to me.', 'radio'); await say(hero, "He's on that ship, Dot.\nAnd it's gone.");
  await say(hero, '...', 'radio'); await say(hero, 'Ships come back, kid.\nFind out where it docks.', 'radio');
  await say(hero, 'Next time\nI don\'t wait.', 'thought'); return false;
}
function shipTick(dt) { const S = ship; S.v += S.a * dt; S.x += S.v * dt; S.t += dt; const bob = Math.sin(S.t * 1.3) * .06;
  S.m.position.set(S.x + S.w / 2, S.base + S.h / 2 + bob, ZACT); if (S.rider) { S.rider.x = S.x + S.dx; S.rider.y = S.dy + bob; } }

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
  await until(dt => { if (control && (pot -= dt) < 0) { pot = 2.3; dropCrate(b, hero.x + 1.7, hero.y + 6, Math.random() < .5 ? 'pot' : 'box'); } return hero.x > b.x0 + 16.6 && hero.grounded && !hero.busy; });
  await endAction(); hero.shown = false; await wait(.4);
  // the pickup
  const w1 = clerk; enterPanel(c); spawn(w1, c, c.w - 4.2, { face: -1, relaxed: true }); const kase = setDown(c, 'case', ...((manifest.panels['2.4'] || {}).item || [11.6, 2.7, 1.3])); await heroEnters(c, 2.2);
  await say(w1, "You're the courier?"); await say(hero, "That's what the slip says."); await say(w1, 'Take it. Quickly.');
  hero.free = false; control = true; hint('Walk to the desk');
  await until(() => hero.x > w1.x - 2.7); control = false; hero.vx = 0; hero.set('idle'); hero.face = 1;
  hint('J or X: take the case'); pressed.punch = false; { let t = 0; await until(dt => pressed.punch || (AUTO && (t += dt) > .6)); } hint('');
  await takeUp(kase, 'CLICK');
  await say(w1, 'Only to her. Nobody else.\nGet it signed.'); await say(hero, "That's the job.");
  setClock(36, 480, 23, 24); radio("Thirty-six minutes, kid.\nClock's running.", 2.6); await wait(2.4);
  await walkTo(hero, c.x0 - 1.6, 3.6); hero.shown = false;
  await storyFrame('2.5');
  { const walk = vanWalk(); await storyFrame('2.6', 1.2); await walk; }
  { const p = P['2.7'], dark = picQuad(p, [.24, -.08, .78, 1.02], shadeCanvas());   // the window stays dark until the shots, flashes with each, and goes dark again
    p.sfx = async () => { for (let i = 0; i < 3; i++) { if (dark) dark.visible = false; shake = .5; burst('POP!', p.cx + (i - 1) * p.w * .27, p.y1 - 1.1 - (i % 2) * .5, clamp(p.w / 11, .55, 1.1), 2, .5); await wait(.13); if (dark) dark.visible = true; await wait(i < 2 ? .3 : .9); } };
    await storyFrame('2.7'); }
  await storyFrame('2.8');
}

async function page3() {
  await storyFrame('3.1'); await crossing(P['3.2']); await storyFrame('3.3');
  const b = P['3.4'], c = P['3.6']; enterPanel(b); await heroEnters(b, 1.6);
  startAction('The far lanes are jammed: go over the top');
  wait(1.2).then(() => shout(hero, 'Quicker than waiting\nfor the light.', 2, 'thought'));
  await until(() => hero.x > b.x1 - 2.8 && hero.y > 2 && hero.grounded && !hero.busy);
  await leapOff(b); await storyFrame('3.5');
  // the back alleys and the bag-snatcher
  enterPanel(c); await heroEnters(c, 2.2);
  startAction('Vault the fences  ▶');
  await until(() => hero.x > c.x0 + 9.5);
  spawn(w3, c, c.w + 1.4, { face: -1, hp: 3 }); shout(w3, "Nice bag.\nI'll take it.", 1.8); await walkTo(w3, c.x1 - 3.2, 3.2);   // he comes in from the street end of the alley
  arm(w3, { speed: 2.8, wait: .7 }); w3.snatch = true;
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
  await maze(P['5.1']);
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
  startAction('Space to jump up  •  stay out of the light  •  brace for the wind');
  wind = { p: a, t: 3, push: 0, dir: 1, alt: true, gap: [3.2, 4.6], dur: .6, force: 2.4 };
  await until(() => hero.y > 9.2 && hero.grounded && !hero.busy); await cutIn('6.2', a);
  await until(() => hero.y > 18.5 && hero.grounded && !hero.busy);
  wind = null; await endAction(); spot.mesh.visible = false; spot = null;
  // the boom
  enterPanel(bm); await hop(hero, bm, bm.x0 + 1.8, { y: .8, h: 2.2, dur: .95 }); hero.face = 1;
  startAction('Along the boom  •  the wind pushes you back');
  wait(.8).then(() => shout(hero, 'Danny, what did you\nget into?', 2.2, 'thought'));
  wind = { p: bm, t: 2.2, push: 0, dir: -1, alt: false, gap: [1.9, 2.9], dur: .9, force: 3.4 };
  await until(() => hero.x > bm.x0 + 18 && hero.grounded && !hero.busy);
  wind = null; await endAction(); hero.shown = false; await wait(.3);
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
  const made = await lastJump();
  enterPanel(P['7.7'], .5); await wait(1.8);
  await storyFrame('7.8', 1.2, made ? null : 'missed');
  focusPanel(null); frameId = 'end'; for (const q of panels) q.want = 1;
  const text = result(); wallet.cash += result.pay; $('cash').textContent = 'TONIGHT  $' + wallet.cash; $('cash').style.display = 'block';
  hint(`${made ? text : 'He missed the ship'}  •  Night's take $${wallet.cash}  •  End of ${LEVEL.series} #${LEVEL.issue}. To be continued...  Press R to read it again`.replace('End of', made ? 'End of' : 'The Halcyon sailed without him: there is another ending  •  End of'));
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
    if (!FLAT) for (const m of p.blocks) m.color.setScalar(.84 + .16 * p.focus);
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
  const ox = FLAT ? 0 : view.ox + Math.sin(time * .5) * .012, oy = FLAT ? 0 : -.09 + Math.cos(time * .4) * .008;
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
    if (o.c) { const c = o.c, p = c.panel; if (!p) continue; const rxW = o.b.rx * UNIT, ryW = o.b.ry * UNIT, headY = c.wy + 3.1;
      if (!o.off || o.offP !== p) { o.offP = p; let bc = 1e9;   // chosen once, then it rides along with the speaker
        const others = chars.filter(q => q.shown && !q.gone && q.panel === p), top = p.y1 + ryW * .55, inward = Math.sign(p.cx - c.x) || 1;
        for (const [dx, dy, base] of [[inward * rxW * .5, .95 + ryW, 0], [-inward * rxW * .5, .95 + ryW, 2], [0, 1.3 + ryW, 3], [inward * (rxW + 1.1), .5, 6], [-inward * (rxW + 1.1), .5, 8], [inward * (rxW + .9), 1.2 + ryW * .6, 5], [-inward * (rxW + .9), 1.2 + ryW * .6, 7], [inward * rxW * .5, 2.2 + ryW, 9]]) {
          const bx = c.x + dx, by = headY + dy; let cost = base;
          if (bx - rxW < p.x0 + .2) cost += 30 + (p.x0 + .2 - bx + rxW) * 20; if (bx + rxW > p.x1 - .2) cost += 30 + (bx + rxW - p.x1 + .2) * 20; if (by + ryW > top) cost += 30 + (by + ryW - top) * 30;
          for (const q of others) for (const hy of [q.wy + 3.0, q.wy + 1.6]) { const d = Math.hypot((bx - q.x) / (rxW + .55), (by - hy) / (ryW + .55)); if (d < 1) cost += (hy > q.wy + 2 ? 50 : 14) * (1.2 - d); }
          for (const q of balloons) if (q !== o && q.c && q.off && q.c.panel === p) { const d = Math.hypot((bx - q.c.x - q.off[0]) / (rxW + q.b.rx * UNIT), (by - q.c.wy - 3.1 - q.off[1]) / (ryW + q.b.ry * UNIT)); if (d < 1) cost += 60 * (1.2 - d); }
          if (cost < bc) { bc = cost; o.off = [dx, dy]; } } }
      const bx = clamp(c.x + o.off[0], p.x0 + rxW + .2, Math.max(p.x0 + rxW + .2, p.x1 - rxW - .2)), by = headY + o.off[1];
      const s = keep(scr(bx, by, ZACT), o.b.rx * sc, o.b.ry * sc), t = scr(c.x + c.face * .1 + Math.sign(bx - c.x) * .25, headY + .35, ZACT); o.b.set(s[0], s[1], sc, rot, t[0], t[1]); }
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
  tax1 = new Char('tax1'); tax2 = new Char('tax2'); cor1 = new Char('corner1'); cor2 = new Char('corner2'); brick = new Char('brick'); keeper = new Char('keeper'); clerk = new Char('clerk');
  chars = [hero, thug, goon, w1, w2, w3, gage, tax1, tax2, cor1, cor2, brick, keeper, clerk]; hero.hp = 5;
  const sheets = {};
  for (const c of chars) { const cfg = (manifest.sprites || {})[c.kind]; if (!cfg) continue;
    if (!sheets[c.kind]) { const s = sheets[c.kind] = {}; const img = await loadImage('./art/' + cfg.file);
      if (img) { try { s.sprites = sliceSprites(img, cfg); } catch (e) { console.error(e); } }
      for (const ex of (s.sprites && cfg.extra) || []) { const im3 = await loadImage('./art/' + ex.file); if (im3) { try { Object.assign(s.sprites, sliceSprites(im3, ex)); } catch (e) { console.error(e); } } }   // single extra poses (a jump)
      if (cfg.walk && s.sprites) { const im2 = await loadImage('./art/' + cfg.walk.file);
        if (im2) { try { Object.assign(s.sprites, sliceSprites(im2, cfg.walk)); s.cycle = cfg.walk.cycle; } catch (e) { console.error(e); } } } }
    if (sheets[c.kind].sprites) { c.pup.sprites = sheets[c.kind].sprites; if (sheets[c.kind].cycle) c.pup.cycle = sheets[c.kind].cycle; } }
  const want = QS.get('page'), key = LEVEL.pages.findIndex(q => q.key === want);   // ?page=P1, P2, R or the page number 1 to 7
  const start = key >= 0 ? key : want ? clamp(OPEN + (parseInt(want) || 1) - 1, 0, PAGES.length - 1) : 0;
  await buildPage(start);
  let last = performance.now();
  const loop = now => { frame((now - last) / 1000); last = now; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  function showLine(id, i, v) { const p = P[id]; swapStory(p, v); enterPanel(p, .8); for (const o of balloons.splice(0)) o.b.remove();   // for checking lettering: put up one line of a story frame
  const ls = (v && p.def.variants && p.def.variants[v] ? p.def.variants[v].lines : p.def.lines).map(parseLine).filter(l => l.t !== 'cap' && l.t !== 'sfx'), l = ls[i]; if (!l) return null;
  const k = clamp(p.w / 12, .62, 1), b = L.balloon(wrap(l.text), l.t); balloons.push({ b, k, ...placeStory(p, v, l, b.rx * UNIT * k, b.ry * UNIT * k, i) }); return l.who + ' ' + (i + 1) + '/' + ls.length; }
window.__game = { showLine, setDown, takeUp, gust, lastJump, runThrough, storyFrame, hero, chars, view, keys, pressed, focusPanel, spawn, enterPanel, swapStory, get P() { return P; }, get panels() { return panels; }, get foes() { return foes; },
    get xing() { return xing; }, get maze() { return mz; }, addFork, get fork() { return fork; }, mzStep, mzCell, clock,
    wallet, get at() { return { page: pageNo + 1, frame: frameId, control, hp: hero.hp, x: +(hero.x - (hero.panel ? hero.panel.x0 : 0)).toFixed(2), y: +hero.y.toFixed(2), state: hero.state }; } };
  await wait(1.2);
  run(start).catch(e => console.error(e));
}
boot().catch(e => { const d = $('err'); d.style.display = 'flex'; d.textContent = 'The game could not start:\n' + (e && e.stack || e); console.error(e); });
