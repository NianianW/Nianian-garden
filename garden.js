// garden.js — the window scene, plant portraits and care animations.
// Illustrated assets (assets/*.webp) were painted with Nano Banana 2.1 and keyed to transparent sprites;
// motion, timing and composition happen here on a 2D canvas. Works from file:// and offline.

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = t => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const now = () => performance.now() / 1000;

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- assets
const BASE = './assets/';
const cache = new Map();
export function loadImage(name) {
  if (cache.has(name)) return cache.get(name);
  const img = new Image();
  img.decoding = 'async';
  const entry = {img, ready: false, promise: null};
  entry.promise = new Promise(resolve => {
    img.onload = () => { entry.ready = true; resolve(entry); };
    img.onerror = () => resolve(entry);
  });
  img.src = `${BASE}${name}.webp`;
  cache.set(name, entry);
  return entry;
}
const ready = name => { const e = loadImage(name); return e.ready ? e.img : null; };

// Sprite facts measured when the assets were keyed (anchor = pot bottom centre, fraction of width).
const SPRITES = {
  fern: {ax: 0.486, scale: 1.0}, monstera: {ax: 0.499, scale: 1.12}, succulent: {ax: 0.5, scale: 0.6},
  snake: {ax: 0.509, scale: 1.04}, pothos: {ax: 0.5, scale: 0.86}, spider: {ax: 0.5, scale: 0.9},
  calathea: {ax: 0.485, scale: 0.95}, sprout: {ax: 0.503, scale: 0.42}
};
const STRIPS = {'cat-tail': {frames: 4, ax: 0.456}, 'cat-look': {frames: 4, ax: 0.4835}, butterfly: {frames: 4, ax: 0.5}};
const TOOLS = {water: 'tool-water', mist: 'tool-mist', fertilize: 'tool-fertilize', pest: 'tool-pest'};

const KINDS = [
  ['fern', /蕨|鹿角|staghorn|fern|platycerium/i],
  ['calathea', /竹芋|孔雀|calathea|maranta/i],
  ['monstera', /龟背|蔓绿绒|喜林芋|芋|monstera|philodendron|alocasia/i],
  ['succulent', /多肉|仙人|景天|石莲|玉露|芦荟|生石花|succulent|cact|echeveria|aloe/i],
  ['snake', /虎尾|虎皮兰|sansevieria|snake/i],
  ['spider', /吊兰|兰|spider|orchid|草/i],
  ['pothos', /绿萝|萝|常春藤|藤|pothos|ivy|vine/i]
];
const FALLBACK = ['pothos', 'calathea', 'monstera', 'spider', 'fern', 'snake'];

export function plantSpec(plant) {
  const seed = hashString(`${plant.id || ''}|${plant.name || ''}|${plant.species || ''}`);
  const r = rng(seed);
  const text = `${plant.species || ''} ${plant.name || ''}`;
  const kind = (KINDS.find(([, re]) => re.test(text)) || [])[0] || FALLBACK[Math.floor(r() * FALLBACK.length)];
  return {seed, kind, flip: r() > 0.5, size: lerp(0.9, 1.08, r()), hue: Math.round((r() - 0.5) * 22), phase: r() * TAU};
}
export function preloadPlant(plant) { return loadImage(`plant-${plantSpec(plant).kind}`).promise; }

