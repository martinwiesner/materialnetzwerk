/**
 * Adds `name_de` and `category_de` fields to idemat.json entries so that
 * German search terms find the correct processes.
 *
 * Can be run standalone:   node scripts/translate-idemat.js
 * Or imported and called:  import { addGermanKeywords } from './translate-idemat.js';
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(__dirname, '../data/idemat.json');

// ── Category translations ────────────────────────────────────────────────────
const CATEGORY_DE = {
  'agriculture':                   'Landwirtschaft Agrarprodukte',
  'building materials':            'Baustoffe Baumaterialien Bauwesen',
  'ceramics':                      'Keramik keramische Werkstoffe',
  'chem proxi':                    'Chemische Näherungswerte Proxys',
  'chemicals':                     'Chemikalien chemische Stoffe',
  'electricity':                   'Strom Elektrizität Energie',
  'electricity Canada':            'Strom Kanada Elektrizität',
  'electricity China':             'Strom China Elektrizität',
  'electricity EU':                'Strom Europa EU Elektrizität',
  'electricity India':             'Strom Indien Elektrizität',
  'electricity Rest of the World': 'Strom Rest Welt Elektrizität',
  'electricity USA':               'Strom USA Amerika Elektrizität',
  'electricity general industry':  'Strom allgemeine Industrie Elektrizität',
  'electronics':                   'Elektronik elektronische Geräte Bauteile',
  'end-of-life':                   'Entsorgung Lebensende Recycling Abfall Verwertung',
  'fibres':                        'Fasern Verstärkungsfasern technische Fasern',
  'food':                          'Lebensmittel Nahrungsmittel Essen Ernährung',
  'fuels':                         'Kraftstoffe Brennstoffe Treibstoffe',
  'glass':                         'Glas Glaswerkstoffe',
  'heat':                          'Wärme Heizung Wärmeenergie',
  'laminates':                     'Laminate Verbundwerkstoffe',
  'metals, ferro':                 'Metalle Eisenmetalle Stahl Eisen Gusseisen',
  'metals, non-ferro':             'Metalle Nichteisenmetalle NE-Metalle',
  'paper & packaging':             'Papier Verpackung Karton Pappe',
  'plastics':                      'Kunststoffe Plastik Polymere',
  'processing metals':             'Metallbearbeitung Metallverarbeitung Fertigungsverfahren',
  'scope 1 & downsrtream':         'Scope 1 Downstream Direktemissionen direkte Emissionen',
  'textile':                       'Textilien Gewebe Stoffe',
  'transport':                     'Transport Logistik Beförderung Verkehr',
  'water':                         'Wasser Wasserversorgung',
  'windfarms':                     'Windkraft Windenergieanlagen Windturbinen Windrad',
  'wood':                          'Holz Holzwerkstoffe',
};

// ── Multi-word phrases (checked before single words) ─────────────────────────
const PHRASES = [
  ['natural gas',          'Erdgas'],
  ['carbon fibre',         'Kohlefaser Carbonfaser'],
  ['carbon fiber',         'Kohlefaser Carbonfaser'],
  ['carbon fibres',        'Kohlefasern Carbonfasern'],
  ['cast iron',            'Gusseisen'],
  ['stainless steel',      'Edelstahl rostfreier Stahl'],
  ['wind turbine',         'Windturbine Windrad'],
  ['wind farm',            'Windpark'],
  ['glass wool',           'Glaswolle'],
  ['rock wool',            'Steinwolle Mineralwolle'],
  ['recycled paper',       'Recyclingpapier'],
  ['drinking water',       'Trinkwasser'],
  ['cooling water',        'Kühlwasser'],
  ['heat pump',            'Wärmepumpe'],
  ['solar panel',          'Solarpanel Solarmodul'],
  ['solar cell',           'Solarzelle'],
  ['pv cell',              'Solarzelle Photovoltaikzelle'],
  ['palm oil',             'Palmöl'],
  ['palm kernel',          'Palmkern'],
  ['soybean meal',         'Sojaschrot'],
  ['natural forest',       'Naturwald'],
  ['deep drawing',         'Tiefziehen'],
  ['end of life',          'Entsorgung Lebensende'],
  ['end-of-life',          'Entsorgung Lebensende'],
  ['particle board',       'Spanplatte'],
  ['fibre board',          'Holzfaserplatte'],
  ['flat screen',          'Flachbildschirm'],
  ['light bulb',           'Glühbirne Leuchtmittel'],
  ['train freight',        'Güterzug Frachtbahn'],
  ['air traffic',          'Luftverkehr Flugverkehr'],
  ['air passenger',        'Fluggast Passagierflug'],
  ['offshore wind',        'Offshore-Wind'],
  ['onshore wind',         'Onshore-Wind'],
  ['brown paper',          'Kraftpapier'],
  ['office paper',         'Büropapier'],
  ['kraft liner',          'Kraftkarton'],
  ['float glass',          'Floatglas'],
  ['borosilicate glass',   'Borosilikatglas'],
  ['ceramic glass',        'Glaskeramik'],
  ['glass bottle',         'Glasflasche'],
  ['glass bottles',        'Glasflaschen'],
  ['united kingdom',       'Großbritannien Vereinigtes Königreich'],
  ['czech republic',       'Tschechien'],
  ['south korea',          'Südkorea'],
  ['south africa',         'Südafrika'],
  ['new zealand',          'Neuseeland'],
  ['saudi arabia',         'Saudi-Arabien'],
  ['hot-dip',              'Feuerverzinkung'],
  ['co-firing',            'Mitverbrennung'],
  ['direct emissions',     'Direktemissionen'],
  ['folding boxboard',     'Faltkarton'],
  ['corrugated board',     'Wellpappe'],
  ['printed circuit board','Leiterplatte Platine'],
  ['circuit board',        'Leiterplatte Platine'],
  ['mobile phone',         'Mobiltelefon Handy Smartphone'],
  ['washing machine',      'Waschmaschine'],
  ['internet traffic',     'Internetverkehr Datenverkehr'],
  ['data storage',         'Datenspeicher'],
  ['datastorage',          'Datenspeicher'],
  ['lead battery',         'Bleiakkumulator Bleibatterie'],
  ['cell battery',         'Batterie Akku Zelle'],
  ['ic die',               'Integrierter Schaltkreis Chip Halbleiter'],
  ['mono-si',              'monokristallines Silizium'],
  ['poly-si',              'polykristallines Silizium'],
  ['lead-free',            'bleifrei'],
  ['leadfree',             'bleifrei'],
  ['rare earth',           'Seltene Erden'],
];

// ── Single-word translations ──────────────────────────────────────────────────
const WORDS = {
  // Metals
  steel:          'Stahl',
  aluminium:      'Aluminium',
  aluminum:       'Aluminium',
  copper:         'Kupfer',
  iron:           'Eisen',
  zinc:           'Zink',
  lead:           'Blei',
  tin:            'Zinn',
  nickel:         'Nickel',
  titanium:       'Titan',
  chromium:       'Chrom',
  manganese:      'Mangan',
  silver:         'Silber',
  gold:           'Gold',
  cobalt:         'Kobalt',
  lithium:        'Lithium',
  bronze:         'Bronze',
  brass:          'Messing',
  molybdenum:     'Molybdän',
  tungsten:       'Wolfram',
  vanadium:       'Vanadium',
  antimony:       'Antimon',
  cadmium:        'Cadmium',
  magnesium:      'Magnesium',
  platinum:       'Platin',
  palladium:      'Palladium',
  germanium:      'Germanium',
  indium:         'Indium',
  tellurium:      'Tellur',
  selenium:       'Selen',
  niobium:        'Niob',
  tantalum:       'Tantal',
  gallium:        'Gallium',
  bismuth:        'Wismut',
  zirconium:      'Zirkonium',
  barium:         'Barium',
  beryllium:      'Beryllium',
  strontium:      'Strontium',
  rhenium:        'Rhenium',
  hafnium:        'Hafnium',
  thallium:       'Thallium',
  boron:          'Bor',
  cerium:         'Cer',
  europium:       'Europium',
  gadolinium:     'Gadolinium',
  lanthanum:      'Lanthan',
  neodymium:      'Neodym',
  praseodymium:   'Praseodym',
  samarium:       'Samarium',
  dysprosium:     'Dysprosium',
  erbium:         'Erbium',
  terbium:        'Terbium',
  holmium:        'Holmium',
  lutetium:       'Lutetium',
  ytterbium:      'Ytterbium',
  thulium:        'Thulium',
  yttrium:        'Yttrium',
  scandium:       'Scandium',
  stainless:      'Edelstahl',
  inox:           'Edelstahl',
  scrap:          'Schrott',
  pipe:           'Rohr',
  pipes:          'Rohre',
  beam:           'Träger',
  beams:          'Träger',
  sheet:          'Blech',
  wire:           'Draht',
  rod:            'Stab',
  plate:          'Platte',
  tube:           'Rohr',
  rolling:        'Walzen',
  drilling:       'Bohren',
  milling:        'Fräsen',
  turning:        'Drehen',
  welded:         'geschweißt',
  seamless:       'nahtlos',
  galvanized:     'verzinkt',
  electroplating: 'Galvanisierung',
  chrome:         'Chrom',
  virgin:         'Primärwerkstoff',
  primary:        'Primär',
  secondary:      'Sekundär',
  solder:         'Lötzinn Lot',
  soldering:      'Löten',
  // Building materials
  cement:         'Zement',
  concrete:       'Beton',
  gypsum:         'Gips',
  brick:          'Ziegel',
  bricks:         'Ziegel',
  tile:           'Fliese',
  tiles:          'Fliesen',
  sand:           'Sand',
  gravel:         'Kies',
  limestone:      'Kalkstein',
  asphalt:        'Asphalt',
  bitumen:        'Bitumen',
  insulation:     'Dämmung',
  cork:           'Kork',
  clay:           'Ton',
  stone:          'Stein',
  porcelain:      'Porzellan',
  stoneware:      'Steinzeug',
  glaze:          'Glasur',
  window:         'Fenster',
  facade:         'Fassade',
  reinforced:     'bewehrt',
  blastfurnace:   'Hochofen',
  roof:           'Dach',
  // Wood
  wood:           'Holz',
  timber:         'Bauholz',
  plywood:        'Sperrholz',
  particleboard:  'Spanplatte',
  mdf:            'MDF',
  chipboard:      'Spanplatte',
  fibreboard:     'Holzfaserplatte',
  pine:           'Kiefer',
  oak:            'Eiche',
  beech:          'Buche',
  spruce:         'Fichte',
  birch:          'Birke',
  bamboo:         'Bambus',
  hardwood:       'Hartholz',
  softwood:       'Weichholz',
  teak:           'Teak',
  fsc:            'zertifiziert',
  pefc:           'zertifiziert',
  // Plastics
  plastic:        'Kunststoff',
  plastics:       'Kunststoffe',
  polyethylene:   'Polyethylen',
  polypropylene:  'Polypropylen',
  polystyrene:    'Polystyrol',
  pvc:            'PVC',
  polyurethane:   'Polyurethan',
  nylon:          'Nylon',
  rubber:         'Gummi',
  foam:           'Schaumstoff',
  polymer:        'Polymer',
  resin:          'Harz',
  epoxy:          'Epoxid',
  biodegradable:  'biologisch abbaubar',
  cellulose:      'Zellulose',
  // Textiles & fibres
  cotton:         'Baumwolle',
  wool:           'Wolle',
  silk:           'Seide',
  linen:          'Leinen',
  leather:        'Leder',
  fibre:          'Faser',
  fiber:          'Faser',
  fibres:         'Fasern',
  fibers:         'Fasern',
  textile:        'Textil',
  textiles:       'Textilien',
  fleece:         'Vlies',
  jute:           'Jute',
  elastane:       'Elastan',
  acrylic:        'Acryl',
  polyester:      'Polyester',
  hemp:           'Hanf',
  // Agriculture
  palm:           'Palme',
  soybean:        'Sojabohne',
  soy:            'Soja',
  starch:         'Stärke',
  potato:         'Kartoffel',
  potatoes:       'Kartoffeln',
  rape:           'Raps',
  wheat:          'Weizen',
  corn:           'Mais',
  sugarcane:      'Zuckerrohr',
  hides:          'Häute',
  tanning:        'Gerbung',
  // Glass
  glass:          'Glas',
  borosilicate:   'Borosilikat',
  silica:         'Kieselglas',
  bottle:         'Flasche',
  bottles:        'Flaschen',
  // Paper & Packaging
  paper:          'Papier',
  cardboard:      'Karton',
  packaging:      'Verpackung',
  kraft:          'Kraft',
  liner:          'Liner',
  // Electronics
  battery:        'Batterie',
  motor:          'Motor',
  computer:       'Computer',
  laptop:         'Laptop',
  led:            'LED',
  screen:         'Bildschirm',
  display:        'Display',
  cord:           'Kabel',
  pcb:            'Leiterplatte Platine',
  refrigerator:   'Kühlschrank',
  datacentre:     'Rechenzentrum',
  datacenter:     'Rechenzentrum',
  photovoltaic:   'Photovoltaik',
  silicon:        'Silizium',
  // Energy
  electricity:    'Strom',
  energy:         'Energie',
  heat:           'Wärme',
  solar:          'Solar',
  wind:           'Wind',
  nuclear:        'Kernkraft',
  hydropower:     'Wasserkraft',
  coal:           'Kohle',
  gas:            'Gas',
  oil:            'Öl',
  diesel:         'Diesel',
  gasoline:       'Benzin',
  petrol:         'Benzin',
  fuel:           'Kraftstoff',
  fuels:          'Kraftstoffe',
  hydrogen:       'Wasserstoff',
  methane:        'Methan',
  propane:        'Propan',
  butane:         'Butan',
  ethane:         'Ethan',
  lng:            'Flüssigerdgas',
  cng:            'Erdgas',
  lpg:            'Flüssiggas',
  anthracite:     'Anthrazit',
  combustion:     'Verbrennung',
  turbine:        'Turbine',
  tower:          'Turm',
  foundation:     'Fundament',
  // Transport
  transport:      'Transport',
  freight:        'Fracht',
  ship:           'Schiff',
  truck:          'LKW',
  road:           'Straße',
  passenger:      'Passagier',
  pipeline:       'Pipeline',
  tractor:        'Traktor',
  // Chemicals
  acid:           'Säure',
  oxide:          'Oxid',
  hydroxide:      'Hydroxid',
  chloride:       'Chlorid',
  sulfate:        'Sulfat',
  carbonate:      'Karbonat',
  nitrate:        'Nitrat',
  phosphate:      'Phosphat',
  ammonia:        'Ammoniak',
  ethanol:        'Ethanol',
  methanol:       'Methanol',
  chlorine:       'Chlor',
  silicone:       'Silikon',
  alumina:        'Aluminiumoxid',
  // Misc
  production:     'Produktion',
  average:        'Durchschnitt',
  mix:            'Mischung',
  global:         'global',
  market:         'Markt',
  waste:          'Abfall',
  wastewater:     'Abwasser',
  sludge:         'Klärschlamm',
  landfill:       'Deponie',
  emission:       'Emission',
  emissions:      'Emissionen',
  carbon:         'Kohlenstoff',
  ceramic:        'Keramik',
  ceramics:       'Keramik',
  recycled:       'recycelt',
  // Countries
  germany:        'Deutschland',
  france:         'Frankreich',
  netherlands:    'Niederlande',
  austria:        'Österreich',
  belgium:        'Belgien',
  switzerland:    'Schweiz',
  poland:         'Polen',
  czechia:        'Tschechien',
  italy:          'Italien',
  spain:          'Spanien',
  sweden:         'Schweden',
  denmark:        'Dänemark',
  norway:         'Norwegen',
  finland:        'Finnland',
  greece:         'Griechenland',
  hungary:        'Ungarn',
  romania:        'Rumänien',
  bulgaria:       'Bulgarien',
  croatia:        'Kroatien',
  slovakia:       'Slowakei',
  lithuania:      'Litauen',
  latvia:         'Lettland',
  estonia:        'Estland',
  ireland:        'Irland',
  luxembourg:     'Luxemburg',
  cyprus:         'Zypern',
  slovenia:       'Slowenien',
  india:          'Indien',
  australia:      'Australien',
  brazil:         'Brasilien',
  canada:         'Kanada',
  russia:         'Russland',
  turkey:         'Türkei',
  ukraine:        'Ukraine',
  argentina:      'Argentinien',
  argentia:       'Argentinien',
  europe:         'Europa',
  european:       'Europa',
  mexico:         'Mexiko',
  indonesia:      'Indonesien',
  malaysia:       'Malaysia',
  thailand:       'Thailand',
  vietnam:        'Vietnam',
  iran:           'Iran',
  iraq:           'Irak',
  israel:         'Israel',
  qatar:          'Katar',
  serbia:         'Serbien',
  albania:        'Albanien',
  moldova:        'Moldau',
  georgia:        'Georgien',
  armenia:        'Armenien',
  azerbaijan:     'Aserbaidschan',
  kazakhstan:     'Kasachstan',
  colombia:       'Kolumbien',
  venezuela:      'Venezuela',
  peru:           'Peru',
  chile:          'Chile',
  ecuador:        'Ecuador',
  bolivia:        'Bolivien',
  morocco:        'Marokko',
  algeria:        'Algerien',
  egypt:          'Ägypten',
  nigeria:        'Nigeria',
  kenya:          'Kenia',
  philippines:    'Philippinen',
  singapore:      'Singapur',
  taiwan:         'Taiwan',
};

/**
 * Generate a German keyword string for a single entry name.
 * Phrase matches are checked first (longest/first-defined wins),
 * then single-token matches for remaining positions.
 * Steel grade codes and other untranslatable terms simply get no name_de.
 */
