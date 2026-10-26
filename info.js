// Descrizioni estese (stile enciclopedia) di edifici, ricerche, navi e difese.
const LONG = {
  metalMine: 'Il metallo è la materia prima principale per ogni costruzione: scafi, edifici e difese ne richiedono grandi quantità. Le miniere di metallo sono le strutture più economiche da potenziare ma consumano energia. Più la miniera è profonda, più produce, e più energia serve per alimentare le trivelle.',
  crystalMine: 'Il cristallo è la risorsa degli apparati elettronici e delle leghe speciali. Servono più energia e più tempo per estrarlo che per il metallo, ma nessuna ricerca e nessuna nave avanzata può farne a meno. Ogni livello aumenta la produzione oraria.',
  deutSynth: 'Il deuterio è l’idrogeno pesante che alimenta i motori delle navi e i reattori a fusione. Il sintetizzatore lo ricava dall’acqua dei mari: più il pianeta è freddo, più la resa è alta. Ogni missione di flotta e ogni scansione Phalanx ne consumano.',
  solarPlant: 'Le centrali solari trasformano la luce della stella in energia, indispensabile a miniere e sintetizzatori. Se l’energia prodotta non basta, tutte le estrazioni rallentano in proporzione. Per integrare la produzione si possono costruire anche satelliti solari.',
  fusionPlant: 'Il reattore a fusione fonde atomi di deuterio sprigionando un’enorme quantità di energia. Consuma deuterio ad ogni ora di funzionamento. La Tecnologia Energetica ne aumenta il rendimento.',
  metalStorage: 'Magazzino per il metallo estratto. Senza spazio libero la produzione non si ferma ma il metallo in eccesso non viene più accumulato: ogni livello raddoppia circa la capienza.',
  crystalStorage: 'Magazzino per il cristallo estratto. Quando è pieno, la produzione si blocca fino a che non si spende parte del cristallo. Potenziarlo aumenta la capienza massima.',
  deutTank: 'Grandi cisterne per il deuterio. Servono a non sprecare la produzione quando le scorte si riempiono e a ospitare il carburante per le missioni più lunghe.',
  robotics: 'I robot di fabbrica aiutano nella costruzione degli edifici: ogni livello riduce il tempo di costruzione. Con il Cantiere spaziale e le tecnologie giuste apre la strada alle strutture più complesse, come la Fabbrica di naniti.',
  shipyard: 'Nel cantiere spaziale si costruiscono tutte le navi e le strutture di difesa. Un cantiere di livello più alto accelera la produzione e sblocca unità sempre più potenti. Non si può potenziare mentre si costruiscono navi.',
  researchLab: 'Per condurre ricerche serve un laboratorio. Più è evoluto, più tecnologie si possono studiare e più veloci sono le ricerche. In questo gioco il laboratorio del pianeta selezionato determina la durata della ricerca.',
  nanite: 'I naniti sono la forma più avanzata della robotica: robot di dimensioni nanometriche che dimezzano il tempo di costruzione di edifici, navi e difese ad ogni livello. Una struttura costosissima, ma decisiva a lungo termine.',
  terraformer: 'Con il terraformer si rende edificabile terreno altrimenti inutilizzabile, aumentando i campi del pianeta. Consuma molta energia. Ogni livello aggiunge 5 campi. Non si può costruire sulle lune.',
  spaceDock: 'Nel porto spaziale i relitti delle navi distrutte vengono recuperati e rimessi in servizio. Quando una flotta nemica colpisce il pianeta, ogni livello ripara il 5% delle navi perse (fino al 70%). Non ripara le difese, che hanno già la loro ricostruzione automatica.',
  missileSilo: 'Il silo è la base di lancio e di stoccaggio dei missili. Ogni livello offre spazio per 5 missili interplanetari (o 10 anti-balistici). Serve per attaccare le difese di pianeti rivali a distanza.',
  lunarBase: 'La luna non ha atmosfera: la base lunare rende abitabile la superficie e genera spazio per altre costruzioni. Ogni livello aggiunge 3 campi alla luna. È la prima struttura da costruire su una luna.',
  phalanx: 'Un sensore ad alta risoluzione che analizza gli spettri di emissione dei motori nei dintorni: permette di vedere i movimenti di flotta nei sistemi vicini. Ogni scansione costa deuterio. Il raggio cresce con il livello.',
  jumpGate: 'Il portale spaziale è un gigantesco trasmettitore capace di inviare flotte di qualsiasi dimensione tra due lune dotate di portale, senza perdita di tempo né consumo di carburante. Dopo ogni salto occorre aspettare il tempo di ricarica.',

  energyTech: 'La comprensione dei vari tipi di energia è necessaria per la maggior parte delle nuove tecnologie. Aumenta il rendimento dei reattori a fusione ed è alla base della ricerca di nuovi motori, armi e scudi.',
  laserTech: 'Il laser è un raggio di luce focalizzata con grande energia. Se ne servono le armi laser, e la ricerca permette di sviluppare le tecnologie ioniche. Migliora anche le difese basate sui laser.',
  ionTech: 'Un raggio di ioni accelerati danneggia gravemente il bersaglio. Questa ricerca porta il cannone a ioni e prepara il terreno per la tecnologia al plasma. Serve anche per l’incrociatore.',
  hyperspaceTech: 'Integrando la quarta e la quinta dimensione si ottengono nuovi tipi di propulsione e di stoccaggio. Questa tecnologia è la chiave per i motori iperspaziali e per il portale spaziale.',
  plasmaTech: 'Una tecnologia evoluta dal laser e dalla ionica: usa un gas ionizzato ad altissima energia. Oltre ad armare bombardieri e cannoni al plasma, aumenta la produzione di metallo, cristallo e deuterio.',
  combustion: 'Il propulsore a combustione è il più antico tipo di motore: un razzo a reazione. Ogni livello aumenta del 10% la velocità di cargo leggeri e pesanti, caccia leggeri, riciclatrici e sonde spia.',
  impulse: 'Il propulsore a impulso funziona sul principio di reazione, ma con particelle meno ingombranti e più veloci. Ogni livello aumenta del 20% la velocità di caccia pesanti, incrociatori, bombardieri e colonizzatrici.',
  hyperDrive: 'Il propulsore iperspaziale piega lo spazio attorno alla nave. Ogni livello aumenta del 30% la velocità di navi da battaglia, corazzate, incrociatori da battaglia e Morte Nera.',
  espionage: 'Si tratta soprattutto di sensori di nuova generazione. Più alto è il livello, più informazioni portano le sonde spia. Il confronto con il livello dell’avversario determina quante informazioni si ottengono e il rischio di essere scoperti.',
  computerTech: 'Computer più potenti coordinano meglio le flotte: ogni livello aggiunge uno slot di flotta, cioè una missione in più contemporaneamente.',
  astro: 'Con l’astrofisica le navi possono compiere spedizioni verso regioni sconosciute. Ogni due livelli si può colonizzare un pianeta in più e organizzare una spedizione in più.',
  weapons: 'La tecnologia delle armi rende le armi più efficaci: ogni livello aumenta il valore d’attacco di tutte le unità del 10%.',
  shield: 'La tecnologia degli scudi usa generatori di campo per proteggere navi e difese: ogni livello aumenta il valore di scudo di tutte le unità del 10%.',
  armour: 'Leghe speciali rendono più resistenti gli scafi: ogni livello aumenta del 10% la struttura di tutte le navi e difese.',

  smallCargo: 'Il cargo leggero è una nave grande circa il doppio di un caccia leggero, con un propulsore a combustione e molto spazio per le merci. Quando la Tecnologia a impulso raggiunge il livello 5 passa all’impulso. Perfetto per i primi trasporti e per il saccheggio.',
  largeCargo: 'Evoluzione del cargo leggero: scafo più grande, più capacità, più resistenza. Trasporta molte più risorse a un costo di carburante ragionevole.',
  lightFighter: 'Il caccia leggero è una nave molto diffusa per via del costo contenuto. Non è molto robusto, ma in gran numero diventa pericoloso. Spesso accompagna le flotte con ruolo di scudo.',
  heavyFighter: 'Evoluzione del caccia leggero: scafo corazzato e armi più potenti. Montano il propulsore a impulso e sono molto richiesti nelle flotte di media taglia.',
  cruiser: 'Gli incrociatori hanno una corazza tre volte più forte dei caccia pesanti e una potenza di fuoco più che doppia. Sono molto veloci e hanno il fuoco rapido contro caccia leggeri e lanciamissili.',
  battleship: 'Le navi da battaglia sono la spina dorsale di ogni flotta. Hanno cannoni pesanti, scafo robusto e grande velocità, oltre a una buona capacità di carico.',
  colonyShip: 'La nave colonia serve a colonizzare pianeti liberi. Si consuma nella missione e trasporta le prime risorse per avviare la nuova colonia. Il numero di pianeti dipende dall’Astrofisica.',
  recycler: 'Le riciclatrici raccolgono rottami e risorse dai campi di detriti rimasti dopo le battaglie. Hanno grande capacità e sono lente: servono a trasformare il disastro in profitto.',
  probe: 'Le sonde spia sono piccoli droni velocissimi con un sofisticato sistema di sensori. Trasmettono i dati su flotte, difese, edifici e risorse del bersaglio. Muoiono se scoperte.',
  bomber: 'Il bombardiere è stato sviluppato per distruggere le difese planetarie. Una mira laser lo guida con grande precisione. Ha fuoco rapido contro la maggior parte delle difese.',
  destroyer: 'La corazzata è la più pesante delle navi da guerra. Con la sua potenza di fuoco e lo scafo massiccio è il terrore di laser e incrociatori da battaglia.',
  battlecruiser: 'L’incrociatore da battaglia è specializzato nell’intercettare le flotte nemiche. Con armi laser potenti e grande velocità ha fuoco rapido contro cargo, caccia pesanti, incrociatori e navi da battaglia.',
  reaper: 'La Mietitrice è un incrociatore pesante da battaglia che unisce potenza di fuoco e recupero: può raccogliere i detriti come una riciclatrice. Ha fuoco rapido contro navi da battaglia, bombardieri e corazzate, ma è lenta.',
  pathfinder: 'L’Esploratore è una nave veloce con ampia stiva, progettata per le spedizioni nello spazio profondo. Ogni Esploratore in una spedizione aumenta del 2% le risorse trovate (fino a +100%).',
  crawler: 'Il Crawler è un veicolo minerario da superficie: ogni esemplare aumenta dello 0,02% la produzione di metallo, cristallo e deuterio, fino a +50%. Se ne possono usare al massimo 8 per ogni livello di miniera. Non vola, non va sulle lune ed è debolissimo in combattimento.',
  deathstar: 'La Morte Nera ha un cannone di potenza immensa, capace di annientare intere flotte e lune. È costosissima, lentissima e ha un fuoco rapido contro quasi ogni unità.',
  solarSat: 'I satelliti solari orbitano sul pianeta e trasformano la luce solare in energia, trasmessa a terra via laser. L’energia di ciascuno dipende dalla temperatura del pianeta. Sono fragili e non si possono inviare in missione.',

  rocket: 'Il lanciamissili è una struttura di difesa semplice ed economica. Per via del costo contenuto è efficiente contro attacchi in massa, ma debole contro le armi più avanzate.',
  lightLaser: 'Il laser leggero concentra i fotoni in un raggio sottile, capace di danneggiare lo scafo dei bersagli leggeri. Costa poco e resiste meglio dei lanciamissili.',
  heavyLaser: 'Evoluzione del laser leggero: scudi più forti, scafo più robusto e raggio più potente. La difesa media di molti pianeti.',
  gauss: 'Il cannone Gauss accelera enormi proiettili con potenti elettromagneti. Ha un forte potere d’urto anche contro navi pesanti.',
  ion: 'Il cannone a ioni spara un fascio di ioni che sovraccarica i sistemi elettronici. Ha scudi molto forti, per questo è usato per assorbire danni.',
  plasma: 'La torretta al plasma è la difesa più potente. Rilascia scariche di plasma ad alta energia con enorme capacità distruttiva.',
  smallDome: 'La cupola scudo piccola avvolge l’intero pianeta in un campo energetico che assorbe enormi quantità di danni. Se ne può costruire solo una per pianeta.',
  largeDome: 'Evoluzione della cupola piccola: assorbe ancora più danni. Se ne può costruire solo una per pianeta.',
  abm: 'I missili anti-balistici sono lanciati dal silo per intercettare i missili interplanetari nemici: ciascuno ne abbatte uno. Occupano metà posto di un missile interplanetario nel silo (10 posti per livello). Non partecipano alle battaglie.',
  ipm: 'I missili interplanetari distruggono le difese del nemico. Le difese distrutte non si ricostruiscono. Si lanciano da un silo dentro il raggio di portata dato dal Propulsore a impulso.',
};
for (const [id, t] of Object.entries(LONG)) if (DEFS[id]) DEFS[id].desc = t;

