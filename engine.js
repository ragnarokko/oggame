// Motore di gioco: stato, produzione, code, flotte, combattimento, NPC.
const SAVE_KEY = 'orbita-save-v1';
const GALAXIES = 3, SYSTEMS = 30, SLOTS = 15;
const HOUR = 3600000;
let G = null;
// Orologio di gioco a turni: il tempo avanza solo con endTurn(); G.clock è l'inizio del turno corrente.
const T = () => G ? G.clock : 0;
const turnMs = () => G.turnMs || HOUR;
const turnAt = t => G.turn + Math.floor((t - G.clock) / turnMs());
const turnsText = ms => { const n = Math.max(1, Math.ceil(ms / turnMs() - 1e-9)); return n === 1 ? '1 turno' : n + ' turni'; };
// Ore di produzione "di universo" che passano in un turno.
const turnHours = () => turnMs() / HOUR * G.speed;

const coordKey = (g, s, p) => g + ':' + s + ':' + p;
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- Formule ----------
const lvlOf = (pl, id) => DEFS[id].type === 'b' ? (pl.b[id] || 0) : (G.tech[id] || 0);
function costOf(id, level) { const d = DEFS[id]; const m = Math.pow(d.f, level - 1); return d.cost.map(c => Math.floor(c * m)); }
const resTotal = c => c[0] + c[1];
const labLevel = () => Math.max(0, ...G.planets.map(p => p.b.researchLab || 0));
function buildTime(pl, id, level) { const c = costOf(id, level); return resTotal(c) / (2500 * (1 + (pl.b.robotics || 0)) * Math.pow(2, pl.b.nanite || 0)) / G.speed * HOUR; }
function researchTime(id, level) { const c = costOf(id, level); return resTotal(c) / (1000 * (1 + labLevel())) / G.speed * HOUR; }
function unitTime(pl, id) { const c = DEFS[id].cost; return Math.max(1000, resTotal(c) / (5000 * (1 + (pl.b.shipyard || 0)) * Math.pow(2, pl.b.nanite || 0)) / G.speed * HOUR); }
const storageCap = l => 5000 * Math.floor(2.5 * Math.exp(20 * l / 33));
const capacities = pl => [storageCap(pl.b.metalStorage || 0), storageCap(pl.b.crystalStorage || 0), storageCap(pl.b.deutTank || 0)];
const satEnergy = pl => Math.max(1, Math.min(50, Math.floor((pl.maxTemp + 160) / 6)));
const maxFields = pl => pl.fields + 5 * (pl.b.terraformer || 0) + 3 * (pl.b.lunarBase || 0);
const usedFields = pl => Object.keys(pl.b).reduce((s, k) => s + (k === 'terraformer' ? 0 : pl.b[k]), 0);
const planetCount = () => G.planets.filter(p => !p.moon).length;
const maxPlanets = () => 1 + Math.ceil((G.tech.astro || 0) / 2);
const fleetSlots = () => 1 + (G.tech.computerTech || 0);
const expeditionSlots = () => Math.floor(Math.sqrt(G.tech.astro || 0));

function meets(pl, id) { return Object.entries(DEFS[id].req).every(([k, v]) => lvlOf(pl, k) >= v); }
function reqText(pl, id) {
  return Object.entries(DEFS[id].req).map(([k, v]) => `<span class="${lvlOf(pl, k) >= v ? 'ok' : 'bad'}">${DEFS[k].name} ${v}</span>`).join(', ');
}

function calcProd(pl) {
  if (pl.moon) return { m: 0, c: 0, d: 0, energyProd: 0, energyUse: 0, factor: 1, fusDeut: 0 };
  const S = G.speed, pc = pl.pct, b = pl.b, T = G.tech;
  const e = l => l * Math.pow(1.1, l);
  const lm = b.metalMine || 0, lc = b.crystalMine || 0, ld = b.deutSynth || 0, lf = b.fusionPlant || 0;
  const use = 10 * e(lm) * pc.metalMine / 100 + 10 * e(lc) * pc.crystalMine / 100 + 20 * e(ld) * pc.deutSynth / 100;
  const sol = 20 * e(b.solarPlant || 0) * pc.solarPlant / 100;
  const fus = 30 * lf * Math.pow(1.05 + 0.01 * (T.energyTech || 0), lf) * pc.fusionPlant / 100;
  const sat = (pl.ships.solarSat || 0) * satEnergy(pl) * pc.solarSat / 100;
  const prodE = sol + fus + sat;
  const f = use <= 0 ? 1 : Math.min(1, prodE / use);
  const pl_ = T.plasmaTech || 0;
  const m = 30 * S + 30 * e(lm) * S * pc.metalMine / 100 * f * (1 + 0.01 * pl_);
  const c = 15 * S + 20 * e(lc) * S * pc.crystalMine / 100 * f * (1 + 0.0066 * pl_);
  const fusDeut = 10 * e(lf) * S * pc.fusionPlant / 100;
  const d = 10 * e(ld) * S * (1.44 - 0.004 * pl.maxTemp) * pc.deutSynth / 100 * f * (1 + 0.0033 * pl_) - fusDeut;
  return { m, c, d, energyProd: prodE, energyUse: use, factor: f, fusDeut };
}

function accrue(pl, t) {
  const dt = (t - pl.t) / HOUR; if (dt <= 0) return;
  const p = calcProd(pl), cap = capacities(pl), r = [p.m, p.c, p.d];
  for (let i = 0; i < 3; i++) {
    if (r[i] < 0) pl.res[i] = Math.max(0, pl.res[i] + r[i] * dt);
    else if (pl.res[i] < cap[i]) pl.res[i] = Math.min(cap[i], pl.res[i] + r[i] * dt);
  }
  pl.t = t;
}

function updateShipQueue(pl, now) {
  while (pl.shipQ.length) {
    const it = pl.shipQ[0], ut = unitTime(pl, it.id);
    const k = Math.min(it.n, Math.floor((now - pl.shipT) / ut));
    if (k > 0) {
      const store = DEFS[it.id].type === 'd' ? pl.defs : pl.ships;
      store[it.id] = (store[it.id] || 0) + k; it.n -= k; pl.shipT += k * ut;
    }
    if (it.n <= 0) { pl.shipQ.shift(); continue; }
    break;
  }
}

// ---------- Universo ----------
const FIELDS_BY_SLOT = [0, 45, 55, 70, 100, 130, 140, 160, 170, 160, 140, 120, 100, 80, 70, 60];
function tempFor(slot) { return Math.round(250 - (slot - 1) * (380 / 14) + rnd(-12, 12)); }

function newPlanet(name, g, s, p, fields, maxTemp) {
  const pl = {
    id: G.nextId++, name, g, s, p, fields, maxTemp, res: [500, 500, 0], b: {}, ships: {}, defs: {},
    pct: { metalMine: 100, crystalMine: 100, deutSynth: 100, solarPlant: 100, fusionPlant: 100, solarSat: 100 },
    buildQ: null, shipQ: [], shipT: 0, t: T(),
  };
  return pl;
}

const SYL = ['ka', 'zor', 'mel', 'tar', 'ix', 'vol', 'ren', 'dal', 'ur', 'sha', 'kin', 'bel', 'nox', 'ari', 'quo', 'tem', 'lys', 'gor', 'fen', 'sil'];
const randName = () => { let n = ''; for (let i = rint(2, 3); i > 0; i--) n += SYL[rint(0, SYL.length - 1)]; return n[0].toUpperCase() + n.slice(1); };

