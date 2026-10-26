// Interfaccia: viste, azioni, ciclo di aggiornamento.
const $ = s => document.querySelector(s);
const cur = () => G.planets.find(p => p.id === G.cur) || G.planets[0];
let view = 'overview';
let GV = { g: 1, s: 1 };
let FL = { g: 1, s: 1, p: 1, moon: false, mission: 'attack', pct: 100, cargo: [0, 0, 0], sel: {} };
let spyN = 3;
const SELV = {};

// Durate in turni; tra parentesi il tempo di universo che corrisponde.
function dur(ms) {
  if (ms <= 0) return 'completato';
  const t = Math.max(1, Math.ceil(ms / 1000)), d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  const exact = (d ? d + 'g ' : '') + (d || h ? h + 'h ' : '') + (d || h || m ? m + 'm' : s + 's');
  return `${turnsText(ms)} (${exact.trim()})`;
}
const cd = end => `<span class="cd" data-end="${end}">${dur(end - T())}</span>`;
const prog = (s, e) => `<div class="prog"><i data-s="${s}" data-e="${e}"></i></div>`;
const clock = (t, turn) => 'Turno ' + (turn || turnAt(t));
const panel = (title, body, cls) => `<section class="panel ${cls || ''}"><h2 class="ph">${title}</h2><div class="pb">${body}</div></section>`;
const RK = ['m', 'c', 'd'], RN = ['Metallo', 'Cristallo', 'Deuterio'];
function costItems(c, pl) {
  return `<div class="costs">` + c.map((v, i) => v > 0 ? `<span class="cost${pl && pl.res[i] < v ? ' short' : ''}" title="${RN[i]}">${RES_ICON[RK[i]]}<b>${nf(v)}</b></span>` : '').join('') + '</div>';
}
function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = err ? 'err show' : 'show';
  clearTimeout(toast.h); toast.h = setTimeout(() => t.className = '', 3500);
}
function done(err) { if (err) toast(err, true); save(); render(); }

// ---------- Azioni (chiamate dall'HTML) ----------
const act = {
  build: id => done(startBuild(cur(), id)),
  cancelBuild: () => { cancelBuild(cur()); done(); },
  research: id => done(startResearch(cur(), id)),
  cancelResearch: () => { cancelResearch(); done(); },
  units: id => { const el = $('#q_' + id); done(queueUnits(cur(), id, parseInt(el.value) || 0)); },
  maxUnits: id => {
    const pl = cur(), c = DEFS[id].cost; let n = Infinity;
    for (let i = 0; i < 3; i++) if (c[i] > 0) n = Math.min(n, Math.floor(pl.res[i] / c[i]));
    if (DEFS[id].max) n = Math.min(n, 1);
    $('#q_' + id).value = isFinite(n) ? n : 0;
  },
  cancelUnits: i => { cancelUnits(cur(), i); done(); },
  pct: (id, v) => { cur().pct[id] = parseInt(v); save(); render(); },
  planet: id => { G.cur = parseInt(id); render(); },
  recall: id => { const f = G.fleets.find(x => x.id === id); if (f) recall(f); done(); },
  nav: v => { view = v; if (v === 'messages') { G.messages.forEach(m => m.read = true); G.unread = 0; } render(); window.scrollTo(0, 0); },
};
function go(v) { act.nav(v); }
function selItem(id) { SELV[view] = id; render(); }

// ---------- Code ----------
function queueBox(pl, kinds) {
  let rows = '';
  if (pl.buildQ && kinds.includes('b')) { const q = pl.buildQ; rows += `<div class="qrow">${icon(q.id, 'm')}<div><b>${DEFS[q.id].name}</b> · livello ${q.level}${prog(q.start, q.end)}${cd(q.end)}</div><button class="mini" onclick="act.cancelBuild()">Annulla</button></div>`; }
  if (G.researchQ && kinds.includes('t')) { const q = G.researchQ; rows += `<div class="qrow">${icon(q.id, 'm')}<div><b>${DEFS[q.id].name}</b> · livello ${q.level}${prog(q.start, q.end)}${cd(q.end)}</div><button class="mini" onclick="act.cancelResearch()">Annulla</button></div>`; }
  if (pl.shipQ.length && kinds.includes('s')) {
    rows += pl.shipQ.map((q, i) => { const ut = unitTime(pl, q.id); return `<div class="qrow">${icon(q.id, 'm')}<div><b>${nf(q.n)} × ${DEFS[q.id].name}</b>${i === 0 ? prog(pl.shipT, pl.shipT + ut) + 'prossima unità ' + cd(pl.shipT + ut) : ''}</div><button class="mini" onclick="act.cancelUnits(${i})">Annulla</button></div>`; }).join('');
  }
  return rows ? panel('In corso', rows) : '';
}

// ---------- Griglia di tessere + dettaglio ----------
const here = (id, pl) => { const w = DEFS[id].where; return !w || (w === 'm') === !!pl.moon; };
function tileState(id, pl) {
  const d = DEFS[id];
  if (!meets(pl, id)) return 'locked';
  if ((d.type === 'b' && pl.buildQ && pl.buildQ.id === id) || (d.type === 't' && G.researchQ && G.researchQ.id === id)) return 'busy';
  if (d.type === 'b' || d.type === 't') return canAfford(pl, costOf(id, lvlOf(pl, id) + 1)) && !(d.type === 'b' ? pl.buildQ : G.researchQ) ? 'can' : 'cant';
  return canAfford(pl, d.cost) ? 'can' : 'cant';
}
function haveOf(id, pl) { const t = DEFS[id].type; return t === 'd' ? pl.defs[id] || 0 : t === 's' ? pl.ships[id] || 0 : lvlOf(pl, id); }
function tile(id, pl, sel) {
  const n = haveOf(id, pl);
  return `<div class="tile ${tileState(id, pl)}${id === sel ? ' sel' : ''}" title="${DEFS[id].name}" onclick="selItem('${id}')">${icon(id)}${n ? `<span class="lv">${nf(n)}</span>` : ''}</div>`;
}
function effectText(id, pl, lvl) {
  const S = G.speed, e = l => l * Math.pow(1.1, l), plasma = G.tech.plasmaTech || 0;
  const f = { metalMine: l => 30 * e(l) * S * (1 + 0.01 * plasma), crystalMine: l => 20 * e(l) * S * (1 + 0.0066 * plasma), deutSynth: l => 10 * e(l) * S * (1.44 - 0.004 * pl.maxTemp) * (1 + 0.0033 * plasma) }[id];
  const en = { metalMine: l => 10 * e(l), crystalMine: l => 10 * e(l), deutSynth: l => 20 * e(l) }[id];
  if (f) return `<div>Produzione: <b>${nf(f(lvl))}/h</b> → <b class="ok">${nf(f(lvl + 1))}/h</b> · Energia: <b>${nf(en(lvl))}</b> → <b class="bad">${nf(en(lvl + 1))}</b></div>`;
  if (id === 'solarPlant') return `<div>Energia: <b>${nf(20 * e(lvl))}</b> → <b class="ok">${nf(20 * e(lvl + 1))}</b></div>`;
  if (id === 'fusionPlant') { const g = l => 30 * l * Math.pow(1.05 + 0.01 * (G.tech.energyTech || 0), l); return `<div>Energia: <b>${nf(g(lvl))}</b> → <b class="ok">${nf(g(lvl + 1))}</b></div>`; }
  if (id.endsWith('Storage') || id === 'deutTank') return `<div>Capienza: <b>${nf(storageCap(lvl))}</b> → <b class="ok">${nf(storageCap(lvl + 1))}</b></div>`;
  return '';
}
function detail(id, pl) {
  const d = DEFS[id], ok = meets(pl, id), isUnit = d.type === 's' || d.type === 'd', n = haveOf(id, pl);
  let h = `<div class="detail">${icon(id, 'l')}<div><h2>${d.name} <small>${isUnit ? (n ? '(' + nf(n) + ')' : '') : '(Livello ' + n + ')'}</small></h2><p class="desc">${d.desc}</p>`;
  if (isUnit) h += `<div class="stats"><span>Attacco <b>${nf(d.atk)}</b></span><span>Scudo <b>${nf(d.shield)}</b></span><span>Struttura <b>${nf(d.hull)}</b></span>${d.cap ? `<span>Capacità <b>${nf(d.cap)}</b></span>` : ''}${d.speed && !d.noFly ? `<span>Velocità <b>${nf(shipSpeed(id))}</b></span><span>Consumo <b>${nf(d.fuel)}</b></span>` : ''}</div>`;
  h += unitFacts(id, pl) + techFacts(id);
  h += `<div><button class="mini" onclick="openTree('${id}')">Albero tecnologico e applicazioni</button></div>`;
  if (!ok) return h + `<p class="req">Requisiti: ${reqText(pl, id)}</p></div></div>`;
  if (!isUnit) {
    const lvl = n, c = costOf(id, lvl + 1), t = d.type === 'b' ? buildTime(pl, id, lvl + 1) : researchTime(id, lvl + 1);
    const busy = d.type === 'b' ? pl.buildQ : G.researchQ, can = canAfford(pl, c) && !busy;
    h += effectText(id, pl, lvl) + costItems(c, pl) + `<div>Durata: <b style="color:var(--hi)">${dur(t)}</b></div>`;
    h += `<div class="actions"><button ${can ? '' : 'disabled'} onclick="act.${d.type === 'b' ? 'build' : 'research'}('${id}')">${lvl ? 'Potenzia al livello ' + (lvl + 1) : 'Costruisci'}</button>${busy && !can && canAfford(pl, c) ? '<span class="muted">Coda occupata</span>' : ''}</div>`;
  } else {
    h += costItems(d.cost, pl) + `<div>Durata per unità: <b style="color:var(--hi)">${dur(unitTime(pl, id))}</b></div>`;
    h += `<div class="actions"><input type="number" min="1" id="q_${id}" value="1"> <button class="mini" onclick="act.maxUnits('${id}')">max</button><button onclick="act.units('${id}')">Costruisci</button></div>`;
  }
  return h + '</div></div>';
}
function itemsView(title, ids, pl, before) {
  ids = ids.filter(i => here(i, pl));
  let sel = SELV[view]; if (!ids.includes(sel)) sel = ids.find(i => meets(pl, i)) || ids[0];
  return (before || '') + panel(title, `<div class="tiles">${ids.map(i => tile(i, pl, sel)).join('')}</div>`) + panel('Dettagli', detail(sel, pl));
}

