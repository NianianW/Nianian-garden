// garden.js — the castle conservatory plate, plant portraits and care animations.
// The plates and sprites in assets/ were drawn once with Nano Banana 2.1 during development and
// shipped as static images; the app itself never calls an image API. A plant can carry its own
// uploaded illustration (plant.portraitDataUrl), which replaces the default sprite everywhere.

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

// ---------------------------------------------------------------- images
const cache = new Map();
function loadSrc(key, src) {
  if (cache.has(key)) return cache.get(key);
  const img = new Image(); img.decoding = 'async';
  const entry = {img, ready: false, promise: null};
  entry.promise = new Promise(resolve => { img.onload = () => { entry.ready = true; resolve(entry); }; img.onerror = () => resolve(entry); });
  img.src = src; cache.set(key, entry); return entry;
}
export const loadImage = name => loadSrc(name, `./assets/${name}.webp`);
const ready = name => { const e = loadImage(name); return e.ready ? e.img : null; };

// ---------------------------------------------------------------- plants
// anchor = pot centre as a fraction of the sprite width (measured when the sprites were keyed)
const SPRITES = {
  fern: {ax: 0.37, scale: 1.0}, monstera: {ax: 0.41, scale: 1.08}, succulent: {ax: 0.5, scale: 0.68},
  snake: {ax: 0.5, scale: 1.05}, pothos: {ax: 0.47, scale: 0.92}, spider: {ax: 0.48, scale: 0.95},
  calathea: {ax: 0.49, scale: 0.95}, sprout: {ax: 0.5, scale: 0.5}
};
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
export const ZONES = {auto: '自动安排', sill: '窗台', hanging: '吊挂区', shelf: '植物架'};

export function plantSpec(plant) {
  const seed = hashString(`${plant.id || ''}|${plant.name || ''}|${plant.species || ''}`);
  const r = rng(seed);
  const text = `${plant.species || ''} ${plant.name || ''}`;
  const kind = (KINDS.find(([, re]) => re.test(text)) || [])[0] || FALLBACK[Math.floor(r() * FALLBACK.length)];
  const portrait = plant.portraitDataUrl || null;
  return {seed, kind, portrait, flip: !portrait && r() > 0.5, size: lerp(0.92, 1.06, r()), hue: portrait ? 0 : Math.round((r() - 0.5) * 18), phase: r() * TAU};
}
/** The image that represents a plant: its uploaded portrait, or the default sprite for its kind. */
function plantImage(spec) {
  if (spec.portrait) { const e = loadSrc(`portrait:${spec.seed}:${spec.portrait.length}`, spec.portrait); return e.ready ? {img: e.img, ax: 0.5, scale: 1} : null; }
  const img = ready(`plant-${spec.kind}`); return img ? {img, ...SPRITES[spec.kind]} : null;
}
function plantPromise(spec) {
  return spec.portrait ? loadSrc(`portrait:${spec.seed}:${spec.portrait.length}`, spec.portrait).promise : loadImage(`plant-${spec.kind}`).promise;
}
/** Width / height of a plant as drawn (for packing). */
function plantAspect(spec) {
  const im = plantImage(spec); if (!im) return 0.85;
  return im.img.width / im.img.height;
}