const NPC_TIERS = [
  ['rocket', 'lightFighter', 'smallCargo'],
  ['lightLaser', 'heavyFighter', 'largeCargo'],
  ['cruiser', 'heavyLaser', 'ion'],
  ['battleship', 'gauss', 'recycler'],
  ['destroyer', 'bomber', 'plasma', 'battlecruiser'],
];
// Stile: come l'NPC divide la spesa di ogni turno (flotta / difese / economia); raid = propensione ad attaccare; eco0 = quota di punti in economia alla creazione.
const NPC_STYLES = {
  aggressive: { name: 'Aggressivo', fleet: 0.65, def: 0.10, eco: 0.25, raid: 2.5, eco0: 0.15 },
  defensive: { name: 'Difensivo', fleet: 0.10, def: 0.65, eco: 0.25, raid: 0.2, eco0: 0.15 },
  miner: { name: 'Minatore', fleet: 0.20, def: 0.20, eco: 0.60, raid: 0.5, eco0: 0.45 },
  balanced: { name: 'Bilanciato', fleet: 0.35, def: 0.30, eco: 0.35, raid: 1, eco0: 0.25 },
};
// Abilità: act = probabilità di agire in un turno (altrimenti il turno è perso), eff = quota del tesoro spesa, picks = acquisti per categoria, ratio = prudenza negli attacchi.
const NPC_SKILLS = {
  high: { name: 'Molto abile', act: 1, eff: 1, picks: 5, ratio: 1 },
  mid: { name: 'Abilità media', act: 0.7, eff: 0.85, picks: 3, ratio: 0.85 },
  low: { name: 'Poco abile', act: 0.4, eff: 0.7, picks: 2, ratio: 0.65 },
};
const randKey = o => { const k = Object.keys(o); return k[rint(0, k.length - 1)]; };
const npcPool = age => { const pool = []; for (let t = 0; t <= Math.min(4, Math.floor(age / 50)); t++) pool.push(...NPC_TIERS[t]); return pool; };
const NPC_CARGO = ['smallCargo', 'largeCargo'];
// Unità acquistabili da un NPC in una categoria ('def' o 'fleet'); gli aggressivi non sprecano soldi in cargo.
function npcCands(npc, kind) {
  let c = npcPool(npc.age).filter(id => (DEFS[id].type === 'd') === (kind === 'def') && id !== 'recycler');
  if (kind === 'fleet' && npc.style === 'aggressive') { const w = c.filter(id => !NPC_CARGO.includes(id)); if (w.length) c = w; }
  return c;
}

function makeNPC(g, s, p, style, skill) {
  const rate0 = (120 + Math.random() * 500) * (1 + (g - 1) * 0.7) * (0.7 + (p / SLOTS) * 0.6);
  const npc = {
    name: randName() + ' ' + (['Prime', 'Nova', 'Station', 'Colony', 'Outpost'][rint(0, 4)]),
    owner: randName(), g, s, p, style: style || randKey(NPC_STYLES), skill: skill || randKey(NPC_SKILLS),
    rate0, rate: rate0, age: 0, res: [rate0 * 6, rate0 * 3, rate0 * 1.5], bank: [0, 0, 0], fleet: {}, def: {},
  };
  // Storia iniziale: una ventina di turni simulati con le regole normali, così stile e abilità si vedono subito.
  const target = rnd(10, 160), steps = 20;
  for (let i = 0; i < steps; i++) npcTurn(npc, target / steps, true);
  return npc;
}
const npcTech = n => { const l = Math.min(15, Math.floor(n.age / 30)); return { weapons: l, shield: l, armour: l, espionage: Math.floor(n.age / 40) + 1 }; };
// Le risorse e le flotte degli NPC cambiano solo a fine turno: le vecchie chiamate "al volo" non fanno più nulla.
function npcUpdate() { }

// Un turno di un NPC: incassa, poi (se agisce) spende il tesoro secondo stile e abilità.
function npcTurn(npc, hours, raw) {
  const H = hours != null ? hours : turnHours() * (G.opts ? G.opts.npcGrowth : 1);
  if (!(H > 0)) return;
  const st = NPC_STYLES[npc.style], sk = NPC_SKILLS[npc.skill];
  npc.bank = npc.bank || [0, 0, 0];
  npc.age += H; npc.rate = npc.rate0 * (1 + 0.12 * Math.sqrt(npc.age));
  const inc = [npc.rate * H, npc.rate * 0.5 * H, npc.rate * 0.25 * H];
  const cap = [npc.rate * 48, npc.rate * 24, npc.rate * 12];
  for (let k = 0; k < 3; k++) { npc.res[k] = Math.min(cap[k], npc.res[k] + inc[k] * 0.45); npc.bank[k] = Math.min(cap[k] * 4, npc.bank[k] + inc[k] * 0.55); }
  if (Math.random() > sk.act) return;
  const start = npc.bank.slice();
  for (const kind of ['fleet', 'def']) {
    const budget = start.map(v => v * st[kind] * sk.eff);
    for (let i = 0; i < sk.picks; i++) {
      const cand = npcCands(npc, kind); if (!cand.length) break;
      const id = cand[rint(0, cand.length - 1)], c = DEFS[id].cost;
      let n = Infinity;
      for (let k = 0; k < 3; k++) if (c[k] > 0) n = Math.min(n, Math.floor(Math.min(budget[k], npc.bank[k]) / (sk.picks - i) / c[k]));
      if (!isFinite(n) || n < 1) continue;
      for (let k = 0; k < 3; k++) { budget[k] -= c[k] * n; npc.bank[k] -= c[k] * n; }
      const store = DEFS[id].type === 'd' ? npc.def : npc.fleet;
      store[id] = (store[id] || 0) + n;
    }
  }
  // Economia: parte del tesoro diventa miniere, cioè produzione maggiore nei turni futuri.
  let invest = 0;
  for (let k = 0; k < 3; k++) { const x = start[k] * st.eco * sk.eff; npc.bank[k] -= x; invest += x; }
  npc.rate0 += invest / 600;
}

function stockValue(units) { return Object.entries(units || {}).reduce((s, [id, n]) => s + n * (DEFS[id].cost[0] + DEFS[id].cost[1] + DEFS[id].cost[2]), 0); }
function npcPoints(n) { return (n.rate0 * 4 + stockValue(n.fleet) + stockValue(n.def) + n.age * 300) / 1000; }
function playerPoints() {
  let v = 0;
  for (const pl of G.planets) {
    for (const [id, l] of Object.entries(pl.b)) for (let i = 1; i <= l; i++) v += costOf(id, i).reduce((a, b) => a + b, 0);
    v += stockValue(pl.ships) + stockValue(pl.defs);
  }
  for (const [id, l] of Object.entries(G.tech)) for (let i = 1; i <= l; i++) v += costOf(id, i).reduce((a, b) => a + b, 0);
  for (const f of G.fleets) v += stockValue(f.ships);
  return v / 1000;
}

function occupant(g, s, p, moon) {
  const pl = G.planets.find(x => x.g === g && x.s === s && x.p === p && !!x.moon === !!moon);
  if (pl) return { type: 'player', planet: pl };
  const npc = G.npcs.find(x => x.g === g && x.s === s && x.p === p);
  if (npc) return { type: 'npc', npc };
  return null;
}

const defaultOpts = () => ({ npcGrowth: 1, npcAggr: 2, hitPlayer: true, hitNpc: true, protect: true });
function newGame(name, speed, turnLen, npcCount) {
  G = { v: 2, name, speed, clock: 0, turn: 1, turnMs: (turnLen || 1) * HOUR, t: 0, tech: {}, planets: [], npcs: [], fleets: [], missiles: [], raids: [], news: [], cheat: { fleetMult: 1 }, opts: defaultOpts(), debris: {}, messages: [], researchQ: null, nextId: 1, nextFleet: 1, cur: 0, unread: 0 };
  const homeG = 1, homeS = rint(10, 20), homeP = rint(6, 9);
  const free = [];
  for (let g = 1; g <= GALAXIES; g++) for (let s = 1; s <= SYSTEMS; s++) for (let p = 1; p <= SLOTS; p++)
    if (!(g === homeG && s === homeS && p === homeP)) free.push([g, s, p]);
  for (let i = free.length - 1; i > 0; i--) { const j = rint(0, i); [free[i], free[j]] = [free[j], free[i]]; }
  for (const [g, s, p] of free.slice(0, Math.max(0, Math.min(free.length, npcCount == null ? 150 : npcCount)))) G.npcs.push(makeNPC(g, s, p));
  const home = newPlanet('Pianeta madre', homeG, homeS, homeP, 163, tempFor(homeP));
  G.planets.push(home); G.cur = home.id;
  addMsg('info', 'Benvenuto, comandante', `<p>Il tuo impero parte da <b>${home.name}</b> [${homeG}:${homeS}:${homeP}]. Costruisci miniere, ricerca nuove tecnologie, poi conquista i pianeti vicini.</p>`);
  G.unread = 1;
  save();
}

function addMsg(type, title, body, time) {
  G.messages.unshift({ id: G.nextId++, type, title, body, time: time || T(), turn: turnAt(time || T()), read: false });
  if (G.messages.length > 150) G.messages.length = 150;
  G.unread = G.messages.filter(m => !m.read).length;
}