// ---------- Viste ----------
function eventsBox() {
  let rows = '';
  const ev = [];
  for (const r of incomingRaids()) { const pl = G.planets.find(p => p.id === r.pid); ev.push({ t: r.arr, cls: 'hostile', txt: `Flotta ostile di ${r.owner} [${r.from.g}:${r.from.s}:${r.from.p}] in rotta su ${pl ? pl.name : '?'} (${nf(totalShips(r.ships))} navi)` }); }
  for (const f of G.fleets) { const o = G.planets.find(p => p.id === f.from) || G.planets[0]; ev.push({ t: f.arr, cls: f.state === 'back' ? 'back' : 'own', txt: f.state === 'out' ? `Una tua flotta da ${o.name} [${o.g}:${o.s}:${o.p}] raggiunge [${f.to.g}:${f.to.s}:${f.to.p}] — ${MISSIONS[f.mission]}` : `Una tua flotta rientra su ${o.name} da [${f.to.g}:${f.to.s}:${f.to.p}]` }); }
  for (const m of G.missiles) ev.push({ t: m.arr, cls: 'own', txt: m.hostile ? `Missili ostili di ${m.owner} (${nf(m.n)}) in arrivo su ${(G.planets.find(p => p.id === m.pid) || {}).name}` : `${nf(m.n)} missili interplanetari verso [${m.to.g}:${m.to.s}:${m.to.p}]` });
  ev.sort((a, b) => a.t - b.t);
  rows = ev.map(e => `<div class="ev ${e.cls}"><span class="t">${cd(e.t)}</span><span>${e.txt}</span></div>`).join('');
  return rows ? panel('Eventi', rows, incomingRaids().length ? 'hostile' : '') : '';
}
function incomingRaids() { return G.raids.filter(r => r.tp === 'player' && r.state === 'out'); }
const planetHue = pl => Math.max(0, Math.min(230, 215 - (pl.maxTemp + 80) * 0.75));

function vOverview() {
  const pl = cur(), p = calcProd(pl), rank = ranking(), me = rank.findIndex(r => r.me) + 1, hue = planetHue(pl);
  let h = eventsBox();
  h += panel(`Panoramica — ${pl.name}`, `<div class="ov"><div class="planetpic" style="background:radial-gradient(circle at 35% 30%,hsl(${hue},60%,55%),hsl(${hue},55%,25%) 55%,hsl(${hue},50%,9%))"><span>${pl.moon ? '🌙 ' : ''}${pl.name}</span></div>
    <div class="kv"><div>Coordinate</div><div>[${pl.g}:${pl.s}:${pl.p}]</div><div>Campi</div><div>${usedFields(pl)} / ${maxFields(pl)}</div><div>Temperatura max</div><div>${pl.maxTemp}°C</div>
    <div>Produzione/h</div><div>${fmtRes([p.m, p.c, Math.max(0, p.d)])}</div><div>Classifica</div><div>${me}° su ${rank.length} · ${nf(playerPoints())} punti</div>
    <div>Pianeti / Lune</div><div>${planetCount()}/${maxPlanets()} · ${G.planets.length - planetCount()}</div><div>Slot flotta</div><div>${G.fleets.filter(f => f.mission !== 'expedition').length}/${fleetSlots()} · Spedizioni ${G.fleets.filter(f => f.mission === 'expedition').length}/${expeditionSlots()}</div></div></div>`);
  h += queueBox(pl, 'bts');
  return h;
}

function vResources() {
  const pl = cur(), p = calcProd(pl), cap = capacities(pl);
  let h = queueBox(pl, 'bs');
  const ids = [...IDS.b.filter(i => DEFS[i].grp === 'res'), 'solarSat', 'crawler'];
  h += itemsView(`Risorse — ${pl.name}`, ids, pl);
  if (pl.moon) return h + panel('Nota', '<span class="muted">Le lune non producono risorse: ci puoi solo immagazzinare quelle trasportate.</span>');
  const rows = [['metalMine', p.m - 30 * G.speed], ['crystalMine', p.c - 15 * G.speed], ['deutSynth', p.d + p.fusDeut], ['solarPlant'], ['fusionPlant'], ['solarSat']];
  const opt = id => `<select onchange="act.pct('${id}',this.value)">${[100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map(v => `<option${pl.pct[id] === v ? ' selected' : ''}>${v}</option>`).join('')}</select>%`;
  let t = `<table><tr><th>Edificio</th><th>Liv.</th><th>Produzione</th><th>Resa</th></tr>`;
  for (const [id, v] of rows) {
    const name = id === 'solarSat' ? DEFS.solarSat.name : DEFS[id].name, lv = id === 'solarSat' ? '× ' + (pl.ships.solarSat || 0) : (pl.b[id] || 0);
    const pr = v !== undefined ? nf(v) + '/h' : id === 'solarPlant' ? nf(20 * (pl.b.solarPlant || 0) * Math.pow(1.1, pl.b.solarPlant || 0) * pl.pct.solarPlant / 100) + ' energia'
      : id === 'fusionPlant' ? nf(30 * (pl.b.fusionPlant || 0) * Math.pow(1.05 + 0.01 * (G.tech.energyTech || 0), pl.b.fusionPlant || 0) * pl.pct.fusionPlant / 100) + ' energia (−' + nf(p.fusDeut) + ' D/h)'
        : nf((pl.ships.solarSat || 0) * satEnergy(pl) * pl.pct.solarSat / 100) + ' energia';
    t += `<tr><td>${name}</td><td>${lv}</td><td>${pr}</td><td>${opt(id)}</td></tr>`;
  }
  t += `</table>${(pl.ships.crawler || 0) ? `<p>Crawler: <b>${nf(pl.ships.crawler)}</b> (usati ${nf(crawlerUsed(pl))} su ${nf(crawlerMax(pl))}) · bonus miniere <b class="ok">+${((crawlerBonus(pl) - 1) * 100).toFixed(2)}%</b></p>` : ''}<p>Energia: <b class="${p.energyProd >= p.energyUse ? 'ok' : 'bad'}">${nf(p.energyProd - p.energyUse)}</b> (prod. ${nf(p.energyProd)} / consumo ${nf(p.energyUse)}) · Efficienza miniere: <b>${(p.factor * 100).toFixed(0)}%</b></p>
  <p>Capienza magazzini: ${nf(cap[0])} M · ${nf(cap[1])} C · ${nf(cap[2])} D</p>`;
  return h + panel('Impostazioni risorse', t);
}
const vFacilities = () => { const pl = cur(); return queueBox(pl, 'b') + itemsView(`Strutture — ${pl.name}`, IDS.b.filter(i => DEFS[i].grp === 'fac'), pl); };
const vResearch = () => { const pl = cur(); return queueBox(pl, 't') + itemsView('Ricerca', IDS.t, pl) + panel('Info', `<span class="muted">Laboratorio più alto tra i tuoi pianeti: livello ${labLevel()}.</span>`); };
const vShipyard = () => { const pl = cur(); return queueBox(pl, 's') + itemsView(`Cantiere spaziale — ${pl.name}`, IDS.s, pl); };
const vDefence = () => { const pl = cur(); return queueBox(pl, 's') + itemsView(`Difesa — ${pl.name}`, IDS.d, pl); };

