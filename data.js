// Definizioni di gioco: edifici, ricerche, navi, difese. Costi e formule seguono le dinamiche classiche di OGame.
const DEFS = {};
const IDS = { b: [], t: [], s: [], d: [] };
function def(type, id, name, icon, cost, f, req, extra) {
  const o = Object.assign({ id, type, name, icon, cost, f: f || 1, req: req || {} }, extra);
  if (type === 's' || type === 'd') o.hull = (cost[0] + cost[1]) / 10;
  DEFS[id] = o; IDS[type].push(id);
}

// ---- Edifici (grp: res = risorse, fac = strutture) ----
def('b', 'metalMine', 'Miniera di metallo', '⛏️', [60, 15, 0], 1.5, {}, { grp: 'res', desc: 'Estrae metallo, la risorsa base per ogni costruzione.' });
def('b', 'crystalMine', 'Miniera di cristallo', '💎', [48, 24, 0], 1.6, {}, { grp: 'res', desc: 'Estrae cristallo, necessario per elettronica e ricerche.' });
def('b', 'deutSynth', 'Sintetizzatore di deuterio', '🛢️', [225, 75, 0], 1.5, {}, { grp: 'res', desc: 'Produce deuterio, il carburante delle navi. Rende di più nei pianeti freddi.' });
def('b', 'solarPlant', 'Centrale solare', '☀️', [75, 30, 0], 1.5, {}, { grp: 'res', desc: 'Produce energia per le miniere.' });
def('b', 'fusionPlant', 'Reattore a fusione', '⚛️', [900, 360, 180], 1.8, { deutSynth: 5, energyTech: 3 }, { grp: 'res', desc: 'Produce molta energia consumando deuterio.' });
def('b', 'metalStorage', 'Magazzino di metallo', '📦', [1000, 0, 0], 2, {}, { grp: 'res', desc: 'Aumenta la capienza massima del metallo.' });
def('b', 'crystalStorage', 'Magazzino di cristallo', '📦', [1000, 500, 0], 2, {}, { grp: 'res', desc: 'Aumenta la capienza massima del cristallo.' });
def('b', 'deutTank', 'Serbatoio di deuterio', '🛢️', [1000, 1000, 0], 2, {}, { grp: 'res', desc: 'Aumenta la capienza massima del deuterio.' });
def('b', 'robotics', 'Fabbrica di robot', '🤖', [400, 120, 200], 2, {}, { grp: 'fac', desc: 'Riduce i tempi di costruzione degli edifici.' });
def('b', 'shipyard', 'Cantiere spaziale', '🏗️', [400, 200, 100], 2, { robotics: 2 }, { grp: 'fac', desc: 'Costruisce navi e difese; più è alto, più sono veloci.' });
def('b', 'researchLab', 'Laboratorio di ricerca', '🔬', [200, 400, 200], 2, {}, { grp: 'fac', desc: 'Sblocca le ricerche e ne riduce la durata.' });
def('b', 'nanite', 'Fabbrica di naniti', '🧬', [1000000, 500000, 100000], 2, { robotics: 10, computerTech: 10 }, { grp: 'fac', desc: 'Dimezza i tempi di costruzione per ogni livello.' });
def('b', 'terraformer', 'Terraformer', '🌍', [0, 50000, 100000], 2, { nanite: 1, energyTech: 12 }, { grp: 'fac', desc: 'Aggiunge 5 campi edificabili per livello.' });
def('b', 'missileSilo', 'Silo missilistico', '🚀', [20000, 20000, 1000], 2, { shipyard: 1 }, { grp: 'fac', desc: 'Custodisce i missili interplanetari: 5 per livello.' });
def('b', 'lunarBase', 'Base lunare', '🌙', [20000, 40000, 20000], 2, {}, { grp: 'fac', desc: 'Rende abitabile la luna: +3 campi per livello.' });
def('b', 'phalanx', 'Falange dei sensori', '📶', [20000, 40000, 20000], 2, { lunarBase: 1 }, { grp: 'fac', desc: 'Scansiona i movimenti di flotta nei sistemi vicini (raggio livello² − 1 sistemi). Costa 5.000 deuterio a scansione.' });
def('b', 'jumpGate', 'Porta di salto', '🌀', [2000000, 4000000, 2000000], 2, { lunarBase: 1, hyperspaceTech: 7 }, { grp: 'fac', desc: 'Sposta flotte istantaneamente tra due lune con porta. Ricarica: 1 ora di gioco.' });
['metalMine', 'crystalMine', 'deutSynth', 'solarPlant', 'fusionPlant', 'researchLab', 'nanite', 'terraformer', 'missileSilo'].forEach(i => DEFS[i].where = 'p');
['lunarBase', 'phalanx', 'jumpGate'].forEach(i => DEFS[i].where = 'm');