// Elenco di ciò che richiede un certo elemento (applicazioni nell’albero)
const UNLOCKS = {};
for (const id of Object.keys(DEFS)) for (const k of Object.keys(DEFS[id].req)) (UNLOCKS[k] = UNLOCKS[k] || []).push(id);

// Note aggiuntive: a cosa serve oltre a sbloccare altre voci
const USES = {
  metalMine: 'Metallo per tutte le costruzioni.', crystalMine: 'Cristallo per ricerche, elettronica e navi avanzate.', deutSynth: 'Carburante per le flotte e per i reattori a fusione.',
  solarPlant: 'Energia per miniere e sintetizzatore.', fusionPlant: 'Energia extra al prezzo di deuterio.', robotics: 'Tempi di costruzione edifici ridotti.', shipyard: 'Costruzione di navi e difese; velocità di produzione.',
  researchLab: 'Ricerca di tecnologie; velocità di ricerca.', nanite: 'Tempi di costruzione dimezzati per livello.', terraformer: '+5 campi per livello.', missileSilo: 'Stoccaggio di 5 missili per livello.',
  spaceDock: 'Ripara il 5% per livello delle navi perse in difesa.', lunarBase: '+3 campi per livello sulla luna.', phalanx: 'Scansione dei movimenti di flotta nei sistemi vicini.', jumpGate: 'Salti istantanei di flotta tra lune.',
  energyTech: 'Più energia dai reattori a fusione.', plasmaTech: '+1% metallo, +0,66% cristallo, +0,33% deuterio per livello.', combustion: '+10% velocità alle navi a combustione.', impulse: '+20% velocità alle navi a impulso; raggio dei missili.',
  hyperDrive: '+30% velocità alle navi iperspaziali.', espionage: 'Rapporti di spionaggio più dettagliati.', computerTech: '+1 slot flotta.', astro: 'Più colonie e spedizioni.',
  reaper: 'Raccoglie detriti (capacità 10.000); fuoco rapido contro navi pesanti.', pathfinder: 'Spedizioni: +2% risorse trovate per nave (max +100%).', crawler: '+0,02% produzione miniere (max +50%).',
  abm: 'Intercetta un missile interplanetario nemico ciascuno.',
  weapons: '+10% attacco.', shield: '+10% scudi.', armour: '+10% struttura.',
};