function fleetMoves() {
  if (!G.fleets.length && !G.missiles.length) return '<span class="muted">Nessuna flotta in volo.</span>';
  let h = '<table><tr><th>Missione</th><th>Rotta</th><th>Navi</th><th>Carico</th><th>Arrivo</th><th></th></tr>';
  for (const m of G.missiles) { const o = m.hostile ? m.from : (G.planets.find(p => p.id === m.from) || G.planets[0]); h += `<tr class="${m.hostile ? 'hostile' : ''}"><td>${m.hostile ? 'Missili ostili' : 'Missili'}</td><td>[${o.g}:${o.s}:${o.p}] → [${m.to.g}:${m.to.s}:${m.to.p}]</td><td>${nf(m.n)} × ${DEFS.ipm.name}</td><td>—</td><td>${cd(m.arr)}</td><td></td></tr>`; }
  for (const f of G.fleets) {
    const o = G.planets.find(p => p.id === f.from) || G.planets[0];
    const route = f.state === 'out' ? `[${o.g}:${o.s}:${o.p}] → [${f.to.g}:${f.to.s}:${f.to.p}]` : `[${f.to.g}:${f.to.s}:${f.to.p}] → [${o.g}:${o.s}:${o.p}]`;
    h += `<tr class="${f.state}"><td>${MISSIONS[f.mission]} ${f.state === 'back' ? '<i>(ritorno)</i>' : ''}</td><td>${route}</td><td>${listUnits(f.ships)}</td><td>${f.cargo.some(v => v) ? fmtRes(f.cargo) : '—'}</td><td>${cd(f.arr)}</td><td>${f.state === 'out' ? `<button class="mini" onclick="act.recall(${f.id})">Richiama</button>` : ''}</td></tr>`;
  }
  return h + '</table>';
}