function buildNameDe(name) {
  const lower = name.toLowerCase();
  const collected = [];
  const usedRanges = [];

  // 1. Phrase matches
  for (const [phrase, de] of PHRASES) {
    const idx = lower.indexOf(phrase);
    if (idx >= 0) {
      collected.push([idx, de]);
      usedRanges.push([idx, idx + phrase.length]);
    }
  }

  const inUsed = (start, end) =>
    usedRanges.some(([rs, re]) => start < re && end > rs);

  // 2. Single-token matches for positions not covered by a phrase
  for (const m of lower.matchAll(/[a-z][a-z0-9\-]*/g)) {
    const tok = m[0];
    if (WORDS[tok] && !inUsed(m.index, m.index + tok.length)) {
      collected.push([m.index, WORDS[tok]]);
    }
  }

  collected.sort((a, b) => a[0] - b[0]);

  // Deduplicate words (case-insensitive)
  const seen = new Set();
  const result = [];
  for (const [, de] of collected) {
    for (const w of de.split(' ')) {
      if (!seen.has(w.toLowerCase())) {
        seen.add(w.toLowerCase());
        result.push(w);
      }
    }
  }

  return result.join(' ');
}

/**
 * For 'metals, ferro' entries whose names are standard steel/iron grade codes
 * (e.g. GG15, C45, 42CrMo4) the word-matcher produces nothing because these
 * codes contain no translatable English words. We assign German class names
 * based on well-known naming conventions:
 *   GGG* → Sphäroguss (nodular cast iron)
 *   GGL* → Gusseisen mit Lamellengraphit
 *   GG*  → Grauguss (grey cast iron)
 *   GS-* → Stahlguss (steel casting)
 *   X*Cr → Edelstahl (stainless / high-alloy)
 *   else → Stahl (all other grade codes: C15, St13, 42CrMo4 …)
 */