// ---------- Salvataggio ----------
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) { } }
function normalize(o) {
  o.missiles = o.missiles || []; o.raids = o.raids || []; o.news = o.news || [];
  o.opts = Object.assign(defaultOpts(), o.opts || {}); o.cheat = Object.assign({ fleetMult: 1 }, o.cheat || {});
  // Salvataggi a tempo reale: l'istante dell'ultimo aggiornamento diventa l'inizio del turno 1.
  if (o.clock == null) o.clock = o.t || 0;
  o.turn = o.turn || 1; o.turnMs = o.turnMs || HOUR;
  const OLD = { fleeter: 'aggressive', turtle: 'defensive', balanced: 'balanced' };
  for (const n of o.npcs) {
    if (!NPC_STYLES[n.style]) n.style = OLD[n.prof] || randKey(NPC_STYLES);
    if (!NPC_SKILLS[n.skill]) n.skill = randKey(NPC_SKILLS);
    n.bank = n.bank || [0, 0, 0]; delete n.prof;
  }
  return o;
}
function load() {
  try { const s = localStorage.getItem(SAVE_KEY); if (!s) return false; G = normalize(JSON.parse(s)); return true; } catch (e) { return false; }
}
function saveFileText() { return JSON.stringify(G, null, 1); }
function loadFileText(txt) {
  const o = JSON.parse(txt);
  if (!o || !Array.isArray(o.planets) || !o.planets.length || !Array.isArray(o.npcs)) throw new Error('Salvataggio non valido.');
  G = normalize(o); save();
}

// Fine turno: gli eventi del turno si risolvono in ordine di tempo, poi ogni NPC gioca il suo turno.
function endTurn() {
  const target = G.clock + turnMs();
  advance(target);
  G.clock = target; G.turn++;
  for (const npc of G.npcs) npcTurn(npc);
  npcTick(target);
  save();
}

// ---------- Simulazione eventi ----------
function advance(now) {
  let changed = false;
  for (let guard = 0; guard < 20000; guard++) {
    let best = null, bt = Infinity;
    for (const pl of G.planets) if (pl.buildQ && pl.buildQ.end < bt) { bt = pl.buildQ.end; best = { k: 'b', pl }; }
    if (G.researchQ && G.researchQ.end < bt) { bt = G.researchQ.end; best = { k: 't' }; }
    for (const f of G.fleets) if (f.arr < bt) { bt = f.arr; best = { k: 'f', f }; }
    for (const m of G.missiles) if (m.arr < bt) { bt = m.arr; best = { k: 'm', m }; }
    for (const r of G.raids) if (r.arr < bt) { bt = r.arr; best = { k: 'r', r }; }
    if (!best || bt > now) break;
    for (const pl of G.planets) accrue(pl, bt);
    if (best.k === 'b') { const q = best.pl.buildQ; best.pl.b[q.id] = q.level; best.pl.buildQ = null; }
    else if (best.k === 't') { const q = G.researchQ; G.tech[q.id] = q.level; G.researchQ = null; }
    else if (best.k === 'm') missileArrive(best.m, bt);
    else if (best.k === 'r') raidArrive(best.r, bt);
    else fleetArrive(best.f, bt);
    changed = true;
  }
  for (const pl of G.planets) { accrue(pl, now); updateShipQueue(pl, now); }
  G.t = now;
  return changed;
}

// ---------- Azioni ----------
const canAfford = (pl, c) => pl.res[0] >= c[0] && pl.res[1] >= c[1] && pl.res[2] >= c[2];
const pay = (pl, c) => { for (let i = 0; i < 3; i++) pl.res[i] -= c[i]; };
const refund = (pl, c) => { for (let i = 0; i < 3; i++) pl.res[i] += c[i]; };

function startBuild(pl, id) {
  if (pl.buildQ) return 'Hai già una costruzione in corso su questo pianeta.';
  if (!meets(pl, id)) return 'Requisiti mancanti.';
  const wh = DEFS[id].where;
  if (wh === 'p' && pl.moon) return 'Questo edificio si costruisce solo sui pianeti.';
  if (wh === 'm' && !pl.moon) return 'Questo edificio si costruisce solo sulle lune.';
  const lvl = (pl.b[id] || 0) + 1, c = costOf(id, lvl);
  if (id !== 'terraformer' && usedFields(pl) >= maxFields(pl)) return 'Campi edificabili esauriti: serve un Terraformer.';
  if (!canAfford(pl, c)) return 'Risorse insufficienti.';
  pay(pl, c); const now = T();
  pl.buildQ = { id, level: lvl, cost: c, start: now, end: now + buildTime(pl, id, lvl) };
  return null;
}
function cancelBuild(pl) { if (!pl.buildQ) return; refund(pl, pl.buildQ.cost); pl.buildQ = null; }
function startResearch(pl, id) {
  if (pl.moon) return 'La ricerca si avvia solo dai pianeti.';
  if (G.researchQ) return 'Una ricerca è già in corso.';
  if (!meets(pl, id)) return 'Requisiti mancanti.';
  const lvl = (G.tech[id] || 0) + 1, c = costOf(id, lvl);
  if (!canAfford(pl, c)) return 'Risorse insufficienti.';
  pay(pl, c); const now = T();
  G.researchQ = { id, level: lvl, cost: c, planet: pl.id, start: now, end: now + researchTime(id, lvl) };
  return null;
}
function cancelResearch() {
  const q = G.researchQ; if (!q) return;
  const pl = G.planets.find(p => p.id === q.planet) || G.planets[0]; refund(pl, q.cost); G.researchQ = null;
}
function queueUnits(pl, id, n) {
  n = Math.floor(n); if (!(n > 0)) return 'Quantità non valida.';
  const d = DEFS[id];
  if (!meets(pl, id)) return 'Requisiti mancanti.';
  if (d.max) {
    const have = (pl.defs[id] || 0) + pl.shipQ.filter(q => q.id === id).reduce((s, q) => s + q.n, 0);
    n = Math.min(n, d.max - have); if (n < 1) return 'Ne puoi avere solo uno.';
  }
  if (d.missile) {
    const have = (pl.defs[id] || 0) + pl.shipQ.filter(q => q.id === id).reduce((s, q) => s + q.n, 0);
    n = Math.min(n, 5 * (pl.b.missileSilo || 0) - have); if (n < 1) return 'Silo pieno: potenzia il silo missilistico.';
  }
  const c = d.cost.map(x => x * n);
  if (!canAfford(pl, c)) return 'Risorse insufficienti.';
  pay(pl, c);
  if (!pl.shipQ.length) pl.shipT = T();
  pl.shipQ.push({ id, n });
  return null;
}
function cancelUnits(pl, idx) {
  const q = pl.shipQ[idx]; if (!q) return;
  refund(pl, DEFS[q.id].cost.map(x => x * q.n)); pl.shipQ.splice(idx, 1);
  if (!pl.shipQ.length) pl.shipT = 0; else if (idx === 0) pl.shipT = T();
}

// ---------- Flotte ----------
function shipSpeed(id) {
  const d = DEFS[id], T = G.tech;
  const bonus = d.drive === 'c' ? 0.1 * (T.combustion || 0) : d.drive === 'i' ? 0.2 * (T.impulse || 0) : 0.3 * (T.hyperDrive || 0);
  return d.speed * (1 + bonus);
}
function distance(a, b) {
  if (a.g !== b.g) return 20000 * Math.abs(a.g - b.g);
  if (a.s !== b.s) return 2700 + 95 * Math.abs(a.s - b.s);
  if (a.p !== b.p) return 1000 + 5 * Math.abs(a.p - b.p);
  return 5;
}
function flightInfo(ships, from, to, pct) {
  const ids = Object.keys(ships).filter(i => ships[i] > 0);
  if (!ids.length) return { dur: 0, fuel: 0, cap: 0, speed: 0, dist: 0 };
  const dist = distance(from, to), speed = Math.min(...ids.map(shipSpeed));
  const mult = (G.cheat && G.cheat.fleetMult) || 1;
  const dur = Math.max(500, (10 + 3500 / (pct / 100) * Math.sqrt(dist * 10 / speed)) / G.speed * 1000 / mult);
  let fuel = 0, cap = 0;
  for (const id of ids) { fuel += Math.max(1, Math.round(DEFS[id].fuel * ships[id] * dist / 35000 * Math.pow(pct / 100 + 1, 2))) ; cap += DEFS[id].cap * ships[id]; }
  return { dur, fuel, cap, speed, dist };
}
const MISSIONS = { attack: 'Attacco', transport: 'Trasporto', deploy: 'Schieramento', colonize: 'Colonizzazione', espionage: 'Spionaggio', recycle: 'Ricicla', expedition: 'Spedizione' };