function vFleet() {
  const pl = cur();
  const ids = IDS.s.filter(i => !DEFS[i].noFly && (pl.ships[i] || 0) > 0);
  let h = '';
  if (!ids.length) h += panel(`Flotta — ${pl.name}`, '<span class="muted">Nessuna nave disponibile su questo pianeta. Costruiscile nel Cantiere spaziale.</span>');
  else {
    let t = `<p class="note">Slot flotta: ${G.fleets.filter(f => f.mission !== 'expedition').length}/${fleetSlots()} · Spedizioni: ${G.fleets.filter(f => f.mission === 'expedition').length}/${expeditionSlots()}</p><table><tr><th>Nave</th><th>Disponibili</th><th>Velocità</th><th>Invia</th></tr>`;
    for (const i of ids) t += `<tr><td><span class="shiprow">${icon(i, 's')} ${DEFS[i].name}</span></td><td>${nf(pl.ships[i])}</td><td>${nf(shipSpeed(i))}</td><td><input type="number" min="0" max="${pl.ships[i]}" id="fs_${i}" value="${FL.sel[i] || 0}" oninput="fleetChange()"> <button class="mini" onclick="document.getElementById('fs_${i}').value=${pl.ships[i]};fleetChange()">tutte</button></td></tr>`;
    t += `</table>`;
    h += panel(`Flotta — ${pl.name}`, t);
    h += panel('Invio', `<div class="form">
      <label>Destinazione <input type="number" id="fg" min="1" max="${GALAXIES}" value="${FL.g}" oninput="fleetChange()"> : <input type="number" id="fsys" min="1" max="${SYSTEMS}" value="${FL.s}" oninput="fleetChange()"> : <input type="number" id="fp" min="1" max="16" value="${FL.p}" oninput="fleetChange()"> <select id="ft" onchange="fleetChange()"><option value="p">Pianeta</option><option value="m"${FL.moon ? ' selected' : ''}>Luna</option></select></label>
      <label>Missione <select id="fm" onchange="fleetChange()">${Object.entries(MISSIONS).map(([k, v]) => `<option value="${k}"${FL.mission === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Velocità <select id="fpct" onchange="fleetChange()">${[100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map(v => `<option${FL.pct === v ? ' selected' : ''}>${v}</option>`).join('')}</select>%</label>
      <label>Carico <input type="number" min="0" id="fc0" value="${FL.cargo[0]}" oninput="fleetChange()" placeholder="M"> <input type="number" min="0" id="fc1" value="${FL.cargo[1]}" oninput="fleetChange()" placeholder="C"> <input type="number" min="0" id="fc2" value="${FL.cargo[2]}" oninput="fleetChange()" placeholder="D"></label>
      <div id="fsum" class="note"></div><div><button onclick="fleetSend()">Invia flotta</button></div></div>`);
  }
  return h + gateBox(pl) + panel('Movimenti', `<div id="fmoves">${fleetMoves()}</div>`);
}
function fleetRead() {
  const pl = cur(); const v = id => { const e = document.getElementById(id); return e ? e.value : ''; };
  FL.sel = {};
  for (const i of IDS.s) { const e = document.getElementById('fs_' + i); if (e) FL.sel[i] = Math.max(0, Math.min(pl.ships[i] || 0, parseInt(e.value) || 0)); }
  FL.g = parseInt(v('fg')) || 1; FL.s = parseInt(v('fsys')) || 1; FL.p = parseInt(v('fp')) || 1;
  FL.moon = v('ft') === 'm'; FL.mission = v('fm') || 'attack'; FL.pct = parseInt(v('fpct')) || 100;
  FL.cargo = [parseInt(v('fc0')) || 0, parseInt(v('fc1')) || 0, parseInt(v('fc2')) || 0];
}
function fleetChange() {
  if (view !== 'fleet') return; fleetRead();
  const pl = cur(), ships = {}; for (const [i, n] of Object.entries(FL.sel)) if (n > 0) ships[i] = n;
  const el = $('#fsum'); if (!el) return;
  if (!Object.keys(ships).length) { el.innerHTML = 'Seleziona le navi da inviare.'; return; }
  const inf = flightInfo(ships, pl, { g: FL.g, s: FL.s, p: FL.p }, FL.pct);
  el.innerHTML = `Distanza ${nf(inf.dist)} · Durata ${dur(inf.dur)} (andata) · Carburante <span class="rd">${nf(inf.fuel)} D</span> · Capacità ${nf(inf.cap)} · Velocità ${nf(inf.speed)}`;
}
function fleetSend() {
  fleetRead(); const ships = {}; for (const [i, n] of Object.entries(FL.sel)) if (n > 0) ships[i] = n;
  const err = launch(cur(), ships, { g: FL.g, s: FL.s, p: FL.p, moon: FL.moon }, FL.mission, FL.pct, FL.cargo.slice());
  if (!err) { FL.sel = {}; FL.cargo = [0, 0, 0]; toast('Flotta partita.'); }
  done(err);
}
function fleetTo(g, s, p, mission, ships) {
  FL = { g, s, p, moon: false, mission, pct: 100, cargo: [0, 0, 0], sel: ships || {} }; view = 'fleet'; render(); fleetChange();
}

function gateBox(pl) {
  if (!pl.moon || !(pl.b.jumpGate > 0)) return '';
  const dests = G.planets.filter(p => p.moon && p !== pl && p.b.jumpGate > 0);
  const wait = (pl.gateT || 0) - T();
  const ids = IDS.s.filter(i => !DEFS[i].noFly && (pl.ships[i] || 0) > 0);
  if (!dests.length) return panel('Portale spaziale', '<span class="muted">Serve un’altra luna con portale spaziale.</span>');
  let h = wait > 0 ? `<p>In ricarica: ${cd(pl.gateT)}</p>` : '';
  h += `<label>Destinazione <select id="jgd">${dests.map(d => `<option value="${d.id}">${d.name} [${d.g}:${d.s}:${d.p}]</option>`).join('')}</select></label><table>` +
    ids.map(i => `<tr><td>${DEFS[i].name} (${nf(pl.ships[i])})</td><td><input type="number" min="0" max="${pl.ships[i]}" id="jg_${i}" value="0"></td></tr>`).join('') +
    `</table><p><button onclick="jumpGo()">Salta</button></p>`;
  return panel('Portale spaziale', h);
}
function jumpGo() {
  const ships = {}; for (const i of IDS.s) { const e = document.getElementById('jg_' + i); if (e) ships[i] = parseInt(e.value) || 0; }
  const err = jump(cur(), parseInt($('#jgd').value), ships); if (!err) toast('Salto completato.'); done(err);
}
function fireIPM(g, s, p) {
  const err = launchMissiles(cur(), parseInt($('#ipmN').value) || 0, { g, s, p }, $('#ipmT').value);
  if (!err) toast('Missili lanciati.'); done(err);
}
function phalanxScan(g, s, p) { const err = scan(cur(), g, s, p); if (err) done(err); else { toast('Scansione completata.'); go('messages'); save(); } }

function vGalaxy() {
  const pl = cur(), { g, s } = GV;
  let h = `<div class="galnav">
    <button class="mini" onclick="GV.g=Math.max(1,GV.g-1);render()">◀</button> Galassia <input type="number" min="1" max="${GALAXIES}" value="${g}" onchange="GV.g=Math.min(${GALAXIES},Math.max(1,+this.value||1));render()">
    <button class="mini" onclick="GV.g=Math.min(${GALAXIES},GV.g+1);render()">▶</button>
    <button class="mini" onclick="GV.s=Math.max(1,GV.s-1);render()">◀</button> Sistema <input type="number" min="1" max="${SYSTEMS}" value="${s}" onchange="GV.s=Math.min(${SYSTEMS},Math.max(1,+this.value||1));render()">
    <button class="mini" onclick="GV.s=Math.min(${SYSTEMS},GV.s+1);render()">▶</button>
    · Sonde per spionaggio <input type="number" min="1" value="${spyN}" onchange="spyN=Math.max(1,+this.value||1)"> (disponibili: ${pl.ships.probe || 0})</div>`;
  const hasIpm = (pl.defs.ipm || 0) > 0, hasPh = pl.moon && pl.b.phalanx > 0;
  if (hasIpm || hasPh) h += `<div class="galnav" style="margin-top:8px">${hasIpm ? `Missili <input type="number" id="ipmN" min="1" max="${pl.defs.ipm}" value="${pl.defs.ipm}"> (hai ${pl.defs.ipm}, raggio ${missileRange()} sistemi) bersaglio primario <select id="ipmT">${MISSILE_ORDER.map(i => `<option value="${i}">${DEFS[i].name}</option>`).join('')}</select>` : ''}${hasPh ? ` Phalanx: raggio ${phalanxRange(pl)} sistemi, 5.000 D a scansione` : ''}</div>`;
  let t = `<table class="gal"><tr><th>#</th><th>Pianeta</th><th>Giocatore</th><th>Detriti</th><th>Azioni</th></tr>`;
  for (let p = 1; p <= SLOTS; p++) {
    const occ = occupant(g, s, p), deb = G.debris[coordKey(g, s, p)];
    let name = '<span class="muted">—</span>', who = '', acts = '';
    if (occ && occ.type === 'player') { name = occ.planet.name + (G.planets.some(m => m.moon && m.g === g && m.s === s && m.p === p) ? ' 🌙' : ''); who = `<b>${G.name}</b>`; }
    else if (occ) { name = occ.npc.name; who = occ.npc.owner; acts = `<button class="mini" onclick="spy(${g},${s},${p})">Spia</button> ${G.cheat.spy ? `<button class="mini on" onclick="cheatSpy(${g},${s},${p})">Spia cheat</button> ` : ''}<button class="mini" onclick="fleetTo(${g},${s},${p},'attack')">Attacca</button>` + (hasIpm && g === pl.g && Math.abs(s - pl.s) <= missileRange() ? ` <button class="mini" onclick="fireIPM(${g},${s},${p})">IPM</button>` : '') + (hasPh && g === pl.g && Math.abs(s - pl.s) <= phalanxRange(pl) ? ` <button class="mini" onclick="phalanxScan(${g},${s},${p})">Scansiona</button>` : ''); }
    else acts = `<button class="mini" onclick="fleetTo(${g},${s},${p},'colonize',{colonyShip:Math.min(1,cur().ships.colonyShip||0)})">Colonizza</button>`;
    if (deb) acts += ` <button class="mini" onclick="fleetTo(${g},${s},${p},'recycle',recycleSel(${deb[0] + deb[1]}))">Ricicla</button>`;
    t += `<tr class="${occ && occ.type === 'player' ? 'mine' : ''}"><td>${p}</td><td>${name}</td><td>${who}</td><td>${deb ? `<span class="rm">${nf(deb[0])}</span> <span class="rc">${nf(deb[1])}</span>` : ''}</td><td>${acts}</td></tr>`;
  }
  t += `<tr><td>16</td><td colspan="3" class="muted">Spazio profondo</td><td><button class="mini" onclick="fleetTo(${g},${s},16,'expedition')">Spedizione</button></td></tr></table>`;
  return panel(`Galassia ${g}:${s}`, h + '<div style="height:10px"></div>' + t);
}
function recycleSel(total) {
  const ships = {}, sh = cur().ships;
  const r = Math.min(sh.recycler || 0, Math.ceil(total / DEFS.recycler.cap)); if (r) ships.recycler = r;
  const left = total - r * DEFS.recycler.cap;
  if (left > 0 && sh.reaper) ships.reaper = Math.min(sh.reaper, Math.ceil(left / DEFS.reaper.cap));
  return ships;
}
const CS = { ids: [], sec: 'r' };
function cheatSpy(g, s, p) {
  const occ = occupant(g, s, p); if (!occ || occ.type !== 'npc') return;
  CS.ids = [occ.npc]; go('empirecheat');
}
function cheatSearch() {
  const q = ($('#cq').value || '').trim().toLowerCase(); if (!q) return toast('Inserisci un nome utente.', true);
  const found = G.npcs.filter(n => n.owner.toLowerCase().includes(q)).slice(0, 12);
  if (!found.length) return toast('Nessun giocatore trovato.', true);
  CS.ids = found; go('empirecheat');
}
function spy(g, s, p) {
  const err = launch(cur(), { probe: spyN }, { g, s, p }, 'espionage', 100, [0, 0, 0]);
  if (!err) toast(`${spyN} sonde in viaggio.`); done(err);
}

function vMessages() {
  if (!G.messages.length) return panel('Messaggi', '<span class="muted">Nessun messaggio.</span>');
  return panel('Messaggi', `<p><button class="mini" onclick="G.messages=[];done()">Elimina tutti</button></p>` +
    G.messages.map(m => `<details class="msg ${m.type}"><summary>${m.title} <span class="muted">${clock(m.time, m.turn)}</span></summary><div class="body">${m.body}</div></details>`).join(''));
}

function ranking() {
  const list = G.npcs.map(n => ({ name: n.owner, pts: npcPoints(n), me: false }));
  list.push({ name: G.name, pts: playerPoints(), me: true });
  return list.sort((a, b) => b.pts - a.pts);
}
function vHighscore() {
  const r = ranking(); let t = `<table><tr><th>#</th><th>Comandante</th><th>Punti</th></tr>`;
  r.forEach((x, i) => { if (i < 30 || x.me) t += `<tr class="${x.me ? 'mine' : ''}"><td>${i + 1}</td><td>${x.name}</td><td>${nf(x.pts)}</td></tr>`; });
  t += '</table>';
  return panel('Classifica', t) + panel('Notizie dall’universo', G.news.length ? G.news.slice(0, 15).map(n => `<div class="ev"><span class="t muted">${clock(n.t, n.turn)}</span><span>${n.text}</span></div>`).join('') : '<span class="muted">Tutto tranquillo, per ora.</span>');
}


// ---------- Tecnologia: albero e tabella ----------
function openTree(id) { SELV.tech = id; go('tech'); }
function treeNode(pl, id, lvl, seen) {
  const d = DEFS[id], have = lvlOf(pl, id);
  const reqs = Object.entries(d.req);
  let h = `<li><span class="${lvl === 0 ? 'root' : have >= (lvl || 0) ? 'ok' : 'bad'}">${icon(id, 's')} <a class="lk" onclick="openTree('${id}')">${d.name}</a>${lvl ? ' ' + lvl : ''}</span>`;
  if (reqs.length && !seen.includes(id)) { seen.push(id); h += '<ul>' + reqs.map(([k, v]) => treeNode(pl, k, v, seen)).join('') + '</ul>'; }
  return h + '</li>';
}
function vTech() {
  const pl = cur(), all = [...IDS.b, ...IDS.t, ...IDS.s, ...IDS.d];
  let sel = SELV.tech; if (!DEFS[sel]) sel = 'metalMine';
  const d = DEFS[sel], un = UNLOCKS[sel] || [];
  const tree = `<div class="detail">${icon(sel, 'l')}<div><h2>${d.name}</h2><p class="desc">${d.desc}</p>${statsLine(sel)}${unitFacts(sel, pl)}${techFacts(sel)}${USES[sel] ? `<p><b>Applicazione:</b> ${USES[sel]}</p>` : ''}
    <div class="treecols"><div><h4>Per sbloccarla serve</h4>${Object.keys(d.req).length ? `<ul class="tree">${treeNode(pl, sel, 0, [])}</ul>` : '<span class="ok">Nessun requisito</span>'}</div>
    <div><h4>Cosa sblocca</h4>${un.length ? '<ul class="tree flat">' + un.map(u => `<li><span class="${meets(pl, u) ? 'ok' : 'bad'}">${icon(u, 's')} <a class="lk" onclick="openTree('${u}')">${DEFS[u].name}</a> <small>(richiede liv. ${DEFS[u].req[sel]})</small></span></li>`).join('') + '</ul>' : '<span class="muted">Nessuna altra voce dipende da questa.</span>'}</div></div></div></div>`;
  const pick = `<div class="tiles">${all.map(i => tile(i, pl, sel).replace(/onclick="selItem\('([^']+)'\)"/, "onclick=\"openTree('$1')\"")).join('')}</div>`;
  const sec = (title, ids) => panel(title, `<table class="tech"><tr><th></th><th>Nome</th><th>Descrizione</th><th>Requisiti</th><th>Sblocca</th></tr>${ids.map(i => infoRow(i, pl)).join('')}</table>`);
  return panel('Albero tecnologico e applicazioni', pick + tree) + sec('Edifici', IDS.b) + sec('Ricerche', IDS.t) + sec('Navi', IDS.s) + sec('Difese', IDS.d);
}


// ---------- Impero ----------
const EV = { moon: false, sec: 'b' };
function empGo(planetId) { G.cur = planetId; go('overview'); }
function vEmpire() {
  const list = G.planets.filter(x => !!x.moon === EV.moon);
  const tabs = [['b', 'Edifici'], ['r', 'Risorse'], ['s', 'Navi'], ['d', 'Difese'], ['t', 'Ricerca']];
  const ctl = `<div class="emptabs"><button class="${EV.moon ? '' : 'on'}" onclick="EV.moon=false;render()">Pianeti</button><button class="${EV.moon ? 'on' : ''}" onclick="EV.moon=true;render()">Lune</button> <span class="sep"></span>` +
    tabs.map(([k, n]) => `<button class="${EV.sec === k ? 'on' : ''}" onclick="EV.sec='${k}';render()">${n}</button>`).join('') + '</div>';
  if (!list.length) return panel('Impero', ctl + '<p class="muted">Non possiedi ancora nessuna luna.</p>');
  const head = `<tr><th></th>${list.map(pl => `<th class="ec${pl.id === G.cur ? ' sel' : ''}" onclick="empGo(${pl.id})" title="Vai alla panoramica">${pl.moon ? '🌙 ' : ''}${pl.name}<small>[${pl.g}:${pl.s}:${pl.p}]</small></th>`).join('')}<th class="ec tot">Totale</th></tr>`;
  const row = (label, vals, fmt, tot) => `<tr><td class="el">${label}</td>${vals.map(v => `<td>${fmt ? fmt(v) : v}</td>`).join('')}<td class="tot">${tot === false ? '' : (fmt || (x => x))(vals.reduce((a, b) => a + b, 0))}</td></tr>`;
  const num = v => v ? nf(v) : '<span class="muted">—</span>';
  const info = [
    ['Campi', list.map(pl => usedFields(pl) + ' / ' + maxFields(pl)), false],
    ['Temperatura max', list.map(pl => pl.moon ? '—' : pl.maxTemp + '°C'), false],
  ].map(([l, v]) => `<tr><td class="el">${l}</td>${v.map(x => `<td>${x}</td>`).join('')}<td class="tot"></td></tr>`).join('');
  let body = '';
  if (EV.sec === 'b') {
    const ids = IDS.b.filter(i => list.some(pl => here(i, pl)));
    body = ids.map(i => `<tr><td class="el">${icon(i, 's')} ${DEFS[i].name}</td>${list.map(pl => `<td>${here(i, pl) ? (pl.b[i] ? `<b>${pl.b[i]}</b>${pl.buildQ && pl.buildQ.id === i ? ` <small class="ok">→${pl.buildQ.level}</small>` : ''}` : '<span class="muted">—</span>') : ''}</td>`).join('')}<td class="tot"></td></tr>`).join('');
  } else if (EV.sec === 'r') {
    const ps = list.map(pl => ({ pl, p: calcProd(pl), cap: capacities(pl) }));
    const R = [['Metallo', 0, 'm'], ['Cristallo', 1, 'c'], ['Deuterio', 2, 'd']];
    body = R.map(([n, k]) => row(n, ps.map(x => Math.floor(x.pl.res[k])), num)).join('');
    body += `<tr class="sub"><td colspan="${list.length + 2}">Produzione oraria</td></tr>` + R.map(([n, , key]) => row(n, ps.map(x => x.p[key]), v => v ? nf(v) : '<span class="muted">—</span>')).join('');
    body += row('Energia', ps.map(x => Math.floor(x.p.energyProd - x.p.energyUse)), v => `<span class="${v < 0 ? 'bad' : 'ok'}">${nf(v)}</span>`);
    body += `<tr class="sub"><td colspan="${list.length + 2}">Capienza magazzini</td></tr>` + R.map(([n, k]) => row(n, ps.map(x => x.cap[k]), num, false)).join('');
  } else if (EV.sec === 's' || EV.sec === 'd') {
    const ids = IDS[EV.sec], get = (pl, i) => (EV.sec === 's' ? pl.ships : pl.defs)[i] || 0;
    body = ids.map(i => row(`${icon(i, 's')} ${DEFS[i].name}`, list.map(pl => get(pl, i)), num)).join('');
  } else {
    body = IDS.t.map(i => `<tr><td class="el">${icon(i, 's')} ${DEFS[i].name}</td><td colspan="${list.length + 1}">${G.tech[i] ? '<b>' + G.tech[i] + '</b>' + (G.researchQ && G.researchQ.id === i ? ` <small class="ok">→${G.researchQ.level}</small>` : '') : '<span class="muted">—</span>'}</td></tr>`).join('');
  }
  return panel('Impero', ctl + `<div class="empwrap"><table class="emp">${head}${EV.sec === 'r' ? '' : info}${body}</table></div>`);
}

// ---------- Impero cheat ----------
function vEmpireCheat() {
  const list = CS.ids.filter(n => G.npcs.includes(n));
  const tabs = [['b', 'Edifici'], ['r', 'Risorse'], ['s', 'Navi'], ['d', 'Difese'], ['t', 'Ricerca']];
  const ctl = `<div class="emptabs"><button onclick="go('galaxy')">◀ Galassia</button> <span class="sep"></span>` +
    tabs.map(([k, n]) => `<button class="${CS.sec === k ? 'on' : ''}" onclick="CS.sec='${k}';render()">${n}</button>`).join('') + '</div>';
  if (!list.length) return panel('Impero cheat', ctl + '<p class="muted">Nessun giocatore selezionato.</p>');
  const head = `<tr><th></th>${list.map(n => `<th class="ec" onclick="GV.g=${n.g};GV.s=${n.s};go('galaxy')" title="Vai alla galassia">${n.name}<small>${n.owner} [${n.g}:${n.s}:${n.p}]</small></th>`).join('')}<th class="ec tot">Totale</th></tr>`;
  const num = v => v ? nf(v) : '<span class="muted">—</span>';
  const row = (label, vals, fmt, tot) => `<tr><td class="el">${label}</td>${vals.map(v => `<td>${(fmt || (x => x))(v)}</td>`).join('')}<td class="tot">${tot === false || list.length < 2 ? '' : (fmt || (x => x))(vals.reduce((a, b) => a + b, 0))}</td></tr>`;
  const span = list.length + 2;
  const info = [['Stile', list.map(n => NPC_STYLES[n.style].name)], ['Abilità', list.map(n => NPC_SKILLS[n.skill].name)], ['Punti', list.map(n => nf(npcPoints(n)))], ['Età', list.map(n => n.age.toFixed(1) + ' h')]]
    .map(([l, v]) => `<tr><td class="el">${l}</td>${v.map(x => `<td>${x}</td>`).join('')}<td class="tot"></td></tr>`).join('');
  let body = '';
  if (CS.sec === 'b') {
    body = `<tr class="sub"><td colspan="${span}">Gli NPC non hanno edifici singoli: le miniere sono riassunte in un'unica produzione, che cresce col tempo e con gli investimenti.</td></tr>` +
      row('Produzione metallo/h', list.map(n => Math.floor(n.rate)), num) + row('Produzione cristallo/h', list.map(n => Math.floor(n.rate * 0.5)), num) + row('Produzione deuterio/h', list.map(n => Math.floor(n.rate * 0.25)), num) +
      row('Produzione base', list.map(n => Math.floor(n.rate0)), num, false);
  } else if (CS.sec === 'r') {
    const R = [['Metallo', 0], ['Cristallo', 1], ['Deuterio', 2]];
    body = `<tr class="sub"><td colspan="${span}">Risorse attuali</td></tr>` + R.map(([nm, k]) => row(nm, list.map(n => Math.floor(n.res[k])), num)).join('') +
      `<tr class="sub"><td colspan="${span}">Tesoro da investire</td></tr>` + R.map(([nm, k]) => row(nm, list.map(n => Math.floor((n.bank || [0, 0, 0])[k])), num)).join('') +
      `<tr class="sub"><td colspan="${span}">Capienza magazzini</td></tr>` + R.map(([nm, k]) => row(nm, list.map(n => Math.floor(n.rate * [48, 24, 12][k])), num, false)).join('');
  } else if (CS.sec === 's' || CS.sec === 'd') {
    const key = CS.sec === 's' ? 'fleet' : 'def';
    body = IDS[CS.sec].map(i => row(`${icon(i, 's')} ${DEFS[i].name}`, list.map(n => n[key][i] || 0), num)).join('');
  } else {
    body = IDS.t.filter(i => ['weapons', 'shield', 'armour', 'espionage'].includes(i)).map(i => row(`${icon(i, 's')} ${DEFS[i].name}`, list.map(n => npcTech(n)[i]), num, false)).join('');
  }
  return panel('Impero cheat', ctl + `<div class="empwrap"><table class="emp">${head}${info}${body}</table></div>`);
}

const turnLabel = min => min < 60 ? `${min} min` : `${min / 60} h`;
function setOpt(k, v) { G.opts[k] = typeof G.opts[k] === 'boolean' ? !!v : parseFloat(v); save(); render(); }
function vOptions() {
  const o = G.opts, sel = (k, items) => `<select onchange="setOpt('${k}',this.value)">${items.map(([v, l]) => `<option value="${v}"${o[k] === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const chk = (k, l) => `<label><input type="checkbox" ${o[k] ? 'checked' : ''} onchange="setOpt('${k}',this.checked)"> ${l}</label>`;
  return panel('Rivali NPC', `<div class="form">
  <label>Ritmo di sviluppo ${sel('npcGrowth', [[0, 'Fermi'], [0.25, '×0,25 (lento)'], [0.5, '×0,5'], [1, '×1 (normale)'], [2, '×2'], [4, '×4 (rapido)']])}</label>
  <label>Aggressività ${sel('npcAggr', [[0, 'Nessun attacco'], [1, 'Bassa'], [2, 'Normale'], [3, 'Alta']])}</label>
  ${chk('hitPlayer', 'Gli NPC possono attaccare i miei pianeti e le mie lune')}
  ${chk('hitNpc', 'Gli NPC possono attaccarsi tra loro')}
  ${chk('protect', 'Protezione principianti (nessun attacco finché non hai almeno ' + PROTECT_POINTS + ' punti)')}
  </div><p class="note">A ogni fine turno ogni NPC gioca il proprio turno: incassa e spende secondo stile (aggressivo, difensivo, minatore, bilanciato) e abilità (chi è poco abile salta turni). Il ritmo di sviluppo scala le risorse che incassano. L'aggressività decide quanto spesso e da quanto lontano attaccano; scelgono bersagli ricchi e più deboli di loro.</p>`) +
    panel('Universo', `<p>Velocità dell'universo: <b>×${G.speed}</b> (produzione, costruzioni e voli per ogni ora di universo). Il cambio vale da subito per le nuove azioni.</p>
  <select id="spd">${[1, 10, 25, 50, 100, 250, 500, 1000].map(v => `<option${G.speed === v ? ' selected' : ''}>${v}</option>`).join('')}</select>
  <button onclick="G.speed=+$('#spd').value;done()">Applica</button>
  <p>Durata di un turno: <b>${turnLabel(turnMs() / 60000)}</b> di universo. Si applica dai prossimi turni; le azioni già avviate mantengono la loro durata.</p>
  <select id="trn">${[1, 5, 15, 30, 60, 120, 240, 720, 1440].map(v => `<option value="${v}"${Math.round(turnMs() / 60000) === v ? ' selected' : ''}>${turnLabel(v)}</option>`).join('')}</select>
  <button onclick="G.turnMs=+$('#trn').value*60000;done()">Applica</button>`) +
    panel('Salvataggio', `<p class="note">La partita si salva da sola nel browser. Con <b>Salva partita</b> scarichi un file JSON, che puoi ricaricare con <b>Carica</b>: la partita riprende dal momento del salvataggio.</p><button onclick="saveFile()">Salva partita</button> <button onclick="$('#loadfile').click()">Carica</button>`) +
    panel('Immagini personali', `<span class="muted">Per sostituire le icone con tue immagini, aggiungi un file <code>png</code> o <code>jpg</code> nella cartella giusta di <code>img/</code>: <code>edifici</code>, <code>ricerche</code>, <code>navi</code> o <code>difese</code> (dove ci sono già le icone attuali in <code>svg</code>), chiamandolo con l'id della voce (es. <code>img/edifici/metalMine.jpg</code>, <code>img/navi/smallCargo.png</code>).</span>`) +
    panel('Nuova partita', `<button class="danger" onclick="if(confirm('Cancellare la partita?')){localStorage.removeItem(SAVE_KEY);location.reload()}">Ricomincia da zero</button>`);
}
function saveFile() {
  const blob = new Blob([saveFileText()], { type: 'application/json' }), a = document.createElement('a');
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  a.href = URL.createObjectURL(blob); a.download = `orbita-${G.name.replace(/[^\w-]+/g, '_')}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Partita salvata su file.');
}
function loadFile(input) {
  const f = input.files[0]; input.value = ''; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { loadFileText(r.result); location.reload(); } catch (e) { toast('Salvataggio non valido.', true); } };
  r.readAsText(f);
}
function nextTurn(n) {
  const unread0 = G.unread;
  for (let i = 0; i < n; i++) endTurn();
  render();
  const fresh = G.unread - unread0;
  toast(n > 1 ? `Passati ${n} turni — ora turno ${G.turn}.` : `Turno ${G.turn}.${fresh > 0 ? ' Nuovi messaggi: ' + fresh + '.' : ''}`);
}

// ---------- Cheat ----------
function vCheat() {
  const pl = cur(), amounts = [1000, 10000, 100000, 1000000], mins = [1, 3, 10, 50], mults = [1, 10, 100, 1000];
  const btns = (fn, arr, fmt) => arr.map(v => `<button class="mini" onclick="${fn}(${v})">${fmt(v)}</button>`).join(' ');
  let rows = '';
  for (const [k, name] of [[0, 'Metallo'], [1, 'Cristallo'], [2, 'Deuterio'], ['all', 'Tutte e tre']])
    rows += `<tr><td>${name}</td><td>${amounts.map(v => `<button class="mini" onclick="cheatDo('res',${typeof k === 'string' ? `'${k}'` : k},${v})">+${nf(v)}</button>`).join(' ')}</td></tr>`;
  return panel('Cheat', '<span class="muted">Vantaggi rispetto agli altri giocatori. Agiscono sul pianeta o sulla luna selezionati.</span>') +
    panel(`Risorse — ${pl.name}`, `<table>${rows}</table>`) +
    panel(`Tempo di costruzione — ${pl.name}`, `<p class="note">Toglie tempo all'edificio in costruzione su questo pianeta e alla coda del cantiere e delle difese (turni).</p>
      <p>${mins.map(v => `<button class="mini" onclick="cheatDo('time',${v},'b')">−${nf(v)} ${v === 1 ? 'turno' : 'turni'}</button>`).join(' ')}</p>`) +
    panel('Tempo di ricerca', `<p class="note">Toglie tempo alla ricerca in corso (turni).</p>
      <p>${mins.map(v => `<button class="mini" onclick="cheatDo('time',${v},'t')">−${nf(v)} ${v === 1 ? 'turno' : 'turni'}</button>`).join(' ')}</p>`) +
    panel('Spia cheat', `<p class="note">Con l'opzione attiva, in Galassia compare il tasto <b>Spia cheat</b>: rapporto completo senza sonde. Oppure cerca un giocatore per nome.</p>
      <p><button class="mini${G.cheat.spy ? ' on' : ''}" onclick="cheatDo('spy')">${G.cheat.spy ? 'Attiva ✔ (clicca per spegnere)' : 'Spenta (clicca per attivare)'}</button>
      <input type="text" id="cq" placeholder="Nome utente" onkeydown="if(event.key==='Enter')cheatSearch()"> <button class="mini" onclick="cheatSearch()">Cerca</button></p>`) +
    panel('Velocità della flotta', `<p class="note">Divide il tempo di volo delle flotte che parti da ora. Attuale: <b>×${G.cheat.fleetMult}</b>.</p>
      <p>${mults.map(v => `<button class="mini${G.cheat.fleetMult === v ? ' on' : ''}" onclick="cheatDo('fleet',${v})">${v === 1 ? 'Normale' : '×' + v}</button>`).join(' ')}</p>`) +
    panel(`Spazi — ${pl.name}`, `<p>Campi occupati: <b>${usedFields(pl)}</b> · Campi totali: <b>${maxFields(pl)}</b></p>
      <label>Nuovo totale <input type="number" id="cfields" min="1" value="${maxFields(pl)}"></label> <button onclick="cheatDo('fields')">Imposta</button>`) + npcPanel(pl);
}
function npcPanel(pl) {
  const s = Math.min(SYSTEMS, Math.max(1, pl.s + 10 > SYSTEMS ? pl.s - 10 : pl.s + 10));
  const st = rint(0, SLOTS - 1); let p = 1; for (let k = 0; k < SLOTS; k++) { const i = (st + k) % SLOTS + 1; if (!occupant(pl.g, s, i, false)) { p = i; break; } }
  return panel('Nuovo giocatore NPC', `<p class="note">Crea un avversario controllato dal computer. Punti predefiniti: i tuoi attuali. Sistema predefinito: 10 sistemi da <b>${pl.name}</b>.</p>
    <p><label>Punti <input type="number" id="npts" min="1" value="${Math.max(1, Math.round(playerPoints()))}"></label></p>
    <p><label>Stile <select id="nstyle"><option value="">Casuale</option>${Object.entries(NPC_STYLES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select></label>
    <label>Abilità <select id="nskill"><option value="">Casuale</option>${[['high', 'Molto'], ['mid', 'Media'], ['low', 'Poca']].map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label></p>
    <p><label>Posizione <input type="number" id="ng" min="1" max="${GALAXIES}" value="${pl.g}"> : <input type="number" id="nsys" min="1" max="${SYSTEMS}" value="${s}"> : <input type="number" id="npp" min="1" max="${SLOTS}" value="${p}"></label></p>
    <button onclick="cheatDo('npc')">Crea NPC</button>`);
}
function cheatDo(kind, a, b) {
  const pl = cur();
  if (kind === 'res') cheatRes(pl, a, b);
  else if (kind === 'time') { cheatTime(pl, a, b); advance(T()); }
  else if (kind === 'fleet') G.cheat.fleetMult = a;
  else if (kind === 'spy') G.cheat.spy = !G.cheat.spy;
  else if (kind === 'npc') {
    const err = cheatNpc(parseFloat($('#npts').value) || 1, parseInt($('#ng').value), parseInt($('#nsys').value), parseInt($('#npp').value), $('#nstyle').value, $('#nskill').value);
    if (err) return toast(err, true);
    const n = G.npcs[G.npcs.length - 1]; toast(`${n.owner} (${NPC_STYLES[n.style].name}, ${NPC_SKILLS[n.skill].name}) creato in [${n.g}:${n.s}:${n.p}] — ${nf(npcPoints(n))} punti`);
  }
  else if (kind === 'fields') cheatFields(pl, parseInt($('#cfields').value) || 1);
  save(); render();
}

// ---------- Simulatore di battaglia ----------
const SIM = { a: { ships: {}, tech: { weapons: 0, shield: 0, armour: 0 } }, d: { ships: {}, defs: {}, tech: { weapons: 0, shield: 0, armour: 0 }, res: [0, 0, 0] }, runs: 10, res: null };
const SIM_A = () => IDS.s.filter(i => !DEFS[i].noFly), SIM_DS = () => IDS.s, SIM_DD = () => IDS.d.filter(i => i !== 'ipm' && i !== 'abm');
const simNum = v => Math.max(0, Math.floor(+String(v).replace(/\./g, '')) || 0);
const myTech = () => ({ weapons: G.tech.weapons || 0, shield: G.tech.shield || 0, armour: G.tech.armour || 0 });
const simCap = ships => Object.entries(ships).reduce((s, [id, n]) => s + DEFS[id].cap * n, 0);
const sim = {
  set: (side, kind, id, v) => { SIM[side][kind][id] = simNum(v); if (!SIM[side][kind][id]) delete SIM[side][kind][id]; sim.cap(); },
  tech: (side, id, v) => { SIM[side].tech[id] = Math.min(60, simNum(v)); },
  res: (i, v) => { SIM.d.res[i] = simNum(v); },
  runs: v => { SIM.runs = Math.max(1, Math.min(500, simNum(v) || 1)); },
  cap: () => { const e = document.getElementById('simcap'); if (e) e.textContent = nf(simCap(SIM.a.ships)); },
  mine: () => { const pl = cur(); SIM.a.ships = Object.assign({}, ...SIM_A().filter(i => pl.ships[i] > 0).map(i => ({ [i]: pl.ships[i] }))); SIM.a.tech = myTech(); render(); },
  mineDef: () => { const pl = cur(); SIM.d.ships = Object.assign({}, ...SIM_DS().filter(i => pl.ships[i] > 0).map(i => ({ [i]: pl.ships[i] }))); SIM.d.defs = Object.assign({}, ...SIM_DD().filter(i => pl.defs[i] > 0).map(i => ({ [i]: pl.defs[i] }))); SIM.d.tech = myTech(); SIM.d.res = pl.res.map(Math.floor); render(); },
  clear: () => { SIM.a.ships = {}; SIM.d.ships = {}; SIM.d.defs = {}; SIM.d.res = [0, 0, 0]; SIM.res = null; render(); },
  swap: () => { const a = SIM.a, d = SIM.d; SIM.a = { ships: Object.fromEntries(Object.entries(d.ships).filter(([i]) => !DEFS[i].noFly)), tech: Object.assign({}, d.tech) }; SIM.d = { ships: Object.assign({}, a.ships), defs: {}, tech: Object.assign({}, a.tech), res: d.res }; SIM.res = null; render(); },
  run: () => {
    const A = { ships: SIM.a.ships, tech: SIM.a.tech }, D = { ships: SIM.d.ships, defs: SIM.d.defs, tech: SIM.d.tech };
    if (!Object.keys(A.ships).length || !(Object.keys(D.ships).length + Object.keys(D.defs).length)) { toast('Inserisci almeno una unità per parte.', true); return; }
    const acc = { n: 0, a: 0, d: 0, draw: 0, rounds: 0, debris: [0, 0], aLost: {}, dLost: {}, rebuilt: 0, loot: [0, 0, 0] }, t0 = performance.now();
    let one;
    while (acc.n < SIM.runs && (acc.n === 0 || performance.now() - t0 < 5000)) {
      const r = battle(A, D); one = r; acc.n++; acc[r.winner]++; acc.rounds += r.rounds; acc.debris[0] += r.debris[0]; acc.debris[1] += r.debris[1]; acc.rebuilt += r.d.rebuilt;
      if (r.winner === 'a') calcLoot(SIM.d.res, r.a.after).forEach((v, i) => acc.loot[i] += v);
      for (const [id, n] of Object.entries(r.a.lost)) acc.aLost[id] = (acc.aLost[id] || 0) + n;
      for (const [id, n] of Object.entries(r.d.lost)) acc.dLost[id] = (acc.dLost[id] || 0) + n;
    }
    SIM.res = { acc, one }; render();
  },
};
function vSim() {
  const inp = (v, fn) => `<input type="text" inputmode="numeric" value="${v ? nf(v) : ''}" placeholder="0" onchange="${fn}">`;
  const row = (id, a, d) => `<tr><td>${DEFS[id].name}</td><td>${a ? inp(SIM.a.ships[id], `sim.set('a','ships','${id}',this.value)`) : ''}</td><td>${inp(SIM[d][d === 'd' && IDS.d.includes(id) ? 'defs' : 'ships'][id], `sim.set('d','${IDS.d.includes(id) ? 'defs' : 'ships'}','${id}',this.value)`)}</td></tr>`;
  const trow = (k, n) => `<tr><td>${n}</td><td>${inp(SIM.a.tech[k], `sim.tech('a','${k}',this.value)`)}</td><td>${inp(SIM.d.tech[k], `sim.tech('d','${k}',this.value)`)}</td></tr>`;
  const head = t => `<tr class="sub"><th>${t}</th><th>Attaccante</th><th>Difensore</th></tr>`;
  const resRow = `<tr><td>Risorse del difensore</td><td colspan="2" class="simres">${['Metallo', 'Cristallo', 'Deuterio'].map((n, i) => `<label>${n[0]} <input type="text" inputmode="numeric" value="${SIM.d.res[i] ? nf(SIM.d.res[i]) : ''}" placeholder="0" onchange="sim.res(${i},this.value)"></label>`).join(' ')}</td></tr>`;
  const table = `<table class="rep simt">${head('Tecnologie')}${trow('weapons', 'Armi')}${trow('shield', 'Scudi')}${trow('armour', 'Corazza')}${resRow}
    <tr><td>Capacità di carico attaccante</td><td colspan="2"><b id="simcap">${nf(simCap(SIM.a.ships))}</b></td></tr>
    ${head('Navi')}${SIM_DS().map(i => row(i, !DEFS[i].noFly, 'd')).join('')}${head('Difese')}${SIM_DD().map(i => row(i, false, 'd')).join('')}</table>`;
  const ctl = `<div class="actions simbar"><label>Simulazioni ${`<input type="text" inputmode="numeric" value="${SIM.runs}" onchange="sim.runs(this.value)">`}</label>
    <button onclick="sim.run()">Simula</button><button class="mini" onclick="sim.mine()">Mie navi → attaccante</button><button class="mini" onclick="sim.mineDef()">Mio pianeta → difensore</button><button class="mini" onclick="sim.swap()">Scambia</button><button class="mini" onclick="sim.clear()">Azzera</button></div>`;
  let out = '';
  if (SIM.res) {
    const { acc, one } = SIM.res, n = acc.n, pc = v => (100 * v / n).toFixed(0) + '%';
    const avgUnits = o => { const e = Object.entries(o); return e.length ? e.map(([id, v]) => `${DEFS[id].name}: ${(v / n).toLocaleString('it-IT', { maximumFractionDigits: 1 })}`).join(', ') : '—'; };
    const cost = o => Object.entries(o).reduce((s, [id, v]) => s + (DEFS[id].cost[0] + DEFS[id].cost[1] + DEFS[id].cost[2]) * v / n, 0);
    const dsum = (acc.debris[0] + acc.debris[1]) / n, moon = Math.min(20, Math.floor(dsum / 100000));
    const loot = acc.loot.map(v => v / n);
    out = `<table class="rep simt simout"><tr class="sub"><th>Risultato medio su ${n} simulazion${n === 1 ? 'e' : 'i'}</th><th>Attaccante</th><th>Difensore</th></tr>
      <tr><td>Vittorie</td><td>${pc(acc.a)}</td><td>${pc(acc.d)} · pareggi ${pc(acc.draw)}</td></tr>
      <tr><td>Perdite medie</td><td>${avgUnits(acc.aLost)}</td><td>${avgUnits(acc.dLost)}</td></tr>
      <tr><td>Valore perso</td><td>${nf(cost(acc.aLost))}</td><td>${nf(cost(acc.dLost))}</td></tr>
      <tr><td>Bottino medio</td><td colspan="2">${fmtRes(loot)}${SIM.d.res.some(v => v) ? '' : ' <span class="muted">(inserisci le risorse del difensore)</span>'}</td></tr>
      <tr><td>Detriti medi</td><td colspan="2">${nf(acc.debris[0] / n)} metallo, ${nf(acc.debris[1] / n)} cristallo · luna ${moon}%${acc.rebuilt ? ` · difese ricostruite ${nf(acc.rebuilt / n)}` : ''} · round ${(acc.rounds / n).toFixed(1)}</td></tr></table>
      <details><summary>Ultima simulazione nel dettaglio (${one.winner === 'a' ? 'vince l\'attaccante' : one.winner === 'd' ? 'vince il difensore' : 'pareggio'}, ${one.rounds} round)</summary>${battleHtml(one, 'Attaccante', 'Difensore')}</details>`;
  }
  return panel('Simulatore di battaglia', ctl + out + table);
}

// ---------- Render ----------
const VIEWS = { overview: ['Panoramica', vOverview], empire: ['Impero', vEmpire], empirecheat: ['Impero cheat', vEmpireCheat], resources: ['Risorse', vResources], facilities: ['Strutture', vFacilities], research: ['Ricerca', vResearch], shipyard: ['Cantiere spaziale', vShipyard], defence: ['Difesa', vDefence], fleet: ['Flotta', vFleet], sim: ['Simulatore', vSim], galaxy: ['Galassia', vGalaxy], messages: ['Messaggi', vMessages], highscore: ['Classifica', vHighscore], tech: ['Tecnologia', vTech], options: ['Opzioni', vOptions], cheat: ['Cheat', vCheat] };
function planetList() {
  const hue = p => planetHue(p);
  let h = '<h4>Pianeti</h4>';
  for (const p of G.planets.filter(x => !x.moon)) {
    h += `<div class="pitem${p.id === G.cur ? ' sel' : ''}" onclick="act.planet(${p.id})"><span class="pthumb" style="background:radial-gradient(circle at 35% 30%,hsl(${hue(p)},60%,60%),hsl(${hue(p)},55%,28%) 55%,hsl(${hue(p)},50%,10%))"></span><div><b>${p.name}</b><small>[${p.g}:${p.s}:${p.p}]</small></div></div>`;
    for (const m of G.planets.filter(x => x.moon && x.g === p.g && x.s === p.s && x.p === p.p))
      h += `<div class="pitem moon${m.id === G.cur ? ' sel' : ''}" onclick="act.planet(${m.id})"><span class="mthumb"></span><div><b>${m.name}</b><small>Luna</small></div></div>`;
  }
  for (const m of G.planets.filter(x => x.moon && !G.planets.some(p => !p.moon && p.g === x.g && p.s === x.s && p.p === x.p)))
    h += `<div class="pitem moon${m.id === G.cur ? ' sel' : ''}" onclick="act.planet(${m.id})"><span class="mthumb"></span><div><b>${m.name}</b><small>Luna [${m.g}:${m.s}:${m.p}]</small></div></div>`;
  return h;
}
function render() {
  $('#nav').innerHTML = Object.entries(VIEWS).filter(([k]) => k !== 'cheat' && k !== 'empirecheat').map(([k, [n]]) => `<a class="${k === view ? 'on' : ''}" onclick="go('${k}')">${n}${k === 'messages' && G.unread ? ` <span class="badge">${G.unread}</span>` : ''}</a>`).join('') +
    `<div class="navbtns"><button class="go" onclick="nextTurn(1)">▶ Fine turno</button><button class="skip" onclick="nextTurn(5)" title="Passa 5 turni">×5</button><button class="skip" onclick="nextTurn(20)" title="Passa 20 turni">×20</button></div>`;
  $('#cheatbtn').classList.toggle('on', view === 'cheat');
  $('#planets').innerHTML = planetList();
  $('#main').innerHTML = VIEWS[view][1]();
  if (view === 'fleet') fleetChange();
  updateHeader();
}
function updateHeader() {
  const pl = cur(), p = calcProd(pl), cap = capacities(pl), now = T();
  const r = (i, cl, v) => `<div class="res ${cl}">${RES_ICON[RK[i]]}<span>${RN[i]}</span><b class="${pl.res[i] >= cap[i] ? 'full' : ''}">${nf(pl.res[i])}</b><small>${v >= 0 ? '+' : ''}${nf(v)}/h</small></div>`;
  $('#resbar').innerHTML = r(0, 'rm', p.m) + r(1, 'rc', p.c) + r(2, 'rd', p.d) +
    `<div class="res re">${RES_ICON.e}<span>Energia</span><b class="${p.energyProd >= p.energyUse ? '' : 'full'}">${nf(p.energyProd - p.energyUse)}</b><small>${nf(p.energyProd)}/${nf(p.energyUse)}</small></div>`;
  $('#pausebar').innerHTML = `<b>Turno ${G.turn}</b>`;
  const n = incomingRaids().length; $('#alert').innerHTML = n ? `<a onclick="go('overview')">⚠ ${n} flotta/e ostile/i</a>` : '';
  document.querySelectorAll('.cd').forEach(e => e.textContent = dur(+e.dataset.end - now));
  document.querySelectorAll('.prog i').forEach(e => { const s = +e.dataset.s, en = +e.dataset.e; e.style.width = Math.max(0, Math.min(100, (now - s) / (en - s) * 100)) + '%'; });
}

function boot() {
  if (!load()) { $('#start').hidden = false; return; }
  $('#start').hidden = true; $('#app').hidden = false;
  GV = { g: cur().g, s: cur().s };
  advance(T()); render();
  window.addEventListener('beforeunload', save);
}
function startNew() {
  newGame($('#pname').value.trim() || 'Comandante', parseInt($('#pspeed').value), parseFloat($('#pturn').value) / 60, Math.max(0, Math.min(400, parseInt($('#pnpc').value) || 0)));
  boot();
}
boot();