function ferroGradeKeyword(name) {
  if (/^GGG/i.test(name)) return 'Gusseisen Sphäroguss';
  if (/^GGL/i.test(name)) return 'Gusseisen Lamellengraphit';
  if (/^GG/i.test(name))  return 'Grauguss Gusseisen';
  if (/^GS-/i.test(name)) return 'Stahl Stahlguss';
  if (/^X\d.*Cr/i.test(name)) return 'Stahl Edelstahl';
  return 'Stahl';
}

/**
 * Adds `name_de` and `category_de` to every entry in the array (mutates in place).
 * Returns the same array for convenience.
 */
export function addGermanKeywords(entries) {
  for (const e of entries) {
    e.name_de     = buildNameDe(e.name);
    e.category_de = CATEGORY_DE[e.category] ?? '';

    // Fill in ferro-metal grade codes that the word-matcher can't handle
    if (!e.name_de && e.category === 'metals, ferro') {
      e.name_de = ferroGradeKeyword(e.name);
    }
  }
  return entries;
}

// ── Standalone runner ────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(JSON_PATH)) {
    console.error(`idemat.json not found: ${JSON_PATH}`);
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
  addGermanKeywords(data);
  writeFileSync(JSON_PATH, JSON.stringify(data, null, 0));

  const withDe = data.filter(e => e.name_de).length;
  console.log(`✅ ${data.length} Einträge verarbeitet, ${withDe} mit name_de (${Math.round(withDe*100/data.length)}%)`);
}