function launch(pl, ships, to, mission, pct, cargo) {
  const ids = Object.keys(ships).filter(i => ships[i] > 0);
  if (!ids.length) return 'Seleziona almeno una nave.';
  for (const id of ids) { if (DEFS[id].noFly) return 'Questa nave non può volare.'; if (ships[id] > (pl.ships[id] || 0)) return 'Navi insufficienti.'; }
  if (!(to.g >= 1 && to.g <= GALAXIES && to.s >= 1 && to.s <= SYSTEMS && to.p >= 1 && to.p <= SLOTS + 1)) return 'Coordinate non valide.';
  const isExp = mission === 'expedition';
  if (isExp !== (to.p === SLOTS + 1)) return isExp ? 'Le spedizioni vanno alla posizione 16.' : 'La posizione 16 è solo per spedizioni.';
  const active = G.fleets.filter(f => (f.mission === 'expedition') === isExp).length;
  if (isExp ? active >= expeditionSlots() : G.fleets.filter(f => f.mission !== 'expedition').length >= fleetSlots())
    return isExp ? 'Nessuno slot spedizione libero (serve Astrofisica).' : 'Nessuno slot flotta libero (serve Tecnologia informatica).';
  if (!['transport', 'deploy'].includes(mission)) to.moon = false;
  const occ = occupant(to.g, to.s, to.p, to.moon);
  const mine = occ && occ.type === 'player';
  if (to.g === pl.g && to.s === pl.s && to.p === pl.p && !!to.moon === !!pl.moon) return 'Sei già lì.';
  if (mission === 'attack') { if (!occ || mine) return 'Puoi attaccare solo pianeti NPC.'; }
  else if (mission === 'espionage') { if (!occ || mine) return 'Puoi spiare solo pianeti NPC.'; if (ids.some(i => i !== 'probe')) return 'Lo spionaggio usa solo sonde.'; }
  else if (mission === 'transport' || mission === 'deploy') { if (!mine) return 'Destinazione: un tuo pianeta.'; }
  else if (mission === 'colonize') { if (occ) return 'La posizione è occupata.'; if (!ships.colonyShip) return 'Serve una nave colonia.'; if (planetCount() + G.fleets.filter(f => f.mission === 'colonize' && f.state === 'out').length >= maxPlanets()) return 'Limite di pianeti raggiunto (migliora Astrofisica).'; }
  else if (mission === 'recycle') { if (!ships.recycler) return 'Servono riciclatori.'; if (!G.debris[coordKey(to.g, to.s, to.p)]) return 'Nessun campo di detriti lì.'; }
  else if (!isExp) return 'Missione non valida.';
  if (mission === 'attack' && !ids.some(i => DEFS[i].atk > 1)) return 'Servono navi da combattimento.';
  const info = flightInfo(ships, pl, to, pct);
  cargo = cargo || [0, 0, 0];
  if (['espionage', 'recycle', 'attack', 'expedition'].includes(mission)) cargo = [0, 0, 0];
  const cargoTot = cargo[0] + cargo[1] + cargo[2];
  if (cargoTot > info.cap) return 'Carico superiore alla capacità.';
  const need = [cargo[0], cargo[1], cargo[2] + info.fuel];
  if (!canAfford(pl, need)) return `Risorse insufficienti (deuterio per il carburante: ${Math.ceil(info.fuel)}).`;
  pay(pl, need);
  for (const id of ids) pl.ships[id] -= ships[id];
  const now = T();
  G.fleets.push({ id: G.nextFleet++, mission, from: pl.id, to, ships: Object.assign({}, ships), cargo, dep: now, arr: now + info.dur, dur: info.dur, state: 'out', fuel: info.fuel });
  return null;
}
function recall(f) {
  if (f.state !== 'out') return;
  const now = T(); const el = Math.max(0, now - f.dep);
  f.state = 'back'; f.dep = now; f.arr = now + el; f.dur = el;
}
function sendBack(f, t, extraDelay) { f.state = 'back'; f.dep = t; f.arr = t + f.dur + (extraDelay || 0); }
function removeFleet(f) { G.fleets.splice(G.fleets.indexOf(f), 1); }
function addShips(pl, ships) { for (const [id, n] of Object.entries(ships)) if (n > 0) pl.ships[id] = (pl.ships[id] || 0) + n; }
const totalShips = s => Object.values(s).reduce((a, b) => a + b, 0);

function fleetArrive(f, t) {
  const origin = G.planets.find(p => p.id === f.from) || G.planets[0];
  if (f.state === 'back') {
    addShips(origin, f.ships);
    for (let i = 0; i < 3; i++) origin.res[i] += f.cargo[i];
    if (f.cargo[0] + f.cargo[1] + f.cargo[2] > 0) addMsg('fleet', 'Flotta rientrata', `<p>La flotta è tornata su <b>${origin.name}</b> con ${fmtRes(f.cargo)}.</p>`, t);
    removeFleet(f); return;
  }
  const to = f.to, label = `[${to.g}:${to.s}:${to.p}]`;
  switch (f.mission) {
    case 'transport': {
      const occ = occupant(to.g, to.s, to.p, to.moon);
      if (occ && occ.type === 'player') { for (let i = 0; i < 3; i++) occ.planet.res[i] += f.cargo[i]; addMsg('fleet', 'Trasporto consegnato', `<p>Consegnato su ${occ.planet.name} ${label}: ${fmtRes(f.cargo)}.</p>`, t); f.cargo = [0, 0, 0]; }
      sendBack(f, t); break;
    }
    case 'deploy': {
      const occ = occupant(to.g, to.s, to.p, to.moon);
      if (occ && occ.type === 'player') { addShips(occ.planet, f.ships); for (let i = 0; i < 3; i++) occ.planet.res[i] += f.cargo[i]; addMsg('fleet', 'Flotta schierata', `<p>La flotta è stata schierata su ${occ.planet.name} ${label}.</p>`, t); removeFleet(f); }
      else sendBack(f, t);
      break;
    }
    case 'colonize': {
      const occ = occupant(to.g, to.s, to.p);
      if (occ || planetCount() >= maxPlanets()) { addMsg('fleet', 'Colonizzazione fallita', `<p>Impossibile colonizzare ${label}: ${occ ? 'posizione occupata' : 'limite pianeti raggiunto'}.</p>`, t); sendBack(f, t); break; }
      const fields = Math.round(FIELDS_BY_SLOT[to.p] * rnd(0.85, 1.15));
      const pl = newPlanet('Colonia', to.g, to.s, to.p, fields, tempFor(to.p)); pl.t = t;
      for (let i = 0; i < 3; i++) pl.res[i] += f.cargo[i];
      G.planets.push(pl); f.cargo = [0, 0, 0];
      f.ships.colonyShip--; if (!f.ships.colonyShip) delete f.ships.colonyShip;
      addMsg('fleet', 'Nuova colonia!', `<p>Hai fondato <b>Colonia</b> ${label} (${fields} campi, ${pl.maxTemp}°C).</p>`, t);
      if (totalShips(f.ships) > 0) sendBack(f, t); else removeFleet(f);
      break;
    }
    case 'recycle': {
      const key = coordKey(to.g, to.s, to.p), deb = G.debris[key];
      let cap = (f.ships.recycler || 0) * DEFS.recycler.cap, gm = 0, gc = 0;
      if (deb) { gm = Math.min(deb[0], cap); cap -= gm; gc = Math.min(deb[1], cap); deb[0] -= gm; deb[1] -= gc; if (deb[0] + deb[1] < 1) delete G.debris[key]; }
      f.cargo = [gm, gc, 0];
      addMsg('fleet', 'Riciclaggio', `<p>Raccolti ${nf(gm)} metallo e ${nf(gc)} cristallo da ${label}.</p>`, t);
      sendBack(f, t); break;
    }
    case 'espionage': espionage(f, t); break;
    case 'attack': attack(f, t); break;
    case 'expedition': expedition(f, t); break;
  }
}