// ---------------------------------------------------------------- drawing helpers
const filterSupported = (() => { try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(1px)'; return c.filter === 'blur(1px)'; } catch { return false; } })();

/** Draw a plant sprite. (x, y) = bottom centre of the pot, h = drawn height before the species scale. */
function drawPlantSprite(ctx, spec, x, y, h, st = {}) {
  const img = ready(`plant-${spec.kind}`); if (!img) return null;
  const meta = SPRITES[spec.kind];
  const H = h * meta.scale * spec.size * (st.scale ?? 1);
  const W = H * img.width / img.height;
  const sway = st.sway || 0;
  const droop = clamp(st.droop || 0);
  const reveal = st.reveal ?? 1;
  ctx.save();
  ctx.translate(x, y);
  // contact shadow
  ctx.fillStyle = `rgba(52,36,20,${0.22 * reveal})`;
  ctx.beginPath(); ctx.ellipse(W * 0.04, 0, W * 0.38, H * 0.035, 0, 0, TAU); ctx.fill();
  if (st.glow) {
    const g = ctx.createRadialGradient(0, -H * 0.55, 0, 0, -H * 0.55, H * 0.8);
    g.addColorStop(0, `rgba(255,236,170,${0.42 * st.glow})`); g.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = g; ctx.fillRect(-H, -H * 1.4, H * 2, H * 1.6);
  }
  // shear from the base: the pot stays put, the leaves move
  ctx.transform(1, 0, sway, 1 - droop * 0.05, 0, 0);
  if (spec.flip) ctx.scale(-1, 1);
  if (reveal < 1) { ctx.beginPath(); ctx.rect(-W, -H * reveal - 2, W * 2, H * reveal + 4); ctx.clip(); }
  if (filterSupported) {
    const f = [];
    if (spec.hue) f.push(`hue-rotate(${spec.hue}deg)`);
    if (droop) f.push(`saturate(${1 - droop * 0.45})`, `sepia(${droop * 0.25})`);
    if (st.dim) f.push(`brightness(${1 - st.dim})`);
    if (st.tone) f.push(st.tone);
    ctx.filter = f.join(' ') || 'none';
  }
  ctx.globalAlpha = clamp(0.2 + reveal);
  ctx.drawImage(img, -W * meta.ax, -H, W, H);
  ctx.restore();
  return {W, H};
}

function drawStripFrame(ctx, name, frame, x, y, h, alpha = 1, tone = '') {
  const img = ready(name); if (!img || alpha <= 0) return;
  const s = STRIPS[name]; const cw = img.width / s.frames;
  const W = h * cw / img.height;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (tone) ctx.filter = tone;
  ctx.drawImage(img, cw * frame, 0, cw, img.height, -W * s.ax, -h, W, h);
  ctx.restore();
}

function glint(ctx, x, y, s, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
  ctx.fillStyle = 'rgba(235,248,255,.95)';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { const ang = i * Math.PI / 2; ctx.lineTo(Math.cos(ang) * s, Math.sin(ang) * s); ctx.lineTo(Math.cos(ang + Math.PI / 4) * s * 0.22, Math.sin(ang + Math.PI / 4) * s * 0.22); }
  ctx.fill(); ctx.restore();
}

// ---------------------------------------------------------------- care animation (tool + particles)
/** A care action animation: the tool flies in above the plant, tilts and pours, then leaves. */
class CareAction {
  constructor(kind, x, base, h) { this.kind = kind; this.x = x; this.base = base; this.h = h; this.t0 = now(); this.parts = []; this.done = false; this.emitted = 0; }
  get dur() { return 2.6; }
  draw(ctx, t) {
    const k = (t - this.t0) / this.dur; if (k >= 1 && !this.parts.length) { this.done = true; return; }
    const img = ready(TOOLS[this.kind]);
    const h = this.h;
    const inK = easeOut(k / 0.22), outK = easeInOut((k - 0.8) / 0.2);
    const tilt = this.kind === 'water' ? -0.62 * easeInOut((k - 0.18) / 0.2) * (1 - outK) : this.kind === 'fertilize' ? -0.9 * easeInOut((k - 0.18) / 0.2) * (1 - outK) : 0;
    const toolH = h * (this.kind === 'water' ? 0.34 : this.kind === 'pest' ? 0.3 : 0.32);
    const tx = this.x + h * (this.kind === 'water' ? 0.42 : this.kind === 'pest' ? 0.05 : 0.36) + (1 - inK) * h * 0.4 + outK * h * 0.5;
    const ty = this.base - h * (this.kind === 'pest' ? 1.2 : 1.02) - (1 - inK) * h * 0.25 - outK * h * 0.2;
    const pouring = k > 0.32 && k < 0.8;
    const W = img ? toolH * img.width / img.height : toolH;
    const rot = tilt + (this.kind === 'mist' ? -0.12 * Math.sin(Math.PI * clamp((k - 0.3) / 0.5)) : 0);
    const flip = this.kind === 'water' ? -1 : 1; // the can's spout is drawn pointing right; turn it toward the plant
    if (img && k < 1) {
      ctx.save(); ctx.globalAlpha = clamp(inK) * (1 - outK); ctx.translate(tx, ty); ctx.rotate(rot); ctx.scale(flip, 1);
      ctx.drawImage(img, -W / 2, -toolH / 2, W, toolH);
      ctx.restore();
    }
    // working end of each tool, in the tool's local space (before rotation)
    const tip = {water: [-W * 0.5, -toolH * 0.36], mist: [-W * 0.42, -toolH * 0.36], fertilize: [-W * 0.42, toolH * 0.3], pest: [0, toolH * 0.5]}[this.kind];
    const ex = tx + tip[0] * Math.cos(rot) - tip[1] * Math.sin(rot), ey = ty + tip[0] * Math.sin(rot) + tip[1] * Math.cos(rot);
    // emit particles from the tool's working end
    if (pouring) {
      const rate = {water: 60, mist: 40, fertilize: 34, pest: 8}[this.kind];
      const want = Math.floor((k - 0.32) * this.dur * rate);
      while (this.emitted < want) {
        this.emitted++;
        const r = Math.random;
        if (this.kind === 'water') this.parts.push({t, x: ex + r() * 3, y: ey, vx: -h * (0.12 + r() * 0.08), vy: h * 0.1, s: h * (0.008 + r() * 0.007)});
        if (this.kind === 'mist') { const a = Math.PI * (0.8 + r() * 0.4); this.parts.push({t, x: ex, y: ey, vx: Math.cos(a) * h * (0.3 + r() * 0.4), vy: Math.sin(a) * h * 0.25 + h * 0.08, s: h * (0.02 + r() * 0.04)}); }
        if (this.kind === 'fertilize') this.parts.push({t, x: ex + r() * 6, y: ey, vx: -h * r() * 0.08, vy: h * 0.05, s: h * (0.006 + r() * 0.006), spin: r() * TAU});
        if (this.kind === 'pest') this.parts.push({t, x: ex, y: ey, vx: 0, vy: h * 0.25, s: h * 0.012});
      }
    }
    const floor = this.base - h * 0.16;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; const age = t - p.t;
      if (this.kind === 'water' || this.kind === 'pest' || this.kind === 'fertilize') {
        const g = h * 2.2;
        const px = p.x + p.vx * age, py = p.y + p.vy * age + 0.5 * g * age * age;
        if (py >= floor || p.hit) {
          p.hit = p.hit || t; const rk = (t - p.hit) / 0.5;
          if (rk > 1) { this.parts.splice(i, 1); continue; }
          if (this.kind === 'fertilize') { ctx.fillStyle = `rgba(240,205,120,${1 - rk})`; ctx.beginPath(); ctx.arc(px, floor, p.s, 0, TAU); ctx.fill(); continue; }
          ctx.strokeStyle = this.kind === 'pest' ? `rgba(170,215,160,${(1 - rk) * 0.9})` : `rgba(150,205,235,${(1 - rk) * 0.9})`;
          ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(px, floor, p.s * (1 + rk * 5), p.s * (0.3 + rk * 1.2), 0, 0, TAU); ctx.stroke();
          continue;
        }
        if (this.kind === 'fertilize') { ctx.save(); ctx.translate(px, py); ctx.rotate(p.spin + age * 6); ctx.fillStyle = 'rgba(236,198,112,.95)'; ctx.fillRect(-p.s, -p.s, p.s * 2, p.s * 2); ctx.restore(); continue; }
        ctx.fillStyle = this.kind === 'pest' ? 'rgba(150,110,40,.85)' : 'rgba(140,200,235,.9)';
        ctx.beginPath(); ctx.moveTo(px, py - p.s * 2.4); ctx.quadraticCurveTo(px + p.s, py, px, py + p.s); ctx.quadraticCurveTo(px - p.s, py, px, py - p.s * 2.4); ctx.fill();
      } else {
        const life = 1.4; if (age > life) { this.parts.splice(i, 1); continue; }
        const q = age / life, px = p.x + p.vx * q, py = p.y + p.vy * q, r = p.s * (1 + q * 2);
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `rgba(235,245,252,${0.6 * Math.sin(Math.PI * q)})`); g.addColorStop(1, 'rgba(235,245,252,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
      }
    }
    if (this.kind === 'pest' && k > 0.5 && k < 1.1) {
      const q = clamp((k - 0.5) / 0.6);
      ctx.strokeStyle = `rgba(160,215,170,${(1 - q) * 0.8})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(this.x, this.base - h * 0.45, h * (0.3 + q * 0.35), h * (0.45 + q * 0.4), 0, 0, TAU); ctx.stroke();
    }
    if (this.kind === 'fertilize' && k > 0.6 && k < 1.2) {
      const q = clamp((k - 0.6) / 0.6);
      for (let i = 0; i < 6; i++) glint(ctx, this.x + Math.cos(i * 1.7) * h * 0.25, this.base - h * (0.35 + 0.5 * ((i * 0.37) % 1)) - q * h * 0.15, h * 0.03, Math.sin(Math.PI * q));
    }
  }
}

// ---------------------------------------------------------------- portrait (cards, journal)
export class PlantPortrait {
  constructor(canvas, plant, state = {}) {
    this.canvas = canvas; this.plant = plant; this.spec = plantSpec(plant); this.state = state;
    this.actions = []; this.raf = 0; this.t0 = now(); this.perkAt = -10;
    this.growFrom = state.animateGrow && !reducedMotion() ? now() : -10;
    this.resize();
    loadImage(`plant-${this.spec.kind}`).promise.then(() => this.kick());
    Object.values(TOOLS).forEach(loadImage);
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    this.ctx = this.canvas.getContext('2d');
  }
  play(kind) {
    if (kind === 'water') this.state.wet = true;
    this.perkAt = now();
    if (!reducedMotion()) this.actions.push(new CareAction(kind, this.w / 2, this.h * 0.92, this.h * 0.8));
    this.kick();
  }
  render(t) {
    const {ctx, w, h} = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const reveal = easeOut((t - this.growFrom) / 1.2);
    const perk = clamp(1 - (t - this.perkAt) / 1.6);
    const sway = this.actions.length ? Math.sin((t - this.perkAt) * 7) * 0.04 * perk : 0;
    const box = drawPlantSprite(ctx, this.spec, w / 2, h * 0.92, h * 0.78, {droop: this.state.droop && !perk ? 0.6 : 0, reveal, sway, scale: 1 + Math.sin(Math.PI * perk) * 0.03, glow: perk * 0.7});
    if (box && this.state.wet) for (let i = 0; i < 4; i++) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.4 + i * 1.7 + this.spec.phase));
      glint(ctx, w / 2 + Math.cos(i * 2.3 + this.spec.phase) * box.W * 0.28, h * 0.92 - box.H * (0.45 + 0.4 * ((i * 0.31) % 1)), Math.max(3, box.H * 0.035), a);
    }
    this.actions.forEach(a => a.draw(ctx, t));
    this.actions = this.actions.filter(a => !a.done);
  }
  kick() {
    if (this.raf) return;
    const tick = () => {
      this.raf = 0; const t = now(); this.render(t);
      const busy = this.actions.length || t - this.growFrom < 1.3 || t - this.perkAt < 1.7 || (this.state.wet && !reducedMotion() && this.hovering);
      if (busy && this.canvas.isConnected) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  hover(on) { this.hovering = on; if (on) this.kick(); }
  destroy() { cancelAnimationFrame(this.raf); this.raf = 0; }
}

// ---------------------------------------------------------------- time of day
// Each painted backdrop owns a stretch of the day; neighbours cross-fade.
const KEYS = [[4.6, 'night'], [6.2, 'dawn'], [8.4, 'dawn'], [10, 'day'], [16, 'day'], [17.8, 'dusk'], [18.7, 'dusk'], [19.8, 'night']];
export function currentHour() {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('hour') : null;
  if (q != null && q !== '' && !Number.isNaN(Number(q))) return clamp(Number(q), 0, 23.99);
  const d = new Date(); return d.getHours() + d.getMinutes() / 60;
}
export function skyBlend(hour) {
  if (hour < KEYS[0][0] || hour >= KEYS.at(-1)[0]) return [['night', 1]];
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [h0, a] = KEYS[i], [h1, b] = KEYS[i + 1];
    if (hour >= h0 && hour < h1) { const k = easeInOut((hour - h0) / (h1 - h0)); return a === b ? [[a, 1]] : [[a, 1 - k], [b, k]]; }
  }
  return [['day', 1]];
}
export function phaseOf(hour) { const b = skyBlend(hour); return b.reduce((m, x) => (x[1] > m[1] ? x : m))[0]; }
/** CSS filter that makes sprites sit in each painted light. */
export function toneAt(hour) {
  const T = {day: [1, 1, 0], dawn: [0.9, 0.92, 0.08], dusk: [0.93, 1.02, 0.22], night: [0.62, 0.8, 0.18]};
  let b = 0, s = 0, w = 0;
  for (const [name, a] of skyBlend(hour)) { b += T[name][0] * a; s += T[name][1] * a; w += T[name][2] * a; }
  return `brightness(${b.toFixed(3)}) saturate(${s.toFixed(3)}) sepia(${w.toFixed(3)})`;
}
export function greeting(hour) {
  if (hour < 5) return '夜深了'; if (hour < 11) return '早上好'; if (hour < 13) return '中午好'; if (hour < 18) return '下午好'; return '晚上好';
}

// ---------------------------------------------------------------- the window scene
// Geometry of the painted backdrops, as fractions of the image.
const LAYOUT = {
  wide: {sillBack: 0.828, sillFront: 0.872, x0: 0.43, x1: 0.93, catX: 0.3, glass: [0.47, 0.0, 1.0, 0.74], plantH: 0.3},
  tall: {sillBack: 0.873, sillFront: 0.905, x0: 0.07, x1: 0.73, catX: 0.84, glass: [0.08, 0.34, 0.97, 0.85], plantH: 0.16}
};

export class GardenScene {
  constructor(canvas, {onPlantClick, onHover, onCat} = {}) {
    this.canvas = canvas; this.onPlantClick = onPlantClick; this.onHover = onHover; this.onCat = onCat;
    this.plants = []; this.actions = []; this.hit = []; this.hover = null;
    this.pointer = {x: -1, y: -1, vx: 0}; this.wind = 0; this.catLook = 0; this.catHappyUntil = 0;
    this.start = now(); this.visible = true; this.raf = 0;
    const r = rng(1017);
    this.flies = Array.from({length: 16}, () => [r(), r(), r() * TAU, r() * 0.6 + 0.5]);
    this.butterflies = Array.from({length: 2}, (_, i) => ({ph: r() * TAU, sp: 0.18 + r() * 0.1, cx: 0.3 + i * 0.4, cy: 0.35 + r() * 0.3}));
    ['cat-tail', 'cat-look', 'cat-sleep', 'butterfly', 'plant-sprout', ...Object.values(TOOLS)].forEach(loadImage);
    this.resize();
    this.ro = new ResizeObserver(() => { this.resize(); this.draw(); });
    this.ro.observe(canvas);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.loop(); });
    this.io.observe(canvas);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.loop(); });
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerleave', () => { this.pointer.x = -1; this.setHover(null); });
    canvas.addEventListener('click', e => {
      this.move(e);
      if (this.hover?.cat) { this.catHappyUntil = now() + 2.2; this.onCat?.(); this.loop(); return; }
      if (this.hover && this.onPlantClick) this.onPlantClick(this.hover.id);
    });
    this.loop();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    this.ctx = this.canvas.getContext('2d');
    this.form = this.w / this.h < 0.95 ? 'tall' : 'wide';
  }
  setPlants(list) {
    const known = new Map(this.plants.map(p => [p.id, p]));
    this.plants = list.slice(0, 10).map((p, i) => ({...known.get(p.id), ...p, spec: plantSpec(p.plant), born: known.get(p.id)?.born ?? (now() + 0.5 + i * 0.16)}));
    if (reducedMotion()) this.plants.forEach(p => { p.born = -10; });
    this.plants.forEach(p => loadImage(`plant-${p.spec.kind}`).promise.then(() => this.loop()));
    this.loop();
  }
  move(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (this.pointer.x >= 0) this.pointer.vx = x - this.pointer.x;
    this.pointer.x = x; this.pointer.y = y;
    const hits = this.hit.filter(h => x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1);
    const hit = hits.find(h => h.cat) || hits.find(h => !h.back && y > h.y0 + (h.y1 - h.y0) * 0.3) || hits.sort((a, b) => Math.abs(a.cx - x) - Math.abs(b.cx - x))[0] || null;
    this.setHover(hit);
    this.loop();
  }
  setHover(hit) {
    const same = (hit?.id || hit?.cat || null) === (this.hover?.id || this.hover?.cat || null);
    this.hover = hit;
    if (same) return;
    this.canvas.style.cursor = hit ? 'pointer' : 'default';
    this.onHover?.(hit);
  }
  play(id, kind) {
    const h = this.hit.find(x => x.id === id);
    const p = this.plants.find(x => x.id === id);
    if (p) { if (kind === 'water') p.wet = true; p.droop = false; p.perkAt = now(); }
    if (h && !reducedMotion()) this.actions.push(new CareAction(kind, h.cx, h.base, h.ph));
    this.loop();
  }
  // where the backdrop sits on the canvas (object-fit: cover, anchored low and right)
  frame() {
    const img = ready(`bg-day-${this.form}`) || ready(`bg-${this.phase || 'day'}-${this.form}`);
    const iw = img?.width || (this.form === 'wide' ? 1920 : 1080), ih = img?.height || (this.form === 'wide' ? 1072 : 1920);
    if (this.form === 'tall') {
      const top = clamp(this.h * 0.14, 60, 150);
      const s = Math.max(this.w / iw, (this.h - top) / ih);
      return {s, x: (this.w - iw * s) * 0.5, y: this.h - ih * s, iw, ih, pad: true};
    }
    const s = Math.max(this.w / iw, this.h / ih);
    return {s, x: (this.w - iw * s) * 0.62, y: (this.h - ih * s) * 0.78, iw, ih};
  }
  drawBackdrop(t) {
    const {ctx} = this;
    const hour = currentHour();
    const blend = skyBlend(hour);
    this.phase = phaseOf(hour);
    const F = this.frame();
    let drew = false;
    for (const [name, a] of blend) {
      const img = ready(`bg-${name}-${this.form}`);
      if (!img) { loadImage(`bg-${name}-${this.form}`).promise.then(() => this.loop()); continue; }
      ctx.globalAlpha = drew ? a : 1;
      if (F.pad && F.y > 0) ctx.drawImage(img, 0, 0, img.width, img.height * 0.03, F.x, 0, F.iw * F.s, F.y + 2); // stretch the plaster upward
      ctx.drawImage(img, F.x, F.y, F.iw * F.s, F.ih * F.s); drew = true;
    }
    ctx.globalAlpha = 1;
    if (!drew) { ctx.fillStyle = '#dfe6dd'; ctx.fillRect(0, 0, this.w, this.h); }
    return F;
  }
  drawLife(t, F) {
    const {ctx} = this; const L = LAYOUT[this.form];
    const gx0 = F.x + L.glass[0] * F.iw * F.s, gy0 = F.y + L.glass[1] * F.ih * F.s, gx1 = F.x + L.glass[2] * F.iw * F.s, gy1 = F.y + L.glass[3] * F.ih * F.s;
    ctx.save(); ctx.beginPath(); ctx.rect(gx0, gy0, gx1 - gx0, gy1 - gy0); ctx.clip();
    if (this.phase === 'day' || this.phase === 'dawn') {
      const bh = clamp((gy1 - gy0) * 0.09, 14, 40);
      this.butterflies.forEach((b, i) => {
        const u = t * b.sp + b.ph;
        const x = gx0 + (gx1 - gx0) * (0.5 + 0.42 * Math.sin(u) * Math.cos(u * 0.37 + i));
        const y = gy0 + (gy1 - gy0) * (b.cy + 0.18 * Math.sin(u * 1.9) + 0.05 * Math.sin(t * 6 + i));
        const frame = Math.floor(t * 11 + i * 2) % 4;
        const dx = Math.cos(u) * Math.cos(u * 0.37 + i);
        ctx.save(); ctx.translate(x, y); ctx.rotate(dx > 0 ? 0.35 : -0.35);
        drawStripFrame(ctx, 'butterfly', frame, 0, bh / 2, bh, 0.95);
        ctx.restore();
      });
    }
    if (this.phase === 'night' || this.phase === 'dusk') {
      ctx.globalCompositeOperation = 'lighter';
      for (const [x, y, ph, s] of this.flies) {
        const fx = gx0 + (gx1 - gx0) * ((x + Math.sin(t * 0.12 * s + ph) * 0.06 + 1) % 1);
        const fy = gy0 + (gy1 - gy0) * (0.55 + y * 0.42) + Math.cos(t * 0.5 * s + ph) * 10;
        const a = Math.max(0, Math.sin(t * 1.2 * s + ph)) * (this.phase === 'night' ? 0.85 : 0.45);
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 9);
        g.addColorStop(0, `rgba(235,255,170,${a})`); g.addColorStop(1, 'rgba(235,255,170,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 9, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  slots(F) {
    const L = LAYOUT[this.form];
    const n = Math.max(1, this.plants.length);
    const two = n > 4;
    const x0 = F.x + L.x0 * F.iw * F.s, x1 = Math.min(this.w - 8, F.x + L.x1 * F.iw * F.s);
    const step = (x1 - x0) / n;
    let ph = L.plantH * F.ih * F.s;
    ph = Math.min(ph, step * (two ? 2.1 : 1.6));
    return this.plants.map((p, i) => {
      const back = two && i % 2 === 1;
      return {p, i, back, cx: x0 + step * (i + 0.5), base: F.y + (back ? L.sillBack : L.sillFront) * F.ih * F.s, ph: ph * (back ? 0.88 : 1)};
    });
  }
  drawPlants(t, F) {
    const {ctx} = this;
    const gust = this.pointer.x >= 0 ? clamp(this.pointer.vx / 30, -1, 1) : 0;
    this.wind = lerp(this.wind, gust, 0.06); this.pointer.vx *= 0.88;
    const L = LAYOUT[this.form];
    if (!this.plants.length) {
      const spec = {kind: 'sprout', flip: false, size: 1, hue: 0, phase: 0};
      const cx = F.x + (L.x0 + L.x1) / 2 * F.iw * F.s;
      drawPlantSprite(ctx, spec, cx, F.y + L.sillFront * F.ih * F.s, L.plantH * F.ih * F.s, {tone: this.tone, reveal: easeOut((t - this.start - 0.4) / 1.4)});
      return;
    }
    const slots = this.slots(F).sort((a, b) => (b.back - a.back));
    for (const s of slots) {
      const {p} = s;
      const near = this.pointer.x >= 0 ? clamp(1 - Math.abs(this.pointer.x - s.cx) / (s.ph * 0.9)) : 0;
      const perk = clamp(1 - (t - (p.perkAt ?? -10)) / 1.8);
      const idle = reducedMotion() ? 0 : Math.sin(t * 0.9 + p.spec.phase) * 0.018;
      const sway = idle + this.wind * near * 0.18 + Math.sin((t - (p.perkAt ?? 0)) * 8) * 0.05 * perk;
      const isHover = this.hover?.id === p.id;
      const box = drawPlantSprite(ctx, p.spec, s.cx, s.base, s.ph, {tone: this.tone,
        reveal: easeOut((t - p.born) / 1.3), sway, droop: p.droop ? 0.75 : 0,
        glow: Math.max(isHover ? 0.9 : 0, perk), dim: s.back ? 0.06 : 0, scale: 1 + Math.sin(Math.PI * perk) * 0.04
      });
      if (box && p.wet) for (let i = 0; i < 5; i++) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + i * 1.9 + p.spec.phase));
        glint(ctx, s.cx + Math.cos(i * 2.1 + p.spec.phase) * box.W * 0.3, s.base - box.H * (0.4 + 0.45 * ((i * 0.29 + p.spec.phase) % 1)), Math.max(3, box.H * 0.03), a);
      }
      if (box) this.hit.push({id: p.id, name: p.plant.name, back: s.back, cx: s.cx, base: s.base, ph: s.ph, x0: s.cx - box.W * 0.45, x1: s.cx + box.W * 0.45, y0: s.base - box.H, y1: s.base + 4});
    }
  }
  drawCat(t, F) {
    const {ctx} = this; const L = LAYOUT[this.form];
    const x = F.x + L.catX * F.iw * F.s, y = F.y + L.sillFront * F.ih * F.s;
    const h = clamp(L.plantH * F.ih * F.s * 0.62, 34, 150);
    const reduce = reducedMotion();
    if (this.phase === 'night') {
      const img = ready('cat-sleep'); if (!img) return;
      const H = h * 0.62, W = H * img.width / img.height;
      const breathe = reduce ? 1 : 1 + Math.sin(t * 1.4) * 0.018;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(30,20,10,.28)'; ctx.beginPath(); ctx.ellipse(0, 0, W * 0.48, H * 0.08, 0, 0, TAU); ctx.fill();
      ctx.scale(1, breathe); if (this.tone) ctx.filter = this.tone; ctx.drawImage(img, -W / 2, -H, W, H); ctx.restore();
      if (!reduce) for (let i = 0; i < 3; i++) {
        const k = ((t * 0.35 + i / 3) % 1);
        ctx.save(); ctx.globalAlpha = Math.sin(Math.PI * k) * 0.8;
        ctx.fillStyle = '#f3ead6'; ctx.font = `${Math.round(h * (0.16 + k * 0.12))}px "LXGW WenKai Screen", "Kaiti SC", serif`;
        ctx.fillText('z', x + W * 0.25 + k * h * 0.35, y - H * 0.9 - k * h * 0.6); ctx.restore();
      }
      this.hit.push({cat: 'sleep', x0: x - W / 2, x1: x + W / 2, y0: y - H, y1: y});
      return;
    }
    ctx.fillStyle = 'rgba(30,20,10,.25)'; ctx.beginPath(); ctx.ellipse(x, y, h * 0.32, h * 0.05, 0, 0, TAU); ctx.fill();
    const wantLook = this.hover?.cat || t < this.catHappyUntil ? 1 : 0;
    this.catLook = lerp(this.catLook, wantLook, 0.09);
    if (this.catLook > 0.02) {
      // turning toward the viewer: blend through the look frames
      const happy = t < this.catHappyUntil;
      const f = this.catLook > 0.85 ? (happy ? 3 : 2) : this.catLook > 0.35 ? 1 : 0;
      drawStripFrame(ctx, 'cat-look', f, x, y, h, 1, this.tone);
      if (happy && !reduce) {
        const q = clamp((this.catHappyUntil - t) / 2.2);
        ctx.save(); ctx.globalAlpha = Math.sin(Math.PI * q); ctx.fillStyle = '#e48a8a';
        const hx = x + h * 0.22, hy = y - h * 1.05 - (1 - q) * h * 0.3, s = h * 0.07;
        ctx.beginPath(); ctx.moveTo(hx, hy + s); ctx.bezierCurveTo(hx - s * 1.6, hy - s * 0.4, hx - s * 0.5, hy - s * 1.4, hx, hy - s * 0.5); ctx.bezierCurveTo(hx + s * 0.5, hy - s * 1.4, hx + s * 1.6, hy - s * 0.4, hx, hy + s); ctx.fill();
        ctx.restore();
      }
    } else {
      // idle: the tail swishes through frames 0 → 1 → 2 → 1 → 0 → 3 → 0
      const seq = [0, 1, 2, 1, 0, 0, 3, 0];
      const speed = reduce ? 0 : 0.85;
      const i = Math.floor((t * speed) % seq.length);
      drawStripFrame(ctx, 'cat-tail', seq[i], x, y, h, 1, this.tone);
    }
    this.hit.push({cat: 'awake', x0: x - h * 0.3, x1: x + h * 0.3, y0: y - h, y1: y});
  }
  draw() {
    const t = now(); const {ctx, dpr} = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.hit = [];
    const F = this.drawBackdrop(t);
    this.tone = filterSupported ? toneAt(currentHour()) : '';
    this.drawLife(t, F);
    this.drawCat(t, F);
    this.drawPlants(t, F);
    this.actions.forEach(a => a.draw(ctx, t));
    this.actions = this.actions.filter(a => !a.done);
    this.canvas.dataset.phase = this.phase;
    this.anchors = this.slots(F);
  }
  loop() {
    if (this.raf) return;
    const tick = () => {
      this.raf = 0;
      if (!this.visible || document.hidden) return;
      this.draw();
      const busy = this.actions.length || now() - this.start < 4 || this.plants.some(p => now() - p.born < 1.4);
      if (!reducedMotion() || busy) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  /** Canvas-space position of a plant's top, for DOM labels. */
  anchorOf(id) { const h = this.hit.find(x => x.id === id); return h ? {x: h.cx, y: h.y0} : null; }
}