// ---- Ricerche ----
def('t', 'energyTech', 'Tecnologia energetica', '⚡', [0, 800, 400], 2, { researchLab: 1 }, { desc: 'Base di tutte le tecnologie avanzate; potenzia i reattori a fusione.' });
def('t', 'laserTech', 'Tecnologia laser', '🔴', [200, 100, 0], 2, { researchLab: 1, energyTech: 2 }, { desc: 'Concentra la luce in raggi distruttivi.' });
def('t', 'ionTech', 'Tecnologia ionica', '🟣', [1000, 300, 100], 2, { researchLab: 4, energyTech: 4, laserTech: 5 }, { desc: 'Raggi di ioni accelerati.' });
def('t', 'hyperspaceTech', 'Tecnologia iperspaziale', '🌀', [0, 4000, 2000], 2, { researchLab: 7, energyTech: 5, shield: 5 }, { desc: 'Piega lo spazio-tempo; sblocca i motori a propulsione iperspaziale.' });
def('t', 'plasmaTech', 'Tecnologia al plasma', '🔥', [2000, 4000, 1000], 2, { researchLab: 4, energyTech: 8, laserTech: 10, ionTech: 5 }, { desc: 'Aumenta la produzione di metallo, cristallo e deuterio.' });
def('t', 'combustion', 'Propulsore a combustione', '🚀', [400, 0, 600], 2, { researchLab: 1, energyTech: 1 }, { desc: '+10% velocità per livello alle navi a combustione.' });
def('t', 'impulse', 'Propulsore a impulso', '🛸', [2000, 4000, 600], 2, { researchLab: 2, energyTech: 1 }, { desc: '+20% velocità per livello alle navi a impulso.' });
def('t', 'hyperDrive', 'Propulsore iperspaziale', '🌌', [10000, 20000, 6000], 2, { researchLab: 7, hyperspaceTech: 3 }, { desc: '+30% velocità per livello alle navi iperspaziali.' });
def('t', 'espionage', 'Tecnologia di spionaggio', '🕵️', [200, 1000, 200], 2, { researchLab: 3 }, { desc: 'Migliora le sonde: più informazioni nei rapporti.' });
def('t', 'computerTech', 'Tecnologia informatica', '💻', [0, 400, 600], 2, { researchLab: 1 }, { desc: '+1 slot flotta per livello.' });
def('t', 'astro', 'Astrofisica', '🔭', [4000, 8000, 4000], 1.75, { espionage: 4, impulse: 3 }, { desc: 'Permette di colonizzare più pianeti e inviare più spedizioni.' });
def('t', 'weapons', 'Tecnologia delle armi', '🗡️', [800, 200, 0], 2, { researchLab: 4 }, { desc: '+10% attacco per livello.' });
def('t', 'shield', 'Tecnologia degli scudi', '🛡️', [200, 600, 0], 2, { researchLab: 6, energyTech: 3 }, { desc: '+10% scudi per livello.' });
def('t', 'armour', 'Tecnologia della corazza', '🧱', [1000, 0, 0], 2, { researchLab: 2 }, { desc: '+10% struttura per livello.' });