function espionage(f, t) {
  const to = f.to, occ = occupant(to.g, to.s, to.p);
  if (!occ || occ.type !== 'npc') { sendBack(f, t); return; }
  const npc = occ.npc; npcUpdate(npc, t);
  const probes = f.ships.probe || 0, my = G.tech.espionage || 0, th = npcTech(npc);
  const units = totalShips(npc.fleet) + totalShips(npc.def);
  const pLost = Math.min(0.9, Math.pow(2, th.espionage - my) * units / (probes * 200));
  const label = `[${to.g}:${to.s}:${to.p}]`;
  if (Math.random() < pLost) {
    addMsg('espionage', `Sonde perse su ${label}`, `<p>Il contatto con le sonde è stato perso: sono state distrutte da ${npc.name}.</p>`, t);
    removeFleet(f); return;
  }
  const x = probes + (my - th.espionage) * Math.abs(my - th.espionage);
  let h = `<p><b>${npc.name}</b> ${label} — giocatore: ${npc.owner}</p>`;
  h += `<p>Risorse: ${fmtRes(npc.res.map(Math.floor))}</p>`;
  if (x >= 2) h += `<p>Flotta: ${listUnits(npc.fleet)}</p>`;
  if (x >= 3) h += `<p>Difese: ${listUnits(npc.def)}</p>`;
  if (x >= 4) h += `<p>Stile: ${NPC_STYLES[npc.style].name} — ${NPC_SKILLS[npc.skill].name}</p>`;
  if (x >= 5) h += `<p>Ricerche: armi ${th.weapons}, scudi ${th.shield}, corazza ${th.armour}, spionaggio ${th.espionage}</p>`;
  const pw = stockValue(npc.fleet) + stockValue(npc.def);
  h += `<p>Probabilità di perdita sonde: ${(pLost * 100).toFixed(0)}% — Valore difensivo ≈ ${nf(pw / 1000)}k</p>`;
  addMsg('espionage', `Rapporto spionaggio ${label}`, h, t);
  sendBack(f, t);
}

function attack(f, t) {
  const to = f.to, occ = occupant(to.g, to.s, to.p), label = `[${to.g}:${to.s}:${to.p}]`;
  if (!occ || occ.type !== 'npc') { sendBack(f, t); return; }
  const npc = occ.npc; npcUpdate(npc, t);
  const res = battle({ ships: f.ships, tech: G.tech }, { ships: npc.fleet, defs: npc.def, tech: npcTech(npc) });
  f.ships = res.a.after; npc.fleet = res.d.afterShips; npc.def = res.d.afterDefs;
  let loot = [0, 0, 0];
  if (res.winner === 'a') {
    let cap = Object.entries(f.ships).reduce((s, [id, n]) => s + DEFS[id].cap * n, 0);
    const half = npc.res.map(v => v / 2);
    const m = Math.min(half[0], cap / 3); cap -= m;
    const c = Math.min(half[1], cap / 2); cap -= c;
    const d = Math.min(half[2], cap); cap -= d;
    const m2 = Math.min(half[0] - m, cap); cap -= m2;
    const c2 = Math.min(half[1] - c, cap);
    loot = [m + m2, c + c2, d].map(Math.floor);
    for (let i = 0; i < 3; i++) npc.res[i] -= loot[i];
    f.cargo = loot;
  }
  if (res.debris[0] + res.debris[1] >= 1) { const k = coordKey(to.g, to.s, to.p); const cur = G.debris[k] || [0, 0]; G.debris[k] = [cur[0] + res.debris[0], cur[1] + res.debris[1]]; }
  const origin = G.planets.find(p => p.id === f.from);
  const moonMsg = origin && !origin.moon ? maybeMoon(origin, res.debris[0] + res.debris[1], t) : '';
  const verdict = res.winner === 'a' ? '<b class="ok">Vittoria!</b>' : res.winner === 'd' ? '<b class="bad">Sconfitta.</b>' : '<b>Pareggio.</b>';
  let h = `<p>${verdict} Battaglia su <b>${npc.name}</b> ${label} in ${res.rounds} round.</p>`;
  h += `<table class="rep"><tr><th></th><th>Tu (attaccante)</th><th>${npc.owner} (difensore)</th></tr>`;
  h += `<tr><td>Prima</td><td>${listUnits(res.a.before)}</td><td>${listUnits(Object.assign({}, res.d.beforeShips, res.d.beforeDefs))}</td></tr>`;
  h += `<tr><td>Perdite</td><td>${listUnits(res.a.lost)}</td><td>${listUnits(res.d.lost)}</td></tr>`;
  h += `<tr><td>Dopo</td><td>${listUnits(res.a.after)}</td><td>${listUnits(Object.assign({}, res.d.afterShips, res.d.afterDefs))}</td></tr></table>`;
  if (res.d.rebuilt) h += `<p>Difese ricostruite dal nemico: ${res.d.rebuilt}.</p>`;
  if (res.winner === 'a') h += `<p>Bottino: ${fmtRes(loot)}.</p>`;
  h += `<p>Campo di detriti: ${nf(res.debris[0])} metallo, ${nf(res.debris[1])} cristallo.</p>`;
  h += moonMsg;
  addMsg('battle', `Battaglia ${label} — ${res.winner === 'a' ? 'vittoria' : res.winner === 'd' ? 'sconfitta' : 'pareggio'}`, h, t);
  if (totalShips(f.ships) > 0) sendBack(f, t); else removeFleet(f);
}

function expedition(f, t) {
  const r = Math.random(), label = `[${f.to.g}:${f.to.s}:${f.to.p}]`;
  const cap = Object.entries(f.ships).reduce((s, [id, n]) => s + DEFS[id].cap * n, 0);
  const hold = HOUR / G.speed;
  let title = 'Spedizione', body = '', delay = hold;
  if (r < 0.35) body = 'La flotta ha vagato nel vuoto senza trovare nulla di interessante.';
  else if (r < 0.62) {
    const size = Math.min(cap, 30000 * (1 + (G.tech.astro || 0) * 0.25)) * rnd(0.3, 1);
    const k = rint(0, 2), mult = [1, 0.66, 0.4][k];
    const gain = [0, 0, 0]; gain[k] = Math.floor(size * mult); f.cargo = f.cargo.map((v, i) => v + gain[i]);
    body = `Un relitto abbandonato! Recuperati ${fmtRes(gain)}.`;
  } else if (r < 0.74) {
    const pool = ['probe', 'smallCargo', 'lightFighter', 'heavyFighter', 'largeCargo', 'cruiser'].filter(i => meets(G.planets[0], i) || i === 'probe' || i === 'smallCargo' || i === 'lightFighter');
    const found = {}; const kinds = rint(1, 2);
    for (let i = 0; i < kinds; i++) { const id = pool[rint(0, Math.min(pool.length - 1, 3))]; found[id] = (found[id] || 0) + rint(1, Math.max(2, Math.ceil(totalShips(f.ships) / 8))); }
    for (const [id, n] of Object.entries(found)) f.ships[id] = (f.ships[id] || 0) + n;
    body = `Navi alla deriva si sono unite alla flotta: ${listUnits(found)}.`;
  } else if (r < 0.84) { delay = hold + f.dur * 0.5; body = 'Una tempesta di particelle ha rallentato il rientro della flotta.'; }
  else if (r < 0.93) {
    const frac = rnd(0.1, 0.4), lost = {};
    for (const [id, n] of Object.entries(f.ships)) { const l = Math.floor(n * frac); if (l > 0) { lost[id] = l; f.ships[id] -= l; if (!f.ships[id]) delete f.ships[id]; } }
    body = `Pirati! Perdite: ${listUnits(lost)}.`;
  } else if (r < 0.97) { addMsg('fleet', `Spedizione ${label}: flotta perduta`, '<p>Un buco nero ha inghiottito la flotta. Nessuna comunicazione da allora.</p>', t); removeFleet(f); return; }
  else body = 'Un portale ha accelerato il viaggio: rientro immediato.', delay = 0;
  addMsg('fleet', `Spedizione ${label}`, `<p>${body}</p>`, t);
  if (totalShips(f.ships) > 0) sendBack(f, t, delay); else removeFleet(f);
}