const filterSupported = (() => { try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(1px)'; return c.filter === 'blur(1px)'; } catch { return false; } })();

/** Draw a plant with its pot bottom centred at (x, y), h tall. Returns the drawn box. */
function drawPlant(ctx, spec, x, y, h, st = {}) {
  const im = plantImage(spec); if (!im) return null;
  const H = h * (st.scale ?? 1);
  const W = H * im.img.width / im.img.height;
  const reveal = st.reveal ?? 1;
  ctx.save();
  ctx.translate(x, y);
  if (!st.noShadow) { ctx.fillStyle = `rgba(40,26,14,${0.24 * reveal})`; ctx.beginPath(); ctx.ellipse(W * 0.03, 0, W * 0.34, H * 0.03, 0, 0, TAU); ctx.fill(); }
  if (st.glow) {
    const g = ctx.createRadialGradient(0, -H * 0.55, 0, 0, -H * 0.55, H * 0.8);
    g.addColorStop(0, `rgba(255,226,150,${0.45 * st.glow})`); g.addColorStop(1, 'rgba(255,226,150,0)');
    ctx.fillStyle = g; ctx.fillRect(-H, -H * 1.4, H * 2, H * 1.6);
  }
  ctx.transform(1, 0, st.sway || 0, 1 - (st.droop || 0) * 0.04, 0, 0);
  if (spec.flip) ctx.scale(-1, 1);
  if (reveal < 1) { ctx.beginPath(); ctx.rect(-W * 1.2, -H * reveal - 2, W * 2.4, H * reveal + 4); ctx.clip(); }
  if (filterSupported) {
    const f = [];
    if (spec.hue) f.push(`hue-rotate(${spec.hue}deg)`);
    if (st.droop) f.push(`saturate(${1 - st.droop * 0.45})`, `sepia(${st.droop * 0.3})`);
    if (st.tone) f.push(st.tone);
    ctx.filter = f.join(' ') || 'none';
  }
  ctx.globalAlpha = clamp(0.2 + reveal);
  ctx.drawImage(im.img, -W * im.ax, -H, W, H);
  ctx.restore();
  return {W, H, ax: im.ax};
}

function glint(ctx, x, y, s, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.fillStyle = 'rgba(240,250,255,.95)';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { const g = i * Math.PI / 2; ctx.lineTo(Math.cos(g) * s, Math.sin(g) * s); ctx.lineTo(Math.cos(g + Math.PI / 4) * s * 0.22, Math.sin(g + Math.PI / 4) * s * 0.22); }
  ctx.fill(); ctx.restore();
}

// ---------------------------------------------------------------- care animation
const TOOLS = {water: 'tool-water', mist: 'tool-mist', fertilize: 'tool-fertilize', pest: 'tool-pest'};
class CareAction {
  constructor(kind, x, base, h) { this.kind = kind; this.x = x; this.base = base; this.h = h; this.t0 = now(); this.parts = []; this.done = false; this.emitted = 0; }
  get dur() { return 2.6; }
  draw(ctx, t) {
    const k = (t - this.t0) / this.dur; if (k >= 1 && !this.parts.length) { this.done = true; return; }
    const img = ready(TOOLS[this.kind]); const h = this.h;
    const inK = easeOut(k / 0.22), outK = easeInOut((k - 0.8) / 0.2);
    const tilt = this.kind === 'water' ? -0.62 * easeInOut((k - 0.18) / 0.2) * (1 - outK) : this.kind === 'fertilize' ? -0.9 * easeInOut((k - 0.18) / 0.2) * (1 - outK) : 0;
    const toolH = h * (this.kind === 'water' ? 0.36 : this.kind === 'pest' ? 0.32 : 0.34);
    const tx = this.x + h * (this.kind === 'water' ? 0.44 : this.kind === 'pest' ? 0.05 : 0.36) + (1 - inK) * h * 0.4 + outK * h * 0.5;
    const ty = this.base - h * (this.kind === 'pest' ? 1.22 : 1.04) - (1 - inK) * h * 0.25 - outK * h * 0.2;
    const W = img ? toolH * img.width / img.height : toolH;
    const rot = tilt + (this.kind === 'mist' ? -0.12 * Math.sin(Math.PI * clamp((k - 0.3) / 0.5)) : 0);
    const flip = this.kind === 'water' ? -1 : 1;
    if (img && k < 1) {
      ctx.save(); ctx.globalAlpha = clamp(inK) * (1 - outK); ctx.translate(tx, ty); ctx.rotate(rot); ctx.scale(flip, 1);
      ctx.drawImage(img, -W / 2, -toolH / 2, W, toolH); ctx.restore();
    }
    const tip = {water: [-W * 0.5, -toolH * 0.34], mist: [-W * 0.34, -toolH * 0.3], fertilize: [-W * 0.42, toolH * 0.3], pest: [0, toolH * 0.5]}[this.kind];
    const ex = tx + tip[0] * Math.cos(rot) - tip[1] * Math.sin(rot), ey = ty + tip[0] * Math.sin(rot) + tip[1] * Math.cos(rot);
    if (k > 0.32 && k < 0.8) {
      const rate = {water: 60, mist: 40, fertilize: 34, pest: 8}[this.kind];
      const want = Math.floor((k - 0.32) * this.dur * rate);
      while (this.emitted < want) {
        this.emitted++; const r = Math.random;
        if (this.kind === 'water') this.parts.push({t, x: ex + r() * 3, y: ey, vx: -h * (0.12 + r() * 0.08), vy: h * 0.1, s: h * (0.008 + r() * 0.007)});
        if (this.kind === 'mist') { const a = Math.PI * (0.8 + r() * 0.4); this.parts.push({t, x: ex, y: ey, vx: Math.cos(a) * h * (0.3 + r() * 0.4), vy: Math.sin(a) * h * 0.25 + h * 0.08, s: h * (0.02 + r() * 0.04)}); }
        if (this.kind === 'fertilize') this.parts.push({t, x: ex + r() * 6, y: ey, vx: -h * r() * 0.08, vy: h * 0.05, s: h * (0.006 + r() * 0.006), spin: r() * TAU});
        if (this.kind === 'pest') this.parts.push({t, x: ex, y: ey, vx: 0, vy: h * 0.25, s: h * 0.012});
      }
    }
    const floor = this.base - h * 0.16;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; const age = t - p.t;
      if (this.kind !== 'mist') {
        const g = h * 2.2, px = p.x + p.vx * age, py = p.y + p.vy * age + 0.5 * g * age * age;
        if (py >= floor || p.hit) {
          p.hit = p.hit || t; const rk = (t - p.hit) / 0.5;
          if (rk > 1) { this.parts.splice(i, 1); continue; }
          if (this.kind === 'fertilize') { ctx.fillStyle = `rgba(222,190,110,${1 - rk})`; ctx.beginPath(); ctx.arc(px, floor, p.s, 0, TAU); ctx.fill(); continue; }
          ctx.strokeStyle = this.kind === 'pest' ? `rgba(170,200,140,${(1 - rk) * 0.9})` : `rgba(150,200,230,${(1 - rk) * 0.9})`;
          ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(px, floor, p.s * (1 + rk * 5), p.s * (0.3 + rk * 1.2), 0, 0, TAU); ctx.stroke(); continue;
        }
        if (this.kind === 'fertilize') { ctx.save(); ctx.translate(px, py); ctx.rotate(p.spin + age * 6); ctx.fillStyle = 'rgba(226,192,112,.95)'; ctx.fillRect(-p.s, -p.s, p.s * 2, p.s * 2); ctx.restore(); continue; }
        ctx.fillStyle = this.kind === 'pest' ? 'rgba(150,100,40,.85)' : 'rgba(140,196,232,.9)';
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
      ctx.strokeStyle = `rgba(180,210,160,${(1 - q) * 0.8})`; ctx.lineWidth = 2;
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
    this.canvas = canvas; this.spec = plantSpec(plant); this.state = state;
    this.actions = []; this.raf = 0; this.perkAt = -10;
    this.growFrom = state.animateGrow && !reducedMotion() ? now() : -10;
    this.resize();
    plantPromise(this.spec).then(() => this.kick());
    Object.values(TOOLS).forEach(loadImage);
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    this.ctx = this.canvas.getContext('2d');
  }
  play(kind) {
    if (kind === 'water') this.state.wet = true;
    this.perkAt = now();
    if (!reducedMotion()) this.actions.push(new CareAction(kind, this.w / 2, this.h * (this.state.base ?? 0.92), this.h * 0.78));
    this.kick();
  }
  render(t) {
    const {ctx, w, h} = this; const base = this.state.base ?? 0.92; const fill = this.state.fill ?? 0.8;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const im = plantImage(this.spec); if (!im) return;
    // fit inside the frame: limit by height and by width
    const aspect = im.img.width / im.img.height;
    const hh = Math.min(h * fill, (w * 0.86) / aspect);
    const cx = w / 2 + (im.ax - 0.5) * hh * aspect * (this.spec.flip ? -1 : 1);
    const reveal = easeOut((t - this.growFrom) / 1.2);
    const perk = clamp(1 - (t - this.perkAt) / 1.6);
    const box = drawPlant(ctx, this.spec, cx, h * base, hh, {droop: this.state.droop && !perk ? 0.6 : 0, reveal, sway: this.actions.length ? Math.sin((t - this.perkAt) * 7) * 0.04 * perk : 0, scale: 1 + Math.sin(Math.PI * perk) * 0.03, glow: perk * 0.7, noShadow: this.state.noShadow});
    if (box && this.state.wet) for (let i = 0; i < 4; i++) glint(ctx, cx + Math.cos(i * 2.3 + this.spec.phase) * box.W * 0.28, h * base - box.H * (0.45 + 0.4 * ((i * 0.31) % 1)), Math.max(3, box.H * 0.035), 0.4 + 0.6 * Math.abs(Math.sin(t * 1.4 + i * 1.7 + this.spec.phase)));
    this.actions.forEach(a => a.draw(ctx, t)); this.actions = this.actions.filter(a => !a.done);
  }
  kick() {
    if (this.raf) return;
    const tick = () => {
      this.raf = 0; const t = now(); this.render(t);
      const busy = this.actions.length || t - this.growFrom < 1.3 || t - this.perkAt < 1.7;
      if (busy && this.canvas.isConnected) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  destroy() { cancelAnimationFrame(this.raf); this.raf = 0; }
}

// ---------------------------------------------------------------- day / night
const MODE_KEY = 'xiaomao-scene-mode';
export function getMode() { try { return localStorage.getItem(MODE_KEY) || 'auto'; } catch { return 'auto'; } }
export function setMode(mode) { try { localStorage.setItem(MODE_KEY, mode); } catch { /* private mode: keep it for this visit */ } }
export function currentHour() {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('hour') : null;
  if (q != null && q !== '' && !Number.isNaN(Number(q))) return clamp(Number(q), 0, 23.99);
  const d = new Date(); return d.getHours() + d.getMinutes() / 60;
}
/** 'day' or 'night' for the chosen mode; auto follows the device's local time. */
export function resolvedPhase(mode = getMode()) {
  if (mode === 'day' || mode === 'night') return mode;
  const h = currentHour(); return h >= 6 && h < 18.5 ? 'day' : 'night';
}
export function greeting(hour) {
  if (hour < 5) return '夜深了'; if (hour < 11) return '早上好'; if (hour < 13) return '中午好'; if (hour < 18) return '下午好'; return '晚上好';
}

// ---------------------------------------------------------------- the conservatory plate
// Geometry of each painted plate, as fractions of the image.
const PLATES = {
  wide: {
    sill: [{x0: 0.345, x1: 0.655, y: 0.79, h: 0.25}],
    shelf: [{x0: 0.075, x1: 0.265, y: 0.585, h: 0.16}, {x0: 0.075, x1: 0.265, y: 0.728, h: 0.125}, {x0: 0.075, x1: 0.265, y: 0.872, h: 0.125}],
    hanging: {rail: 0.075, xs: [[0.15, 0.3], [0.7, 0.85]], drop: 0.13, h: 0.2},
    cat: {x: 0.915, y: 0.845, h: 0.16}, sleep: {x: 0.915, y: 0.84, h: 0.1},
    lamps: [[0.925, 0.535, 0.14], [0.03, 0.31, 0.1]], window: [0.39, 0.12, 0.61, 0.72]
  },
  tall: {
    sill: [{x0: 0.36, x1: 0.97, y: 0.795, h: 0.2}],
    shelf: [{x0: 0.01, x1: 0.175, y: 0.59, h: 0.1}, {x0: 0.01, x1: 0.175, y: 0.7, h: 0.1}, {x0: 0.01, x1: 0.175, y: 0.805, h: 0.095}],
    hanging: {rail: 0.075, xs: [[0.32, 0.95]], drop: 0.09, h: 0.15},
    cat: {x: 0.28, y: 0.975, h: 0.13}, sleep: {x: 0.27, y: 0.975, h: 0.08},
    lamps: [[0.04, 0.33, 0.1]], window: [0.46, 0.17, 0.92, 0.72]
  }
};
const TRAILING = new Set(['pothos', 'spider']);
const SMALL = new Set(['succulent', 'sprout']);

/** Decide each plant's zone: its own choice, otherwise by habit, overflowing to the next zone when full. */
export function assignZones(list, form = 'wide') {
  const cap = form === 'wide' ? {sill: 4, shelf: 6, hanging: 4} : {sill: 4, shelf: 3, hanging: 4};
  const count = {sill: 0, shelf: 0, hanging: 0};
  const out = new Map();
  for (const p of list) if (p.zone && p.zone !== 'auto') { out.set(p.id, p.zone); count[p.zone]++; }
  for (const p of list) {
    if (out.has(p.id)) continue;
    const kind = plantSpec(p).kind;
    const pref = TRAILING.has(kind) ? ['hanging', 'shelf', 'sill'] : SMALL.has(kind) ? ['shelf', 'sill', 'hanging'] : ['sill', 'shelf', 'hanging'];
    const zone = pref.find(z => count[z] < cap[z]) || pref[0];
    out.set(p.id, zone); count[zone]++;
  }
  return out;
}

/**
 * Lay plants out inside one segment without overlaps: heights shrink until the summed widths fit.
 * items: [{spec}] → [{x, y, h}]
 */
function packRow(items, x0, x1, y, hMax, ratio) {
  // x is a fraction of the plate's width, h of its height; ratio = plate height / width converts between them
  const span = x1 - x0; const n = items.length; if (!n) return [];
  const aspects = items.map(it => plantAspect(it.spec) * SPRITES_SCALE(it.spec) * ratio);
  const gap = span * 0.04;
  const h = Math.min(hMax, (span - gap * (n + 1)) / aspects.reduce((a, b) => a + b, 0));
  const widths = aspects.map(a => a * h);
  const free = (span - widths.reduce((a, b) => a + b, 0)) / (n + 1);
  let x = x0 + free;
  return items.map((it, i) => { const cx = x + widths[i] / 2; x += widths[i] + free; return {cx, y, h: h * SPRITES_SCALE(it.spec), w: widths[i]}; });
}
function SPRITES_SCALE(spec) { return spec.portrait ? 1 : (SPRITES[spec.kind]?.scale ?? 1) * spec.size; }

export class GardenScene {
  constructor(canvas, {onPlantClick, onHover, onCat} = {}) {
    this.canvas = canvas; this.onPlantClick = onPlantClick; this.onHover = onHover; this.onCat = onCat;
    this.plants = []; this.actions = []; this.hit = []; this.hover = null;
    this.pointer = {x: -1, y: -1, vx: 0}; this.wind = 0; this.catLook = 0; this.catHappyUntil = 0;
    this.start = now(); this.visible = true; this.raf = 0;
    this.phase = resolvedPhase(); this.mix = this.phase === 'night' ? 1 : 0; // 0 day … 1 night
    const r = rng(1017);
    this.motes = Array.from({length: 26}, () => [r(), r(), r() * TAU, r() * 0.6 + 0.4]);
    ['cat-tail', 'cat-look', 'cat-sleep', 'plant-sprout', ...Object.values(TOOLS)].forEach(n => loadImage(n).promise.then(() => this.loop()));
    this.resize();
    this.ro = new ResizeObserver(() => { this.resize(); this.loop(); }); this.ro.observe(canvas);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.loop(); }); this.io.observe(canvas);
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
    const r = this.canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    this.ctx = this.canvas.getContext('2d');
    this.form = this.w / this.h < 1.1 ? 'tall' : 'wide';
  }
  setPhase(phase) {
    if (phase === this.phase) return;
    this.phase = phase; this.fadeFrom = this.mix; this.fadeAt = now();
    if (reducedMotion()) { this.mix = phase === 'night' ? 1 : 0; this.fadeAt = null; }
    this.loop();
  }
  setPlants(list) {
    // list: [{id, plant, droop, wet}]
    const known = new Map(this.plants.map(p => [p.id, p]));
    this.plants = list.map((p, i) => ({...known.get(p.id), ...p, spec: plantSpec(p.plant), born: known.get(p.id)?.born ?? (now() + 0.5 + i * 0.14)}));
    if (reducedMotion()) this.plants.forEach(p => { p.born = -10; });
    this.plants.forEach(p => plantPromise(p.spec).then(() => this.loop()));
    this.loop();
  }
  move(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (this.pointer.x >= 0) this.pointer.vx = x - this.pointer.x;
    this.pointer.x = x; this.pointer.y = y;
    const hits = this.hit.filter(h => x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1);
    const hit = hits.find(h => h.cat) || hits.sort((a, b) => Math.abs(a.cx - x) - Math.abs(b.cx - x))[0] || null;
    this.setHover(hit); this.loop();
  }
  setHover(hit) {
    const same = (hit?.id || hit?.cat || null) === (this.hover?.id || this.hover?.cat || null);
    this.hover = hit; if (same) return;
    this.canvas.style.cursor = hit ? 'pointer' : 'default';
    this.onHover?.(hit);
  }
  play(id, kind) {
    const h = this.hit.find(x => x.id === id); const p = this.plants.find(x => x.id === id);
    if (p) { if (kind === 'water') p.wet = true; p.droop = false; p.perkAt = now(); }
    if (h && !reducedMotion()) this.actions.push(new CareAction(kind, h.cx, h.base, h.ph));
    this.loop();
  }
  frame() {
    // the plate is shown whole (contain), centred
    const img = ready(`scene-day-${this.form}`) || ready(`scene-night-${this.form}`);
    const iw = img?.width || (this.form === 'wide' ? 2000 : 1300), ih = img?.height || (this.form === 'wide' ? 1085 : 1637);
    const s = Math.min(this.w / iw, this.h / ih);
    return {s, x: (this.w - iw * s) / 2, y: (this.h - ih * s) / 2, iw, ih, W: iw * s, H: ih * s};
  }
  drawPlate(t) {
    const {ctx} = this;
    if (this.fadeAt != null) {
      const k = easeInOut((t - this.fadeAt) / 1.4); const target = this.phase === 'night' ? 1 : 0;
      this.mix = lerp(this.fadeFrom, target, k); if (k >= 1) this.fadeAt = null;
    }
    const F = this.frame();
    const day = ready(`scene-day-${this.form}`), night = ready(`scene-night-${this.form}`);
    [`scene-day-${this.form}`, `scene-night-${this.form}`].forEach(n => { if (!ready(n)) loadImage(n).promise.then(() => this.loop()); });
    if (day && this.mix < 1) ctx.drawImage(day, F.x, F.y, F.W, F.H);
    if (night && this.mix > 0) { ctx.globalAlpha = day ? this.mix : 1; ctx.drawImage(night, F.x, F.y, F.W, F.H); ctx.globalAlpha = 1; }
    return F;
  }
  P(F, fx, fy) { return [F.x + fx * F.W, F.y + fy * F.H]; }
  tone() {
    if (!filterSupported || this.mix <= 0.01) return '';
    const m = this.mix; return `brightness(${(1 - m * 0.32).toFixed(3)}) saturate(${(1 - m * 0.18).toFixed(3)}) sepia(${(m * 0.22).toFixed(3)})`;
  }
  drawAtmosphere(t, F) {
    const {ctx} = this; const G = PLATES[this.form]; const reduce = reducedMotion();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // lamp light breathing at night
    if (this.mix > 0.05) for (const [fx, fy, fr] of G.lamps) {
      const [x, y] = this.P(F, fx, fy); const r = fr * F.W * (1 + (reduce ? 0 : Math.sin(t * 2.3 + fx * 9) * 0.04 + Math.sin(t * 7.1) * 0.015));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,190,90,${0.28 * this.mix})`); g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    // day: dust in the window light; night: a few slow golden motes (the library's quiet magic)
    const [wx0, wy0] = this.P(F, G.window[0], G.window[1]), [wx1, wy1] = this.P(F, G.window[2], G.window[3]);
    for (const [mx, my, ph, s] of this.motes) {
      const k = reduce ? 0 : t;
      const x = lerp(wx0, wx1, (mx + Math.sin(k * 0.13 * s + ph) * 0.08 + 1) % 1);
      const y = lerp(wy0, F.y + F.H * 0.92, (my + k * 0.012 * s) % 1);
      const a = (0.25 + 0.5 * Math.sin(k * 0.9 * s + ph) ** 2);
      if (this.mix < 0.95) { ctx.fillStyle = `rgba(255,246,220,${a * 0.5 * (1 - this.mix)})`; ctx.beginPath(); ctx.arc(x, y, s * 1.2, 0, TAU); ctx.fill(); }
      if (this.mix > 0.05) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, 7 * s);
        g.addColorStop(0, `rgba(255,214,120,${a * 0.8 * this.mix})`); g.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7 * s, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  layout(F) {
    const G = PLATES[this.form];
    const zones = assignZones(this.plants.map(p => p.plant), this.form);
    const by = {sill: [], shelf: [], hanging: []};
    this.plants.forEach(p => by[zones.get(p.id)]?.push(p));
    const placed = [];
    // windowsill: one segment
    for (const seg of G.sill) packRow(by.sill.map(p => ({spec: p.spec})), seg.x0, seg.x1, seg.y, seg.h, F.H / F.W).forEach((pos, i) => placed.push({p: by.sill[i], zone: 'sill', ...pos}));
    // shelves: spread across the boards, balancing width
    const boards = G.shelf.map(() => []);
    by.shelf.forEach((p, i) => boards[i % boards.length].push(p));
    boards.forEach((list, b) => { const seg = G.shelf[b]; packRow(list.map(p => ({spec: p.spec})), seg.x0, seg.x1, seg.y, seg.h, F.H / F.W).forEach((pos, i) => placed.push({p: list[i], zone: 'shelf', ...pos})); });
    // hanging: share the rail's open stretches between plants, then hang each from its own point
    const H = G.hanging; const n = by.hanging.length;
    if (n) {
      const total = H.xs.reduce((a, [a0, a1]) => a + (a1 - a0), 0);
      const per = H.xs.map(([a0, a1]) => Math.round(n * (a1 - a0) / total));
      let diff = n - per.reduce((a, b) => a + b, 0); for (let i = 0; diff !== 0; i = (i + 1) % per.length) { per[i] += Math.sign(diff); diff -= Math.sign(diff); }
      let k = 0;
      H.xs.forEach(([a0, a1], si) => {
        const list = by.hanging.slice(k, k + per[si]); k += per[si];
        packRow(list.map(p => ({spec: p.spec})), a0, a1, 0, H.h, F.H / F.W).forEach((pos, i) => placed.push({p: list[i], zone: 'hanging', ...pos, y: H.rail + H.drop + pos.h}));
      });
    }
    return placed.map(o => ({...o, x: F.x + o.cx * F.W, base: F.y + o.y * F.H, ph: o.h * F.H, pw: o.w * F.W}));
  }
  drawPlants(t, F) {
    const {ctx} = this; const G = PLATES[this.form];
    const gust = this.pointer.x >= 0 ? clamp(this.pointer.vx / 30, -1, 1) : 0;
    this.wind = lerp(this.wind, gust, 0.06); this.pointer.vx *= 0.88;
    const tone = this.tone();
    if (!this.plants.length) {
      const seg = G.sill[0]; const [x, y] = this.P(F, (seg.x0 + seg.x1) / 2, seg.y);
      drawPlant(ctx, {kind: 'sprout', flip: false, size: 1, hue: 0, phase: 0}, x, y, seg.h * F.H * 0.5, {tone, reveal: easeOut((t - this.start - 0.4) / 1.4)});
      return;
    }
    for (const s of this.layout(F)) {
      const {p} = s;
      const near = this.pointer.x >= 0 ? clamp(1 - Math.abs(this.pointer.x - s.x) / (s.ph * 0.9)) : 0;
      const perk = clamp(1 - (t - (p.perkAt ?? -10)) / 1.8);
      const reduce = reducedMotion();
      let sway = (reduce ? 0 : Math.sin(t * 0.9 + p.spec.phase) * 0.015) + this.wind * near * 0.16 + Math.sin((t - (p.perkAt ?? 0)) * 8) * 0.05 * perk;
      let x = s.x;
      if (s.zone === 'hanging') {
        // the pot swings gently from its chain
        const swing = reduce ? 0 : Math.sin(t * 0.8 + p.spec.phase) * 0.018 + this.wind * near * 0.05;
        const [, ry] = this.P(F, 0, G.hanging.rail);
        const len = s.base - s.ph * 0.18 - ry;
        x = s.x + Math.sin(swing) * len; sway *= 0.5;
        ctx.save(); ctx.strokeStyle = this.mix > 0.5 ? 'rgba(160,128,70,.85)' : 'rgba(150,118,60,.9)'; ctx.lineWidth = Math.max(1, F.W * 0.0012);
        const potTop = s.base - s.ph * 0.18; const spread = s.pw * 0.18;
        for (const dx of [-spread, 0, spread]) { ctx.beginPath(); ctx.moveTo(s.x, ry); ctx.lineTo(x + dx, potTop); ctx.stroke(); }
        ctx.fillStyle = 'rgba(170,135,70,1)'; ctx.beginPath(); ctx.arc(s.x, ry, Math.max(2, F.W * 0.003), 0, TAU); ctx.fill();
        ctx.restore();
      }
      const isHover = this.hover?.id === p.id;
      const box = drawPlant(ctx, p.spec, x, s.base, s.ph, {tone, reveal: easeOut((t - p.born) / 1.3), sway, droop: p.droop ? 0.75 : 0, glow: Math.max(isHover ? 0.9 : 0, perk), scale: 1 + Math.sin(Math.PI * perk) * 0.04, noShadow: s.zone === 'hanging'});
      if (box && p.wet) for (let i = 0; i < 4; i++) glint(ctx, x + Math.cos(i * 2.1 + p.spec.phase) * box.W * 0.28, s.base - box.H * (0.4 + 0.45 * ((i * 0.29 + p.spec.phase) % 1)), Math.max(2.5, box.H * 0.03), 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + i * 1.9 + p.spec.phase)));
      if (box) this.hit.push({id: p.id, name: p.plant.name, zone: s.zone, cx: x, base: s.base, ph: s.ph, x0: x - box.W * 0.5, x1: x + box.W * 0.5, y0: s.base - box.H, y1: s.base + 4});
    }
  }
  drawCat(t, F) {
    const {ctx} = this; const G = PLATES[this.form]; const reduce = reducedMotion(); const tone = this.tone();
    if (this.mix > 0.5) {
      const img = ready('cat-sleep'); if (!img) return;
      const [x, y] = this.P(F, G.sleep.x, G.sleep.y); const H = G.sleep.h * F.H, W = H * img.width / img.height;
      const breathe = reduce ? 1 : 1 + Math.sin(t * 1.4) * 0.02;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, breathe); if (tone) ctx.filter = tone; ctx.drawImage(img, -W / 2, -H, W, H); ctx.restore();
      if (!reduce) for (let i = 0; i < 3; i++) {
        const k = (t * 0.35 + i / 3) % 1;
        ctx.save(); ctx.globalAlpha = Math.sin(Math.PI * k) * 0.85; ctx.fillStyle = '#f1e2bf';
        ctx.font = `italic ${Math.round(H * (0.22 + k * 0.18))}px "IM Fell English", Georgia, serif`;
        ctx.fillText('z', x + W * 0.3 + k * H * 0.4, y - H * 1.0 - k * H * 0.7); ctx.restore();
      }
      this.hit.push({cat: 'sleep', x0: x - W / 2, x1: x + W / 2, y0: y - H, y1: y});
      return;
    }
    const [x, y] = this.P(F, G.cat.x, G.cat.y); const h = G.cat.h * F.H;
    const want = this.hover?.cat || t < this.catHappyUntil ? 1 : 0;
    this.catLook = lerp(this.catLook, want, 0.09);
    const strip = (name, frame) => {
      const img = ready(name); if (!img) return;
      const cw = img.width / 4, W = h * cw / img.height, ax = name === 'cat-look' ? 0.528 : 0.503;
      ctx.save(); ctx.translate(x, y); if (tone) ctx.filter = tone; ctx.drawImage(img, cw * frame, 0, cw, img.height, -W * ax, -h, W, h); ctx.restore();
    };
    if (this.catLook > 0.02) {
      const happy = t < this.catHappyUntil;
      strip('cat-look', this.catLook > 0.85 ? (happy ? 3 : 2) : this.catLook > 0.35 ? 1 : 0);
      if (happy && !reduce) {
        const q = clamp((this.catHappyUntil - t) / 2.2);
        ctx.save(); ctx.globalAlpha = Math.sin(Math.PI * q); ctx.fillStyle = '#9c3b3b';
        const hx = x + h * 0.22, hy = y - h * 1.05 - (1 - q) * h * 0.3, s = h * 0.07;
        ctx.beginPath(); ctx.moveTo(hx, hy + s); ctx.bezierCurveTo(hx - s * 1.6, hy - s * 0.4, hx - s * 0.5, hy - s * 1.4, hx, hy - s * 0.5); ctx.bezierCurveTo(hx + s * 0.5, hy - s * 1.4, hx + s * 1.6, hy - s * 0.4, hx, hy + s); ctx.fill();
        ctx.restore();
      }
    } else {
      const seq = [0, 1, 2, 1, 0, 0, 3, 0];
      strip('cat-tail', seq[Math.floor((reduce ? 0 : t * 0.85) % seq.length)]);
    }
    this.hit.push({cat: 'awake', x0: x - h * 0.3, x1: x + h * 0.3, y0: y - h, y1: y});
  }
  draw() {
    const t = now(); const {ctx, dpr} = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, this.w, this.h);
    this.hit = [];
    const F = this.drawPlate(t);
    this.drawCat(t, F);
    this.drawPlants(t, F);
    this.drawAtmosphere(t, F);
    this.actions.forEach(a => a.draw(ctx, t)); this.actions = this.actions.filter(a => !a.done);
    this.canvas.dataset.phase = this.mix > 0.5 ? 'night' : 'day';
  }
  loop() {
    if (this.raf) return;
    const tick = () => {
      this.raf = 0;
      if (!this.visible || document.hidden) return;
      this.draw();
      const busy = this.actions.length || this.fadeAt != null || now() - this.start < 4 || this.plants.some(p => now() - p.born < 1.4);
      if (!reducedMotion() || busy) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
}