// ---- Navi ----
// drive: c = combustione, i = impulso, h = iperspaziale
def('s', 'smallCargo', 'Cargo leggero', '🚚', [2000, 2000, 0], 1, { shipyard: 2, combustion: 2 }, { atk: 5, shield: 10, speed: 5000, cap: 5000, fuel: 10, drive: 'c', desc: 'Trasporto agile ed economico.' });
def('s', 'largeCargo', 'Cargo pesante', '🚛', [6000, 6000, 0], 1, { shipyard: 4, combustion: 6 }, { atk: 5, shield: 25, speed: 7500, cap: 25000, fuel: 50, drive: 'c', desc: 'Cinque volte la capienza del cargo leggero.' });
def('s', 'lightFighter', 'Caccia leggero', '✈️', [3000, 1000, 0], 1, { shipyard: 1, combustion: 1 }, { atk: 50, shield: 10, speed: 12500, cap: 50, fuel: 20, drive: 'c', desc: 'Nave da guerra economica.' });
def('s', 'heavyFighter', 'Caccia pesante', '🛩️', [6000, 4000, 0], 1, { shipyard: 3, impulse: 2, armour: 2 }, { atk: 150, shield: 25, speed: 10000, cap: 100, fuel: 75, drive: 'i', desc: 'Corazzato e letale in massa.' });
def('s', 'cruiser', 'Incrociatore', '🚀', [20000, 7000, 2000], 1, { shipyard: 5, impulse: 4, ionTech: 2 }, { atk: 400, shield: 50, speed: 15000, cap: 800, fuel: 300, drive: 'i', desc: 'Specializzato contro caccia e lanciamissili.' });
def('s', 'battleship', 'Nave da battaglia', '⚔️', [45000, 15000, 0], 1, { shipyard: 7, hyperDrive: 4 }, { atk: 1000, shield: 200, speed: 10000, cap: 1500, fuel: 500, drive: 'h', desc: 'Pilastro delle grandi flotte.' });
def('s', 'colonyShip', 'Nave colonia', '🌱', [10000, 20000, 10000], 1, { shipyard: 4, impulse: 3 }, { atk: 50, shield: 100, speed: 2500, cap: 7500, fuel: 1000, drive: 'i', desc: 'Fonda una colonia su un pianeta libero. Si consuma.' });
def('s', 'recycler', 'Riciclatore', '♻️', [10000, 6000, 2000], 1, { shipyard: 4, combustion: 6, shield: 2 }, { atk: 1, shield: 10, speed: 2000, cap: 20000, fuel: 300, drive: 'c', desc: 'Raccoglie i campi di detriti.' });
def('s', 'probe', 'Sonda spia', '📡', [0, 1000, 0], 1, { shipyard: 3, combustion: 3, espionage: 2 }, { atk: 0, shield: 0, speed: 100000000, cap: 5, fuel: 1, drive: 'c', desc: 'Veloce e fragile; per spiare i pianeti.' });
def('s', 'bomber', 'Bombardiere', '💣', [50000, 25000, 15000], 1, { shipyard: 8, impulse: 6, plasmaTech: 5 }, { atk: 1000, shield: 500, speed: 4000, cap: 500, fuel: 700, drive: 'i', desc: 'Demolisce le difese planetarie.' });
def('s', 'destroyer', 'Corazzata', '🛳️', [60000, 50000, 15000], 1, { shipyard: 9, hyperDrive: 6, hyperspaceTech: 5 }, { atk: 2000, shield: 500, speed: 5000, cap: 2000, fuel: 1000, drive: 'h', desc: 'Il terrore dei laser e degli incrociatori da battaglia.' });
def('s', 'battlecruiser', 'Incrociatore da battaglia', '🦅', [30000, 40000, 15000], 1, { shipyard: 8, hyperDrive: 5, hyperspaceTech: 5, laserTech: 12 }, { atk: 700, shield: 400, speed: 10000, cap: 750, fuel: 250, drive: 'h', desc: 'Intercetta e distrugge le flotte di navi.' });
def('s', 'deathstar', 'Morte nera', '🌑', [5000000, 4000000, 1000000], 1, { shipyard: 12, hyperDrive: 7, hyperspaceTech: 6 }, { atk: 200000, shield: 50000, speed: 100, cap: 1000000, fuel: 1, drive: 'h', desc: 'L\'arma definitiva. Lentissima.' });
def('s', 'solarSat', 'Satellite solare', '🛰️', [0, 2000, 500], 1, { shipyard: 1 }, { atk: 1, shield: 1, speed: 0, cap: 0, fuel: 0, drive: 'c', noFly: true, desc: 'Produce energia in orbita (non si può inviare).' });

// ---- Difese ----
def('d', 'rocket', 'Lanciamissili', '🎯', [2000, 0, 0], 1, { shipyard: 1 }, { atk: 80, shield: 20, desc: 'Difesa economica.' });
def('d', 'lightLaser', 'Laser leggero', '🔦', [1500, 500, 0], 1, { shipyard: 2, energyTech: 1, laserTech: 3 }, { atk: 100, shield: 25, desc: 'Torretta laser leggera.' });
def('d', 'heavyLaser', 'Laser pesante', '🔆', [6000, 2000, 0], 1, { shipyard: 4, energyTech: 3, laserTech: 6 }, { atk: 250, shield: 100, desc: 'Torretta laser corazzata.' });
def('d', 'gauss', 'Cannone Gauss', '🧲', [20000, 15000, 2000], 1, { shipyard: 6, energyTech: 6, weapons: 3, shield: 1 }, { atk: 1100, shield: 200, desc: 'Proiettili accelerati magneticamente.' });
def('d', 'ion', 'Cannone ionico', '🌩️', [5000, 3000, 0], 1, { shipyard: 4, ionTech: 4 }, { atk: 150, shield: 500, desc: 'Scudi molto resistenti.' });
def('d', 'plasma', 'Torretta al plasma', '☄️', [50000, 50000, 30000], 1, { shipyard: 8, plasmaTech: 7 }, { atk: 3000, shield: 300, desc: 'La difesa più potente.' });
def('d', 'smallDome', 'Cupola scudo piccola', '🔵', [10000, 10000, 0], 1, { shipyard: 1, shield: 2 }, { atk: 1, shield: 2000, max: 1, desc: 'Un solo esemplare per pianeta.' });
def('d', 'largeDome', 'Cupola scudo grande', '🟦', [50000, 50000, 0], 1, { shipyard: 6, shield: 6 }, { atk: 1, shield: 10000, max: 1, desc: 'Un solo esemplare per pianeta.' });
def('d', 'ipm', 'Missile interplanetario', '🧨', [12500, 2500, 10000], 1, { missileSilo: 4, impulse: 1 }, { atk: 12000, shield: 1, missile: true, desc: 'Distrugge le difese di un pianeta NPC (raggio: 2 × impulso − 1 sistemi). Richiede spazio nel silo.' });