// ---------- Combattimento ----------
function battle(A, D) {
  const typeIds = [...IDS.s.filter(i => !DEFS[i].noFly || i === 'solarSat'), ...IDS.d];
  const tIdx = {}; typeIds.forEach((id, i) => tIdx[id] = i);
  const mk = (src, tech) => {
    const w = 1 + 0.1 * (tech.weapons || 0), s = 1 + 0.1 * (tech.shield || 0), a = 1 + 0.1 * (tech.armour || 0);
    const units = [];
    for (const [id, n] of Object.entries(src)) for (let i = 0; i < n; i++)
      units.push({ t: id, h: DEFS[id].hull * a, mh: DEFS[id].hull * a, s: DEFS[id].shield * s, ms: DEFS[id].shield * s, atk: DEFS[id].atk * w });
    return units;
  };
  const aShips = Object.assign({}, A.ships), dAll = Object.assign({}, D.ships, D.defs);
  const aBefore = Object.assign({}, aShips), dBeforeS = Object.assign({}, D.ships), dBeforeD = Object.assign({}, D.defs);
  let au = mk(aShips, A.tech), du = mk(dAll, D.tech), rounds = 0;
  const fire = (shooters, targets) => {
    const n = targets.length;
    for (const u of shooters) {
      const rf = RF[u.t] || {};
      for (; ;) {
        const tg = targets[(Math.random() * n) | 0];
        if (tg.h > 0) {
          if (u.atk >= 0.01 * tg.ms) {
            if (tg.s >= u.atk) tg.s -= u.atk;
            else { const rem = u.atk - tg.s; tg.s = 0; tg.h -= rem; }
            if (tg.h > 0 && tg.h < 0.7 * tg.mh && Math.random() < 1 - tg.h / tg.mh) tg.h = 0;
          }
        }
        const r = rf[tg.t];
        if (!(r && Math.random() < (r - 1) / r)) break;
      }
    }
  };
  while (rounds < 6 && au.length && du.length) {
    rounds++;
    fire(au, du); fire(du, au);
    au = au.filter(u => u.h > 0); du = du.filter(u => u.h > 0);
    for (const u of au) u.s = u.ms; for (const u of du) u.s = u.ms;
  }
  const count = units => { const o = {}; for (const u of units) o[u.t] = (o[u.t] || 0) + 1; return o; };
  const aAfter = count(au), dAfterAll = count(du);
  const lost = (before, after) => { const o = {}; for (const [id, n] of Object.entries(before)) { const l = n - (after[id] || 0); if (l > 0) o[id] = l; } return o; };
  const aLost = lost(aBefore, aAfter), dLostAll = lost(dAll, dAfterAll);
  // debris: 30% del costo (metallo+cristallo) delle sole navi perse
  const debris = [0, 0];
  for (const lst of [aLost, dLostAll]) for (const [id, n] of Object.entries(lst)) if (DEFS[id].type === 's') { debris[0] += DEFS[id].cost[0] * n * 0.3; debris[1] += DEFS[id].cost[1] * n * 0.3; }
  debris[0] = Math.floor(debris[0]); debris[1] = Math.floor(debris[1]);
  // 70% delle difese distrutte viene ricostruito
  let rebuilt = 0; const afterDefs = {}, afterShips = {};
  for (const [id, n] of Object.entries(dAfterAll)) (DEFS[id].type === 'd' ? afterDefs : afterShips)[id] = n;
  for (const [id, n] of Object.entries(dLostAll)) if (DEFS[id].type === 'd') {
    let k = 0; if (n < 400) { for (let i = 0; i < n; i++) if (Math.random() < 0.7) k++; } else k = Math.round(n * 0.7 + (Math.random() - 0.5) * Math.sqrt(n * 0.21) * 2);
    if (k > 0) { afterDefs[id] = (afterDefs[id] || 0) + k; rebuilt += k; }
  }
  const winner = !du.length && au.length ? 'a' : !au.length && du.length ? 'd' : 'draw';
  return { rounds, winner, debris, a: { before: aBefore, after: aAfter, lost: aLost }, d: { beforeShips: dBeforeS, beforeDefs: dBeforeD, afterShips, afterDefs, lost: dLostAll, rebuilt } };
}

// ---------- Formattazione condivisa ----------
const nf = n => Math.floor(n).toLocaleString('it-IT');
const fmtRes = r => `<span class="rm">${nf(r[0])} M</span> <span class="rc">${nf(r[1])} C</span> <span class="rd">${nf(r[2])} D</span>`;
const listUnits = u => { const e = Object.entries(u || {}).filter(([, n]) => n > 0); return e.length ? e.map(([id, n]) => `${DEFS[id].name}: ${nf(n)}`).join('<br>') : '—'; };

// ---------- Missili interplanetari ----------
const MISSILE_ORDER = ['rocket', 'lightLaser', 'heavyLaser', 'gauss', 'ion', 'plasma', 'smallDome', 'largeDome'];
const missileRange = () => Math.max(0, 2 * (G.tech.impulse || 0) - 1);
function launchMissiles(pl, n, to, primary) {
  n = Math.floor(n);
  if (!(G.tech.impulse >= 1)) return 'Serve il propulsore a impulso.';
  if (!(n >= 1) || n > (pl.defs.ipm || 0)) return 'Missili insufficienti.';
  const occ = occupant(to.g, to.s, to.p);
  if (!occ || occ.type !== 'npc') return 'Bersaglio non valido.';
  const dist = Math.abs(to.s - pl.s);
  if (to.g !== pl.g || dist > missileRange()) return `Fuori portata (raggio ${missileRange()} sistemi, stessa galassia).`;
  pl.defs.ipm -= n;
  const now = T(), dur = (30 + 60 * dist) * 1000 / G.speed;
  G.missiles.push({ id: G.nextFleet++, from: pl.id, to: { g: to.g, s: to.s, p: to.p }, n, primary, dep: now, arr: now + dur });
  return null;
}
function missileArrive(m, t) {
  G.missiles.splice(G.missiles.indexOf(m), 1);
  const to = m.to, label = `[${to.g}:${to.s}:${to.p}]`, occ = occupant(to.g, to.s, to.p);
  if (!occ || occ.type !== 'npc') return;
  const npc = occ.npc; npcUpdate(npc, t);
  const th = npcTech(npc);
  let pool = m.n * DEFS.ipm.atk * (1 + 0.1 * (G.tech.weapons || 0));
  const order = [m.primary, ...MISSILE_ORDER.filter(i => i !== m.primary)].filter(i => i && DEFS[i]);
  const killed = {};
  for (const id of order) {
    const have = npc.def[id] || 0; if (!have) continue;
    const hull = DEFS[id].hull * (1 + 0.1 * th.armour), k = Math.min(have, Math.floor(pool / hull));
    if (k > 0) { npc.def[id] -= k; pool -= k * hull; killed[id] = k; if (!npc.def[id]) delete npc.def[id]; }
  }
  addMsg('battle', `Attacco missilistico ${label}`, `<p>${m.n} missili hanno colpito <b>${npc.name}</b> ${label}.</p><p>Difese distrutte:<br>${listUnits(killed)}</p><p>Difese rimaste:<br>${listUnits(npc.def)}</p>`, t);
}

