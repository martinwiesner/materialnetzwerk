// Search help for ÖKOBAUDAT: its name search is a plain substring match, so
// compounds like "Hanfdämmung" find nothing while "Hanf" finds "Hanfvlies".
// MATERIAL stems are searched automatically; all entries also serve as suggestions.

const MATERIAL = {
  hanf:        ['Hanf'],
  flachs:      ['Flachs'],
  jute:        ['Jute'],
  kork:        ['Kork'],
  stroh:       ['Stroh'],
  zellulose:   ['Zellulose'],
  schafwolle:  ['Schafwolle'],
  holzfaser:   ['Holzfaser'],
  mineralwolle:['Mineralwolle', 'Steinwolle', 'Glaswolle'],
  steinwolle:  ['Steinwolle'],
  glaswolle:   ['Glaswolle'],
  beton:       ['Beton', 'Transportbeton', 'Betonfertigteil'],
  zement:      ['Zement', 'CEM'],
  ziegel:      ['Ziegel', 'Mauerziegel', 'Dachziegel'],
  lehm:        ['Lehm'],
  kalk:        ['Kalk', 'Kalksandstein'],
  gips:        ['Gips', 'Gipsplatte', 'Gipsfaser'],
  holz:        ['Holz', 'Brettschichtholz', 'Konstruktionsvollholz', 'Brettsperrholz'],
  stahl:       ['Stahl', 'Betonstahl', 'Baustahl'],
  aluminium:   ['Aluminium'],
  kupfer:      ['Kupfer'],
  glas:        ['Glas', 'Flachglas'],
  sand:        ['Sand', 'Kies'],
  kies:        ['Kies'],
  asphalt:     ['Asphalt', 'Bitumen'],
  bitumen:     ['Bitumen'],
  polystyrol:  ['Polystyrol', 'EPS', 'XPS'],
  pur:         ['Polyurethan', 'PUR'],
  pvc:         ['PVC'],
  recycling:   ['Recycling', 'RC-'],
};

// Product forms / applications — only suggested, too broad to search automatically
const FORM = {
  dämmung:   ['Dämmstoff', 'Dämmplatte'],
  dämmstoff: ['Dämmstoff'],
  platte:    ['Platte'],
  matte:     ['Matte', 'Vlies'],
  putz:      ['Putz', 'Mörtel'],
  mörtel:    ['Mörtel'],
  estrich:   ['Estrich'],
  stein:     ['Mauerstein', 'Pflaster'],
  fenster:   ['Fenster'],
  dach:      ['Dachziegel', 'Dachbahn'],
  boden:     ['Bodenbelag', 'Parkett'],
  fassade:   ['Fassade'],
};

const norm = (s) => s.toLowerCase().normalize('NFC');

/**
 * @returns {{ queries: string[], suggestions: string[] }}
 *   queries: terms to search automatically (original first, then material stems)
 *   suggestions: clickable alternatives (materials + product forms), without queries
 */
export function expandSearchTerm(term) {
  const t = norm(String(term || '').trim());
  if (!t) return { queries: [], suggestions: [] };
  const queries = [String(term).trim()];
  const suggestions = [];
  for (const [key, terms] of Object.entries(MATERIAL)) {
    if (!t.includes(key)) continue;
    // exact material word → synonyms are suggestions; compound → stem is searched too
    if (t !== key) queries.push(terms[0]);
    suggestions.push(...terms);
  }
  for (const [key, terms] of Object.entries(FORM)) {
    if (t.includes(key)) suggestions.push(...terms);
  }
  const uniq = (arr) => [...new Map(arr.map(x => [norm(x), x])).values()];
  const q = uniq(queries);
  const qSet = new Set(q.map(norm));
  return { queries: q, suggestions: uniq(suggestions).filter(s => !qSet.has(norm(s))) };
}