function statsLine(id) {
  const d = DEFS[id], n = x => x.toLocaleString('it-IT');
  if (d.type !== 's' && d.type !== 'd') return '';
  let h = `Attacco <b>${n(d.atk)}</b> · Scudo <b>${n(d.shield)}</b> · Struttura <b>${n(d.hull)}</b>`;
  if (d.cap) h += ` · Capacità <b>${n(d.cap)}</b>`;
  if (d.speed && !d.noFly) h += ` · Velocità <b>${n(d.speed)}</b> · Consumo <b>${n(d.fuel)}</b>`;
  h += ` · Costo <b>${d.cost.map(n).join(' / ')}</b>`;
  const rf = Object.entries(RF[id] || {}).map(([t, v]) => `${DEFS[t].name} ×${v}`);
  const rfBy = Object.entries(RF).filter(([a, m]) => m[id] && a !== id).map(([a, m]) => `${DEFS[a].name} ×${m[id]}`);
  if (rf.length) h += `<br>Fuoco rapido contro: ${rf.join(', ')}`;
  if (rfBy.length) h += `<br>Subisce fuoco rapido da: ${rfBy.join(', ')}`;
  return `<div class="nums">${h}</div>`;
}
const DRIVES = { c: ['Combustione', 'combustion', 0.1], i: ['Impulso', 'impulse', 0.2], h: ['Iperspaziale', 'hyperDrive', 0.3] };
// Informazioni importanti su una nave o difesa: fuoco rapido, motore, valori con le ricerche attuali.
function unitFacts(id, pl) {
  const d = DEFS[id]; if (d.type !== 's' && d.type !== 'd') return '';
  const n = x => x.toLocaleString('it-IT'), T = G.tech, dn = t => DEFS[t].name;
  const rf = Object.entries(RF[id] || {}).map(([t, v]) => `${dn(t)} ×${v} <small class="muted">(${Math.round((1 - 1 / v) * 100)}%)</small>`);
  const rfBy = Object.entries(RF).filter(([a, m]) => m[id] && a !== id).map(([a, m]) => `${dn(a)} ×${m[id]}`);
  let h = '<div class="facts">';
  h += `<div><b>Fuoco rapido contro:</b> ${rf.length ? rf.join(', ') : '<span class="muted">nessuno</span>'}</div>`;
  h += `<div><b>Subisce fuoco rapido da:</b> ${rfBy.length ? rfBy.join(', ') : '<span class="muted">nessuno</span>'}</div>`;
  const w = 1 + 0.1 * (T.weapons || 0), s = 1 + 0.1 * (T.shield || 0), a = 1 + 0.1 * (T.armour || 0);
  h += `<div><b>Con le tue ricerche:</b> attacco ${n(Math.round(d.atk * w))} · scudo ${n(Math.round(d.shield * s))} · struttura ${n(Math.round(d.hull * a))}</div>`;
  if (d.type === 's' && !d.noFly) {
    const [dname, tech, per] = DRIVES[d.drive];
    h += `<div><b>Motore:</b> ${dname} (+${Math.round(per * 100)}% per livello, livello ${T[tech] || 0}) · velocità base ${n(d.speed)} → <b>${n(Math.round(shipSpeed(id)))}</b> · consumo ${n(d.fuel)} · capacità ${n(d.cap)}</div>`;
  }
  if (d.noFly) h += `<div><b>Nota:</b> non può volare${d.where === 'p' ? ' né stare sulle lune' : ''}.</div>`;
  const eff = d.atk > 1 ? (d.atk * w) / ((d.cost[0] + d.cost[1] + d.cost[2]) / 1000) : 0;
  if (eff) h += `<div><b>Efficienza:</b> ${n(Math.round(eff))} attacco ogni 1.000 risorse spese</div>`;
  const extra = { reaper: 'Può raccogliere i campi di detriti (come una riciclatrice).', pathfinder: 'In spedizione: +2% risorse trovate per ogni Esploratore (max +100%).', recycler: 'Raccoglie i campi di detriti.', ipm: 'Occupa 2 posti nel silo (10 per livello). Distrugge le difese di un pianeta NPC.', abm: 'Occupa 1 posto nel silo (10 per livello). Intercetta un missile interplanetario in arrivo sul pianeta.', crawler: pl ? `Bonus attuale su questo pianeta: +${((crawlerBonus(pl) - 1) * 100).toFixed(2)}% (usabili ${n(crawlerUsed(pl))} su ${n(crawlerMax(pl))}).` : '', colonyShip: 'Si consuma fondando una colonia.', probe: 'Per spiare i pianeti NPC.' }[id];
  if (extra) h += `<div><b>Speciale:</b> ${extra}</div>`;
  return h + '</div>';
}
// Effetti di una ricerca in base al livello attuale.
function techFacts(id) {
  if (DEFS[id].type !== 't') return '';
  const T = G.tech, lv = T[id] || 0, drv = Object.entries(DRIVES).find(([, v]) => v[1] === id);
  let h = '';
  if (drv) h = `<div><b>Livello ${lv}:</b> navi +${Math.round(drv[1][2] * lv * 100)}% di velocità.</div><div><b>Navi interessate:</b> ${IDS.s.filter(i => DEFS[i].drive === drv[0] && !DEFS[i].noFly).map(i => DEFS[i].name).join(', ')}</div>`;
  else if (id === 'weapons') h = `<div><b>Livello ${lv}:</b> +${lv * 10}% attacco a tutte le tue navi e difese.</div>`;
  else if (id === 'shield') h = `<div><b>Livello ${lv}:</b> +${lv * 10}% scudi a tutte le tue navi e difese.</div>`;
  else if (id === 'armour') h = `<div><b>Livello ${lv}:</b> +${lv * 10}% struttura a tutte le tue navi e difese.</div>`;
  else if (id === 'computerTech') h = `<div><b>Livello ${lv}:</b> ${lv} slot flotta in più.</div>`;
  else if (id === 'astro') h = `<div><b>Livello ${lv}:</b> più colonie e spedizioni; bonus alle risorse trovate in spedizione.</div>`;
  else if (id === 'plasmaTech') h = `<div><b>Livello ${lv}:</b> produzione +${lv}% metallo, +${(lv * 0.66).toFixed(2)}% cristallo, +${(lv * 0.33).toFixed(2)}% deuterio.</div>`;
  else if (id === 'espionage') h = `<div><b>Livello ${lv}:</b> più dettagli nei rapporti delle sonde.</div>`;
  return h ? `<div class="facts">${h}</div>` : '';
}
function infoRow(id, pl) {
  const d = DEFS[id], ok = meets(pl, id), un = (UNLOCKS[id] || []).map(u => DEFS[u].name);
  const r = Object.keys(d.req).length ? reqText(pl, id) : '<span class="ok">Nessuno</span>';
  return `<tr class="${ok ? '' : 'lockedrow'}"><td class="ic" onclick="openTree('${id}')">${icon(id, 's')}</td><td><b class="lk" onclick="openTree('${id}')">${d.name}</b>${USES[id] ? `<div class="muted">${USES[id]}</div>` : ''}</td><td class="dsc">${d.desc}${statsLine(id)}</td><td>${r}</td><td class="muted">${un.length ? un.join(', ') : '—'}</td></tr>`;
}