// ---------- Falange dei sensori ----------
function hash3(a, b, c) { let h = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
// Traffico simulato: gli NPC non volano davvero, ma la falange ne mostra i movimenti generati in modo deterministico.
function npcMoves(npc, now) {
  const unit = Math.max(HOUR / G.speed, turnMs()), P = 2 * unit, out = [], k0 = Math.floor(now / P);
  const kinds = ['transport', 'attack', 'expedition', 'espionage', 'transport'];
  for (let k = k0 - 8; k <= k0; k++) {
    const r = mulberry32(hash3(npc.g * 1000 + npc.s, npc.p, k));
    if (r() > 0.5) continue;
    const mission = kinds[Math.floor(r() * kinds.length)], start = k * P + r() * P, dur = (0.5 + r() * 1.5) * unit;
    const hold = mission === 'expedition' ? unit : 0;
    if (now < start || now >= start + 2 * dur + hold) continue;
    const to = mission === 'expedition' ? { g: npc.g, s: npc.s, p: SLOTS + 1 } : { g: npc.g, s: Math.min(SYSTEMS, Math.max(1, npc.s + Math.floor(r() * 17) - 8)), p: 1 + Math.floor(r() * SLOTS) };
    const ships = {};
    for (const [id, n] of Object.entries(npc.fleet)) { const c = Math.floor(n * r() * 0.3); if (c > 0 && !DEFS[id].noFly) ships[id] = c; }
    if (!Object.keys(ships).length) continue;
    const state = now < start + dur ? 'out' : now < start + dur + hold ? 'hold' : 'back';
    out.push({ mission, to, ships, state, arr: state === 'out' ? start + dur : state === 'hold' ? start + dur + hold : start + 2 * dur + hold });
  }
  return out;
}
const phalanxRange = pl => Math.max(0, (pl.b.phalanx || 0) ** 2 - 1);
function scan(pl, g, s, p) {
  if (!pl.moon || !(pl.b.phalanx > 0)) return 'Serve una luna con falange dei sensori.';
  if (g !== pl.g || Math.abs(s - pl.s) > phalanxRange(pl)) return `Fuori portata (raggio ${phalanxRange(pl)} sistemi, stessa galassia).`;
  const occ = occupant(g, s, p);
  if (!occ || occ.type !== 'npc') return 'Puoi scansionare solo pianeti NPC.';
  if (pl.res[2] < 5000) return 'Servono 5.000 deuterio.';
  pl.res[2] -= 5000;
  const now = T(), n0 = occ.npc, label0 = null;
  const real = G.raids.filter(r => r.from.g === g && r.from.s === s && r.from.p === p).map(r => ({ mission: 'attack', to: r.to, ships: r.ships, state: r.state, arr: r.arr, real: true }));
  const mv = real.concat(npcMoves(occ.npc, now)), label = `[${g}:${s}:${p}]`;
  let h = `<p>Scansione di <b>${occ.npc.name}</b> ${label}</p>`;
  if (!mv.length) h += '<p>Nessun movimento di flotta rilevato.</p>';
  else h += '<table class="rep"><tr><th>Missione</th><th>Destinazione</th><th>Navi</th><th>Stato</th></tr>' + mv.map(m =>
    `<tr><td>${MISSIONS[m.mission]}${m.real ? ' ⚔️' : ''}</td><td>[${m.to.g}:${m.to.s}:${m.to.p}]</td><td>${listUnits(m.ships)}</td><td>${m.state === 'out' ? 'in andata' : m.state === 'hold' ? 'in esplorazione' : 'in ritorno'}, ${turnsText(m.arr - now)}</td></tr>`).join('') + '</table>';
  h += '<p class="muted">Gli attacchi segnalati come reali sono flotte vere; il resto è traffico di fondo simulato.</p>';
  addMsg('espionage', `Scansione falange ${label}`, h);
  return null;
}

// ---------- Porta di salto ----------
function jump(pl, destId, ships) {
  const dest = G.planets.find(p => p.id === destId), now = T();
  if (!pl.moon || !dest || !dest.moon || dest === pl) return "Scegli un'altra luna di destinazione.";
  if (!(pl.b.jumpGate > 0) || !(dest.b.jumpGate > 0)) return 'Entrambe le lune devono avere la porta di salto.';
  if ((pl.gateT || 0) > now || (dest.gateT || 0) > now) return 'Porta di salto in ricarica.';
  const ids = Object.keys(ships).filter(i => ships[i] > 0);
  if (!ids.length) return 'Seleziona delle navi.';
  for (const id of ids) if (DEFS[id].noFly || ships[id] > (pl.ships[id] || 0)) return 'Navi non valide.';
  for (const id of ids) pl.ships[id] -= ships[id];
  addShips(dest, ships);
  pl.gateT = dest.gateT = now + HOUR / G.speed;
  return null;
}

// ---------- Impostazioni NPC, raid e notizie ----------
const AGGR = {
  1: { p: 0.04, range: 10, ratio: 1.5, cd: [36, 96], hold: 72 },
  2: { p: 0.08, range: 15, ratio: 1.2, cd: [18, 60], hold: 36 },
  3: { p: 0.15, range: 25, ratio: 0.9, cd: [8, 30], hold: 14 },
};
const PROTECT_POINTS = 50;
function addNews(text, t) { G.news.unshift({ t: t || T(), turn: turnAt(t || T()), text }); if (G.news.length > 40) G.news.length = 40; }
function npcAt(c) { const o = occupant(c.g, c.s, c.p); return o && o.type === 'npc' ? o.npc : null; }
function calcLoot(store, ships) {
  let cap = Object.entries(ships).reduce((s, [id, n]) => s + DEFS[id].cap * n, 0);
  const half = store.map(v => v / 2);
  const m = Math.min(half[0], cap / 3); cap -= m;
  const c = Math.min(half[1], cap / 2); cap -= c;
  const d = Math.min(half[2], cap); cap -= d;
  const m2 = Math.min(half[0] - m, cap); cap -= m2;
  const c2 = Math.min(half[1] - c, cap);
  return [m + m2, c + c2, d].map(Math.floor);
}
function maybeMoon(pl, dsum, t) {
  if (dsum < 100000 || pl.moon || G.planets.some(p => p.moon && p.parent === pl.id) || Math.random() >= Math.min(0.2, Math.floor(dsum / 100000) / 100)) return '';
  const mn = newPlanet('Luna di ' + pl.name, pl.g, pl.s, pl.p, 1, pl.maxTemp);
  mn.moon = true; mn.parent = pl.id; mn.res = [0, 0, 0]; mn.t = t; G.planets.push(mn);
  return `<p>🌙 Dai detriti si è formata una <b>luna</b> attorno a ${pl.name}!</p>`;
}
function addDebris(c, d, t) { if (d[0] + d[1] < 1) return; const k = coordKey(c.g, c.s, c.p), cur = G.debris[k] || [0, 0]; G.debris[k] = [cur[0] + d[0], cur[1] + d[1]]; }
function battleHtml(res, aName, dName, loot) {
  let h = `<table class="rep"><tr><th></th><th>${aName} (attaccante)</th><th>${dName} (difensore)</th></tr>`;
  h += `<tr><td>Prima</td><td>${listUnits(res.a.before)}</td><td>${listUnits(Object.assign({}, res.d.beforeShips, res.d.beforeDefs))}</td></tr>`;
  h += `<tr><td>Perdite</td><td>${listUnits(res.a.lost)}</td><td>${listUnits(res.d.lost)}</td></tr>`;
  h += `<tr><td>Dopo</td><td>${listUnits(res.a.after)}</td><td>${listUnits(Object.assign({}, res.d.afterShips, res.d.afterDefs))}</td></tr></table>`;
  if (res.d.rebuilt) h += `<p>Difese ricostruite: ${res.d.rebuilt}.</p>`;
  if (loot && loot.some(v => v)) h += `<p>Bottino: ${fmtRes(loot)}.</p>`;
  return h + `<p>Campo di detriti: ${nf(res.debris[0])} metallo, ${nf(res.debris[1])} cristallo.</p>`;
}

// Fine turno: gli NPC pronti valutano se e chi attaccare (gli aggressivi spesso, i difensivi quasi mai).
function npcTick(tk) {
  const o = G.opts, A = AGGR[o.npcAggr];
  if (!A || !(o.hitPlayer || o.hitNpc)) return;
  let pp = null;
  const looks = Math.max(1, turnMs() * G.speed / (2 * HOUR)); // un turno lungo equivale a più occasioni di attacco
  for (const npc of G.npcs) {
    const sk = NPC_SKILLS[npc.skill], pr = Math.min(0.95, 1 - Math.pow(1 - Math.min(0.95, A.p * NPC_STYLES[npc.style].raid), looks));
    if ((npc.nextRaid || 0) > tk || Math.random() > pr) continue;
    const wait = h => npc.nextRaid = tk + h * HOUR / G.speed;
    const ships = {};
    for (const [id, n] of Object.entries(npc.fleet)) { const d = DEFS[id]; if (n > 0 && !d.noFly && id !== 'probe' && id !== 'colonyShip' && id !== 'recycler') ships[id] = n; }
    const power = Object.entries(ships).reduce((s, [id, n]) => s + (DEFS[id].atk > 1 ? n * (DEFS[id].cost[0] + DEFS[id].cost[1] + DEFS[id].cost[2]) : 0), 0);
    if (power < 50000) { wait(6); continue; }
    let best = null, bestScore = 0;
    const consider = (def, loot, target) => { if (loot < 5000 || power < A.ratio * sk.ratio * def) return; const sc = loot / (1 + def); if (sc > bestScore) { bestScore = sc; best = target; } };
    if (o.hitPlayer && (!o.protect || (pp === null ? (pp = playerPoints()) : pp) >= PROTECT_POINTS))
      for (const pl of G.planets) if (pl.g === npc.g && Math.abs(pl.s - npc.s) <= A.range && (pl.hitUntil || 0) <= tk)
        consider(stockValue(pl.ships) + stockValue(pl.defs), (pl.res[0] + pl.res[1] + pl.res[2]) / 2, { tp: 'player', pid: pl.id, g: pl.g, s: pl.s, p: pl.p });
    if (o.hitNpc)
      for (const n of G.npcs) if (n !== npc && n.g === npc.g && Math.abs(n.s - npc.s) <= A.range && (n.hitUntil || 0) <= tk)
        consider(stockValue(n.fleet) + stockValue(n.def), (n.res[0] + n.res[1] + n.res[2]) / 2, { tp: 'npc', g: n.g, s: n.s, p: n.p });
    if (!best) { wait(8); continue; }
    const from = { g: npc.g, s: npc.s, p: npc.p };
    const speed = Math.min(...Object.keys(ships).map(i => DEFS[i].speed)) * (1 + 0.1 * Math.min(10, Math.floor(npc.age / 30)));
    const dist = distance(from, best), dur = (10 + 3500 * Math.sqrt(dist * 10 / speed)) / G.speed * 1000;
    for (const [id, n] of Object.entries(ships)) { npc.fleet[id] -= n; if (!npc.fleet[id]) delete npc.fleet[id]; }
    const r = { id: G.nextFleet++, from, owner: npc.owner, to: { g: best.g, s: best.s, p: best.p }, tp: best.tp, pid: best.pid, ships, cargo: [0, 0, 0], dep: tk, arr: tk + dur, dur, state: 'out' };
    G.raids.push(r);
    const victim = best.tp === 'player' ? G.planets.find(p => p.id === best.pid) : npcAt(best);
    victim.hitUntil = tk + dur + A.hold * HOUR / G.speed;
    wait(rnd(A.cd[0], A.cd[1]));
    if (best.tp === 'player') {
      const pl = G.planets.find(p => p.id === best.pid);
      addMsg('battle', `⚠️ Flotta ostile in arrivo su ${pl.name}`, `<p>La flotta di <b>${npc.owner}</b> da [${from.g}:${from.s}:${from.p}] sta per colpire <b>${pl.name}</b> [${pl.g}:${pl.s}:${pl.p}]. Arrivo entro ${turnsText(dur)}. Rinforza le difese o sposta le risorse.</p>`, tk);
    }
  }
}

function raidArrive(r, t) {
  const att = npcAt(r.from);
  if (r.state === 'back') {
    if (att) { addShips2(att.fleet, r.ships); for (let i = 0; i < 3; i++) att.res[i] += r.cargo[i]; }
    G.raids.splice(G.raids.indexOf(r), 1); return;
  }
  const res0 = () => { r.state = 'back'; r.dep = t; r.arr = t + r.dur; };
  if (r.tp === 'player') {
    const pl = G.planets.find(p => p.id === r.pid);
    if (!pl) { res0(); return; }
    updateShipQueue(pl, t);
    const defs = Object.assign({}, pl.defs), ipm = defs.ipm || 0; delete defs.ipm;
    const res = battle({ ships: r.ships, tech: att ? npcTech(att) : {} }, { ships: Object.assign({}, pl.ships), defs, tech: G.tech });
    r.ships = res.a.after; pl.ships = res.d.afterShips; pl.defs = res.d.afterDefs; if (ipm) pl.defs.ipm = ipm;
    let loot = [0, 0, 0];
    if (res.winner === 'a') { loot = calcLoot(pl.res, r.ships); for (let i = 0; i < 3; i++) pl.res[i] -= loot[i]; r.cargo = loot; }
    addDebris(r.to, res.debris, t);
    const moon = maybeMoon(pl, res.debris[0] + res.debris[1], t);
    const verdict = res.winner === 'd' ? '<b class="ok">Hai respinto l\'attacco.</b>' : res.winner === 'a' ? '<b class="bad">Sei stato saccheggiato!</b>' : '<b>Battaglia in parità.</b>';
    addMsg('battle', `⚠️ Attaccato da ${r.owner} — ${res.winner === 'd' ? 'respinto' : res.winner === 'a' ? 'sconfitta' : 'pareggio'}`,
      `<p>${verdict} ${r.owner} ha attaccato <b>${pl.name}</b> [${pl.g}:${pl.s}:${pl.p}] in ${res.rounds} round.</p>` + battleHtml(res, r.owner, 'Tu', loot) + moon, t);
    addNews(`${r.owner} ha attaccato ${G.name} su ${pl.name} (${res.winner === 'a' ? 'vittoria' : res.winner === 'd' ? 'respinto' : 'pareggio'}).`, t);
  } else {
    const tn = npcAt(r.to);
    if (!tn) { res0(); return; }
    npcUpdate(tn, t);
    const res = battle({ ships: r.ships, tech: att ? npcTech(att) : {} }, { ships: tn.fleet, defs: tn.def, tech: npcTech(tn) });
    r.ships = res.a.after; tn.fleet = res.d.afterShips; tn.def = res.d.afterDefs;
    if (res.winner === 'a') { const loot = calcLoot(tn.res, r.ships); for (let i = 0; i < 3; i++) tn.res[i] -= loot[i]; r.cargo = loot; }
    addDebris(r.to, res.debris, t);
    addNews(`${r.owner} ha attaccato ${tn.owner} su [${r.to.g}:${r.to.s}:${r.to.p}] (${res.winner === 'a' ? 'vittoria' : res.winner === 'd' ? 'respinto' : 'pareggio'}).`, t);
  }
  if (totalShips(r.ships) > 0) res0(); else G.raids.splice(G.raids.indexOf(r), 1);
}
function addShips2(store, ships) { for (const [id, n] of Object.entries(ships)) if (n > 0) store[id] = (store[id] || 0) + n; }

// ---------- Cheat ----------
function cheatRes(pl, which, amount) { const list = which === 'all' ? [0, 1, 2] : [which]; for (const i of list) pl.res[i] += amount; }
function cheatTime(pl, turns, kind) {
  const ms = turns * turnMs(), now = T();
  if (kind === 'b') { if (pl.buildQ) pl.buildQ.end = Math.max(now, pl.buildQ.end - ms); if (pl.shipQ.length) pl.shipT -= ms; }
  else if (G.researchQ) G.researchQ.end = Math.max(now, G.researchQ.end - ms);
}
function cheatNpc(points, g, s, p, style, skill) {
  if (!(g >= 1 && g <= GALAXIES && s >= 1 && s <= SYSTEMS && p >= 1 && p <= SLOTS)) return 'Coordinate non valide.';
  if (occupant(g, s, p, false)) return 'Posizione già occupata.';
  if (!NPC_STYLES[style]) style = randKey(NPC_STYLES);
  if (!NPC_SKILLS[skill]) skill = randKey(NPC_SKILLS);
  const st = NPC_STYLES[style];
  const P = Math.max(1, points) * 1000, age = Math.min(250, 20 + Math.sqrt(P / 1000) * 6);
  const rate0 = Math.max(60, P * st.eco0 / 4);
  const npc = { name: randName() + ' ' + (['Prime', 'Nova', 'Station', 'Colony', 'Outpost'][rint(0, 4)]), owner: randName(), g, s, p, style, skill, rate0, rate: rate0, age, res: [rate0 * 6, rate0 * 3, rate0 * 1.5], bank: [0, 0, 0], fleet: {}, def: {} };
  let budget = P - rate0 * 4 - age * 300;
  const share = st.def / (st.def + st.fleet);
  for (let i = 0; i < 60 && budget > 500; i++) {
    const kind = Math.random() < share ? 'def' : 'fleet', cand = npcCands(npc, kind);
    if (!cand.length) continue;
    const id = cand[rint(0, cand.length - 1)], c = DEFS[id].cost[0] + DEFS[id].cost[1] + DEFS[id].cost[2];
    const n = Math.floor(Math.min(budget, Math.max(budget / 6, c)) / c);
    if (n < 1) continue;
    const store = DEFS[id].type === 'd' ? npc.def : npc.fleet;
    store[id] = (store[id] || 0) + n; budget -= n * c;
  }
  G.npcs.push(npc);
  return null;
}
function cheatFields(pl, total) {
  const bonus = 5 * (pl.b.terraformer || 0) + 3 * (pl.b.lunarBase || 0);
  pl.fields = Math.max(0, Math.floor(total) - bonus);
}