// Rapid fire: RF[attaccante][bersaglio] = n  (probabilità (n-1)/n di sparare ancora)
const RF = {
  smallCargo: { probe: 5 }, largeCargo: { probe: 5 }, lightFighter: { probe: 5 },
  heavyFighter: { probe: 5, smallCargo: 3 },
  cruiser: { probe: 5, lightFighter: 6, rocket: 10 },
  battleship: { probe: 5 }, colonyShip: { probe: 5 }, recycler: { probe: 5 },
  bomber: { probe: 5, rocket: 20, lightLaser: 20, heavyLaser: 10, ion: 10, gauss: 5 },
  destroyer: { probe: 5, lightLaser: 10, battlecruiser: 2 },
  battlecruiser: { probe: 5, smallCargo: 3, largeCargo: 3, heavyFighter: 4, cruiser: 4, battleship: 7 },
  deathstar: { probe: 1250, smallCargo: 250, largeCargo: 250, lightFighter: 200, heavyFighter: 100, cruiser: 33, battleship: 30,
    colonyShip: 250, recycler: 250, bomber: 25, destroyer: 5, battlecruiser: 15, rocket: 200, lightLaser: 200, heavyLaser: 100, gauss: 50, ion: 100 },
};

// Nomi italiani standard
const NAMES = {
  metalMine: 'Miniera di metallo', crystalMine: 'Miniera di cristallo', deutSynth: 'Sintetizzatore di deuterio', solarPlant: 'Centrale solare', fusionPlant: 'Centrale a fusione',
  metalStorage: 'Deposito di metallo', crystalStorage: 'Deposito di cristallo', deutTank: 'Cisterna di deuterio', robotics: 'Fabbrica dei robot', shipyard: 'Cantiere spaziale',
  researchLab: 'Laboratorio di ricerca', nanite: 'Fabbrica di naniti', terraformer: 'Terraformer', missileSilo: 'Silo missilistico', lunarBase: 'Base lunare', phalanx: 'Sensore Phalanx', jumpGate: 'Portale spaziale',
  energyTech: 'Tecnologia Energetica', laserTech: 'Tecnologia Laser', ionTech: 'Tecnologia Ionica', hyperspaceTech: 'Tecnologia Iperspaziale', plasmaTech: 'Tecnologia Plasma',
  combustion: 'Propulsore a combustione', impulse: 'Propulsore a impulso', hyperDrive: 'Propulsore Iperspaziale', espionage: 'Tecnologia Spionaggio', computerTech: 'Tecnologia Computer',
  astro: 'Astrofisica', weapons: 'Tecnologia Armi', shield: 'Tecnologia Scudo', armour: 'Tecnologia Corazza',
  smallCargo: 'Cargo leggero', largeCargo: 'Cargo pesante', lightFighter: 'Caccia leggero', heavyFighter: 'Caccia pesante', cruiser: 'Incrociatore', battleship: 'Nave da battaglia',
  colonyShip: 'Colonizzatrice', recycler: 'Riciclatrice', probe: 'Sonda spia', bomber: 'Bombardiere', destroyer: 'Corazzata', battlecruiser: 'Incrociatore da battaglia', deathstar: 'Morte Nera', solarSat: 'Satellite solare',
  rocket: 'Lanciamissili', lightLaser: 'Laser leggero', heavyLaser: 'Laser pesante', gauss: 'Cannone di Gauss', ion: 'Cannone a ioni', plasma: 'Cannone al plasma', smallDome: 'Cupola scudo piccola', largeDome: 'Cupola scudo grande', ipm: 'Missile interplanetario',
};
for (const [id, n] of Object.entries(NAMES)) DEFS[id].name = n;
