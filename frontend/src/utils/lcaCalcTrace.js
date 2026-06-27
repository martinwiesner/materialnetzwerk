// LCA Calculation Engine with structured trace output.
// Math mirrors CombinedProductLca.jsx buildEntries() exactly — same formulas,
// same sumMods logic — so PDF values are identical to what the UI shows.

// ── EF 3.1 conversion factors (EC JRC, EF 3.1 method, 2021) ─────────────────
export const EF31_CONV = {
  'GWP-total':      { norm: 7.55e3,  wf: 0.2106, ef31: 'climate_change',      label: 'Klimawandel',               unit: 'kg CO₂ eq.' },
  'ODP':            { norm: 5.36e-2, wf: 0.0631, ef31: 'ozone_depletion',     label: 'Ozonabbau',                 unit: 'kg CFC-11 eq.' },
  'AP':             { norm: 5.56e1,  wf: 0.0620, ef31: 'acidification',       label: 'Versauerung',               unit: 'mol H⁺ eq.' },
  'EP-terrestrial': { norm: 1.77e2,  wf: 0.0371, ef31: 'eutroph_terrestrial', label: 'Eutrophierung (terrestr.)', unit: 'mol N eq.' },
  'EP-freshwater':  { norm: 1.61e0,  wf: 0.0280, ef31: 'eutroph_freshwater',  label: 'Eutrophierung (SW)',        unit: 'kg P eq.' },
  'EP-marine':      { norm: 1.95e1,  wf: 0.0296, ef31: 'eutroph_marine',      label: 'Eutrophierung (Meer)',      unit: 'kg N eq.' },
  'POCP':           { norm: 4.09e1,  wf: 0.0478, ef31: 'photochem_ozone',     label: 'Photosmog',                 unit: 'kg NMVOC eq.' },
  'ADP-fossil':     { norm: 6.50e4,  wf: 0.0832, ef31: 'resource_fossils',    label: 'Ressourcen (fossil)',       unit: 'MJ' },
  'ADP-elements':   { norm: 6.36e-2, wf: 0.0755, ef31: 'resource_minerals',   label: 'Ressourcen (mineralisch)', unit: 'kg Sb eq.' },
  'WDP':            { norm: 1.14e4,  wf: 0.0851, ef31: 'water_use',           label: 'Wassernutzung',             unit: 'm³ world eq.' },
};

export const NOT_CONV = [
  { ef31: 'particulate_matter',  label: 'Feinstaub',               wf: 0.0896 },
  { ef31: 'human_tox_cancer',    label: 'Tox. Mensch (krebserr.)', wf: 0.0213 },
  { ef31: 'human_tox_noncancer', label: 'Tox. Mensch (nicht-k.)', wf: 0.0184 },
  { ef31: 'ionising_radiation',  label: 'Ionisierende Strahlung',  wf: 0.0501 },
  { ef31: 'ecotox_freshwater',   label: 'Ökotox. Süßwasser',       wf: 0.0192 },
  { ef31: 'land_use',            label: 'Landnutzung',             wf: 0.0794 },
];

export const COVERED_WF = Object.values(EF31_CONV).reduce((s, v) => s + v.wf, 0); // ≈ 0.722

export const GWP_NORM = 7.55e3;  // kg CO₂ eq./(Person·Jahr)
export const GWP_WF   = 0.2106;  // Gewichtungsfaktor Klimawandel EF 3.1

const A1A3_KEYS = ['A1-A3', 'A1', 'A2', 'A3'];
const EOL_KEYS  = ['C3', 'C4'];

// ── Unit conversion helpers (mirrors OekobaudatPicker / epdUnitConv logic) ───

function normUnit(u) {
  if (!u) return '';
  let s = String(u).trim().replace(/^[\d.,]+\s*/, '').trim().toLowerCase();
  if (['metric ton','metric tons','tonne','tonnes','tonnen'].includes(s)) s = 't';
  if (['m3','cubic meter','cubic metre','kubikmeter'].includes(s)) s = 'm³';
  if (['kilogramm','kilogram','kilograms'].includes(s)) s = 'kg';
  if (['piece','pieces','stück','stk','pce','pcs','unit','units'].includes(s)) s = 'stk';
  return s;
}

// Returns factor to convert FROM → TO (e.g. fromUnit='kg', toUnit='t' → 0.001)
export function unitConvFactor(fromUnit, toUnit) {
  function toKg(u) {
    const n = normUnit(u);
    return n === 'kg' ? 1 : n === 't' ? 1000 : n === 'g' ? 0.001 : null;
  }
  const f = normUnit(fromUnit), t = normUnit(toUnit);
  if (!f || !t || f === t) return 1;
  const fK = toKg(f), tK = toKg(t);
  if (fK != null && tK != null && tK !== 0) return fK / tK;
  return 1;
}

/**
 * Returns { factor, mismatch, note } describing the unit situation for a material.
 * factor: how to convert mat.quantity (in mat.unit) to declared unit
 * mismatch: true if units differ
 * NOTE: CombinedProductLca.jsx uses Number(mat.quantity) WITHOUT applying this factor.
 *       The trace documents this discrepancy when it exists.
 */
export function unitInfo(mat) {
  const enteredUnit  = mat.unit || mat.declaredUnit || '';
  const declaredUnit = mat.declaredUnit || mat.unit || '';
  const factor = unitConvFactor(enteredUnit, declaredUnit);
  const mismatch = normUnit(enteredUnit) !== normUnit(declaredUnit) && factor !== 1;
  let note = '';
  if (mismatch) {
    const effectiveQty = (Number(mat.quantity) || 1) * factor;
    note = `Eingabeeinheit "${enteredUnit}" ≠ deklarierte Einheit "${declaredUnit}". ` +
           `Konversionsfaktor: ${factor} (${fmtFull(Number(mat.quantity) || 1)} ${enteredUnit} = ` +
           `${fmtFull(effectiveQty)} ${declaredUnit}). ` +
           `Die Berechnung in CombinedProductLca verwendet die Eingabemenge ohne Einheitenkonversion ` +
           `(${fmtFull(Number(mat.quantity) || 1)} × Indikator je ${declaredUnit}). ` +
           `Bitte sicherstellen, dass die Eingabemenge bereits in ${declaredUnit} angegeben ist.`;
  }
  return { enteredUnit, declaredUnit, factor, mismatch, effectiveQty: (Number(mat.quantity)||1)*factor, note };
}

// Mirrors CombinedProductLca.jsx sumMods() exactly (including sumAll fix for C3+C4)
// sumAll=false: first direct-key hit wins (for composite keys like 'A1-A3')
// sumAll=true:  always sum all found keys (for independent modules like C3 + C4)
function sumMods(mods, keys, sumAll = false) {
  if (!sumAll) {
    for (const k of keys) if (k in mods && mods[k] != null) return mods[k];
  }
  let s = 0, found = false;
  for (const k of Object.keys(mods)) {
    if (keys.includes(k) && mods[k] != null) { s += mods[k]; found = true; }
  }
  return found ? s : null;
}

// Same as sumMods but also returns which keys contributed (for trace documentation)
function sumModsTraced(mods, keys, sumAll = false) {
  if (!sumAll) {
    for (const k of keys) {
      if (k in mods && mods[k] != null) return { value: mods[k], foundKeys: [k], combined: false };
    }
  }
  let s = 0, foundKeys = [];
  for (const k of Object.keys(mods)) {
    if (keys.includes(k) && mods[k] != null) { s += mods[k]; foundKeys.push(k); }
  }
  if (foundKeys.length) return { value: s, foundKeys, combined: foundKeys.length > 1 };
  return { value: null, foundKeys: [], combined: false };
}

export function fmtN(v) {
  if (v == null || isNaN(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 0.01)     return v.toLocaleString('de-DE', { maximumFractionDigits: 4 });
  if (a >= 0.0001)   return v.toLocaleString('de-DE', { maximumFractionDigits: 6 });
  if (a >= 0.000001) return v.toLocaleString('de-DE', { maximumFractionDigits: 8 });
  return v.toLocaleString('de-DE', { maximumFractionDigits: 10 });
}

export function fmtFull(v) {
  if (v == null || isNaN(v)) return 'n. v.';
  if (v === 0) return '0';
  return v.toLocaleString('de-DE', { maximumFractionDigits: 10 });
}

export function fmtGWP(v) {
  if (v == null || isNaN(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1)        return v.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  if (a >= 0.001)    return v.toLocaleString('de-DE', { maximumFractionDigits: 4 });
  if (a >= 0.000001) return v.toLocaleString('de-DE', { maximumFractionDigits: 6 });
  return v.toLocaleString('de-DE', { maximumFractionDigits: 8 });
}

/**
 * Build LCA results with full calculation trace.
 * Returns the same numeric values as CombinedProductLca.jsx (selectedCat='total').
 *
 * @param {Array} epdMats - Pre-processed EPD/library materials (same format as passed to CombinedProductLca)
 * @param {Array} idematItems - Raw IDEMAT items from project.idemat_lca_items
 * @returns {{ entries, trace, ptSummary, gwpSummary }}
 */
export function buildLcaWithTrace(epdMats, idematItems) {
  const trace = [];
  let stepN = 0;

  function addStep(data) {
    stepN++;
    const s = { stepN, ...data };
    trace.push(s);
    return s;
  }

  const entries = [];

  // ── EPD / Library Materials ───────────────────────────────────────────────
  for (const [mi, mat] of (epdMats || []).entries()) {
    const qty      = Number(mat.quantity) || 1;
    const inds     = mat.indicators || {};
    const name     = mat.name || `Material ${mi + 1}`;
    const matLabel = `M${mi + 1}`;
    const srcType  = mat.isLibraryMaterial ? 'Bibliotheksmaterial' : 'ÖKOBAUDAT-EPD';
    const srcRef   = mat.norm || mat.epd_id || mat.uuid || '—';
    const declUnit = mat.declaredUnit || 'kg';
    const uInfo    = unitInfo(mat);

    // Step: scaling
    addStep({
      label: `${matLabel}.0`,
      category: 'Materialskalierung',
      name,
      description: `Alle EPD-Indikatoren × Menge`,
      formula: 'Rohwert [je deklarierter Einheit] × Mengenfaktor',
      inputs: [
        { key: 'Material', value: name },
        { key: 'Datenquelle', value: srcType },
        { key: 'Datensatz-ID', value: srcRef },
        { key: 'Deklarierte Einheit (EPD-Bezugseinheit)', value: declUnit },
        { key: 'Eingabemenge', value: `${fmtFull(qty)} ${uInfo.enteredUnit || declUnit}` },
        { key: 'Einheitenkonversionsfaktor', value: uInfo.mismatch
            ? `${uInfo.factor} (${uInfo.enteredUnit} → ${uInfo.declaredUnit})`
            : `1 (keine Konversion nötig, Einheit bereits in ${declUnit})` },
        { key: 'Effektive Menge (in deklarierter Einheit)', value: uInfo.mismatch
            ? `${fmtFull(uInfo.effectiveQty)} ${uInfo.declaredUnit}`
            : `${fmtFull(qty)} ${declUnit}` },
        { key: 'Verwendeter Mengenfaktor in Berechnung', value: `${fmtFull(qty)} (wie eingegeben – keine automatische Konversion in CombinedProductLca)` },
      ],
      factors: [],
      calc: `Alle Indikatorwerte [je ${declUnit}] × ${fmtFull(qty)}`,
      rawResult: null,
      scaledResult: null,
      unit: '—',
      note: uInfo.mismatch
        ? `⚠ EINHEITENHINWEIS: ${uInfo.note}`
        : `Einheit stimmt überein (${declUnit}). Skalierungsfaktor: ${fmtFull(qty)}.`,
      assumptions: [
        mat.isLibraryMaterial
          ? 'Bibliotheksmaterial: GWP-Werte aus Materialdatensatz, nur teilweise EPD-Indikatoren verfügbar.'
          : 'EPD-Daten aus ÖKOBAUDAT nach EN 15804+A2.',
      ],
      limitations: uInfo.mismatch ? [
        `Eingabeeinheit (${uInfo.enteredUnit}) weicht von der deklarierten EPD-Einheit (${uInfo.declaredUnit}) ab.`,
        `Konversionsfaktor ${uInfo.factor} wurde in der Frontend-Berechnung NICHT automatisch angewandt.`,
        `Bitte prüfen, ob die eingegebene Menge (${qty}) bereits der deklarierten Einheit (${declUnit}) entspricht.`,
      ] : [],
    });

    // Scale all indicators
    const scaledInds = {};
    for (const [k, ind] of Object.entries(inds)) {
      scaledInds[k] = {
        unit: ind.unit,
        mods: Object.fromEntries(
          Object.entries(ind.mods || {}).map(([m, v]) => [m, v != null ? v * qty : null])
        ),
      };
    }

    // GWP from EPD (all modules)
    const gwpRawMods = inds?.['GWP-total']?.mods || {};
    const gwpScaledMods = scaledInds?.['GWP-total']?.mods || {};
    const gwpUnit = inds?.['GWP-total']?.unit || 'kg CO₂ eq.';

    function extractGwpMod(rawMods, scaledMods, moduleKeys, modLabel, sumAll = false) {
      const raw = sumModsTraced(rawMods, moduleKeys, sumAll);
      if (raw.value == null) return null;
      const scaled = raw.value * qty;
      addStep({
        label: `${matLabel}.GWP.${modLabel}`,
        category: 'GWP aus EPD',
        name,
        module: modLabel,
        description: `GWP ${modLabel} direkt aus EPD-Indikator GWP-total`,
        formula: `GWP-total [${modLabel}] je Einheit × Menge`,
        inputs: [
          { key: `GWP-total [${raw.foundKeys.join('+')}] je deklarierter Einheit`, value: `${fmtFull(raw.value)} ${gwpUnit}` },
          { key: 'Menge', value: `${fmtFull(qty)} ${mat.unit || declUnit}` },
        ],
        factors: [],
        calc: `${fmtFull(raw.value)} × ${fmtFull(qty)} = ${fmtFull(scaled)}`,
        rawResult: raw.value,
        scaledResult: scaled,
        unit: gwpUnit,
        note: raw.combined
          ? `Modul ${modLabel} aus Teilmodulen ${raw.foundKeys.join(' + ')} summiert.`
          : `Modul ${modLabel} direkt aus Schlüssel „${raw.foundKeys[0]}".`,
        assumptions: [],
        limitations: ['Direkter EPD-Deklarationswert, keine Umrechnung notwendig.'],
      });
      return scaled;
    }

    const gwpA1A3 = extractGwpMod(gwpRawMods, gwpScaledMods, A1A3_KEYS, 'A1–A3');
    const gwpB6   = (() => {
      const v = gwpRawMods['B6'];
      if (v == null) return null;
      const scaled = v * qty;
      addStep({
        label: `${matLabel}.GWP.B6`,
        category: 'GWP aus EPD', name, module: 'B6',
        description: 'GWP B6 direkt aus EPD-Indikator GWP-total',
        formula: 'GWP-total [B6] je Einheit × Menge',
        inputs: [
          { key: 'GWP-total [B6] je deklarierter Einheit', value: `${fmtFull(v)} ${gwpUnit}` },
          { key: 'Menge', value: `${fmtFull(qty)} ${mat.unit || declUnit}` },
        ],
        factors: [],
        calc: `${fmtFull(v)} × ${fmtFull(qty)} = ${fmtFull(scaled)}`,
        rawResult: v, scaledResult: scaled, unit: gwpUnit,
        note: 'Modul B6: Betriebsenergie.', assumptions: [], limitations: [],
      });
      return scaled;
    })();
    const gwpEoL = extractGwpMod(gwpRawMods, gwpScaledMods, EOL_KEYS, 'C3+C4', true); // sumAll: C3+C4 independent
    const gwpD   = (() => {
      const v = gwpRawMods['D'];
      if (v == null) return null;
      const scaled = v * qty;
      addStep({
        label: `${matLabel}.GWP.D`,
        category: 'GWP aus EPD', name, module: 'D',
        description: 'GWP Modul D (Gutschriften) aus EPD-Indikator GWP-total',
        formula: 'GWP-total [D] je Einheit × Menge',
        inputs: [
          { key: 'GWP-total [D] je deklarierter Einheit', value: `${fmtFull(v)} ${gwpUnit}` },
          { key: 'Menge', value: `${fmtFull(qty)} ${mat.unit || declUnit}` },
        ],
        factors: [],
        calc: `${fmtFull(v)} × ${fmtFull(qty)} = ${fmtFull(scaled)}`,
        rawResult: v, scaledResult: scaled, unit: gwpUnit,
        note: 'Modul D: Nettopotenzial für Wiederverwendung, Recycling, Rückgewinnung.',
        assumptions: [],
        limitations: ['Modul D ist kein Pflichtmodul in EN 15804+A2 und wird separat ausgewiesen.'],
      });
      return scaled;
    })();
    const gwpLife = [gwpA1A3, gwpB6, gwpEoL].reduce((s, v) => v != null ? s + v : s, 0) || null;

    // EF 3.1 Conversions per indicator per module
    let a1a3Pt = 0, b6Pt = 0, eolPt = 0, dPt = 0;
    const coveredInds = [];

    for (const [indKey, { norm, wf, label: efLabel, unit: efUnit }] of Object.entries(EF31_CONV)) {
      const rawMods    = inds[indKey]?.mods;
      const scaledMods = scaledInds[indKey]?.mods;
      if (!scaledMods) continue;

      const processModule = (modKeys, modLabel, ptAcc, sumAll = false) => {
        const { value: scaledVal, foundKeys, combined } = sumModsTraced(scaledMods, modKeys, sumAll);
        if (scaledVal == null) return ptAcc;
        const rawObj = sumModsTraced(rawMods || {}, modKeys, sumAll);
        const pt = (scaledVal / norm) * wf;
        addStep({
          label: `${matLabel}.EF31.${indKey}.${modLabel}`,
          category: 'EF 3.1 Umrechnung',
          name, module: modLabel,
          indicator: indKey,
          ef31Category: efLabel,
          description: `EF 3.1 Pt: ${efLabel} (${indKey}) · Modul ${modLabel}`,
          formula: '(Indikatorwert [skaliert] / Normierungsfaktor) × Gewichtungsfaktor',
          inputs: [
            { key: `${indKey} [${foundKeys.join('+')}] je deklarierter Einheit`, value: rawObj.value != null ? `${fmtFull(rawObj.value)} ${efUnit}` : '—' },
            { key: 'Menge', value: `${fmtFull(qty)} ${mat.unit || declUnit}` },
            { key: `${indKey} [${modLabel}] skaliert`, value: `${fmtFull(scaledVal)} ${efUnit}` },
          ],
          factors: [
            { key: 'Normierungsfaktor', value: `${fmtFull(norm)} ${efUnit}/(Person·Jahr)`, src: 'EF 3.1, EC JRC 2021' },
            { key: 'Gewichtungsfaktor', value: `${fmtFull(wf)} (dimensionslos)`, src: 'EF 3.1, EC JRC 2021' },
          ],
          calc: `(${fmtFull(scaledVal)} / ${fmtFull(norm)}) × ${fmtFull(wf)} = ${fmtFull(pt)}`,
          rawResult: scaledVal,
          scaledResult: pt,
          unit: 'Pt',
          note: combined ? `Modul ${modLabel} aus Teilmodulen ${foundKeys.join(' + ')} summiert.` : '',
          assumptions: [],
          limitations: [],
        });
        return ptAcc + pt;
      };

      const prev_a1a3 = a1a3Pt;
      a1a3Pt = processModule(A1A3_KEYS, 'A1–A3', a1a3Pt);
      if (a1a3Pt !== prev_a1a3) coveredInds.push(indKey);
      b6Pt  = processModule(['B6'],     'B6',    b6Pt);
      eolPt = processModule(EOL_KEYS,   'C3+C4', eolPt, true);  // sumAll: C3+C4 independent
      dPt   = processModule(['D'],       'D',     dPt);
    }

    const lifePt = a1a3Pt + b6Pt + eolPt;
    addStep({
      label: `${matLabel}.PT.Lifecycle`,
      category: 'EF 3.1 Phasensumme',
      name, module: 'A–C',
      description: `EF 3.1 Lifecycle-Score Material (A–C)`,
      formula: 'Σ Pt(A1–A3) + Σ Pt(B6) + Σ Pt(C3+C4)',
      inputs: [
        { key: 'Σ Pt A1–A3 (alle Indikatoren)', value: `${fmtFull(a1a3Pt)} Pt` },
        { key: 'Σ Pt B6',                        value: `${fmtFull(b6Pt)} Pt` },
        { key: 'Σ Pt C3+C4',                     value: `${fmtFull(eolPt)} Pt` },
      ],
      factors: [],
      calc: `${fmtFull(a1a3Pt)} + ${fmtFull(b6Pt)} + ${fmtFull(eolPt)} = ${fmtFull(lifePt)}`,
      rawResult: lifePt,
      scaledResult: lifePt,
      unit: 'Pt',
      note: coveredInds.length < Object.keys(EF31_CONV).length
        ? `TEILSCORE: Nur ${coveredInds.length} von 10 umrechenbaren EF 3.1-Indikatoren verfügbar. Fehlende Indikatoren aus EPD: ${Object.keys(EF31_CONV).filter(k => !coveredInds.includes(k)).join(', ')}.`
        : 'Alle 10 umrechenbaren EF 3.1-Indikatoren abgedeckt.',
      assumptions: [],
      limitations: [
        '6 EF 3.1-Kategorien (Feinstaub, Human-/Ökotoxizität, Ionisierende Strahlung, Landnutzung) nicht aus EN 15804+A2 umrechenbar — ca. 28 % der EF 3.1-Gewichtung fehlen im Materialanteil.',
        'Modul D wird separat ausgewiesen.',
      ],
    });

    entries.push({
      type: 'material',
      name,
      source: srcType,
      srcRef,
      qty, unit: mat.unit || declUnit,
      a1a3Pt, b6Pt, eolPt, dPt, lifePt,
      gwpA1A3, gwpB6, gwpEoL, gwpD, gwpLife,
      coveredInds,
      isLib: !!mat.isLibraryMaterial,
    });
  }

  // ── IDEMAT Processes ──────────────────────────────────────────────────────
  for (const [pi, it] of (idematItems || []).entries()) {
    const qty     = Number(it.quantity) || 1;
    const totalPt = (it.ef31_total ?? 0) * qty;
    const pLabel  = `P${pi + 1}`;

    addStep({
      label: `${pLabel}.scale`,
      category: 'Prozessskalierung',
      name: it.name,
      module: 'Lifecycle',
      description: `Ind. EF 3.1 Score (IDEMAT) × Menge`,
      formula: 'EF 3.1 Total [Pt/Einheit] × Menge',
      inputs: [
        { key: 'Prozess', value: it.name },
        { key: 'Datenquelle', value: 'IDEMAT 2026 (TU Delft, CC BY-NC)' },
        { key: 'Kategorie', value: it.category || '—' },
        { key: 'EF 3.1 Total je Einheit', value: `${fmtFull(it.ef31_total)} Pt/${it.unit}` },
        { key: 'Eingesetzte Menge', value: `${fmtFull(qty)} ${it.unit}` },
      ],
      factors: [],
      calc: `${fmtFull(it.ef31_total)} Pt/${it.unit} × ${fmtFull(qty)} ${it.unit} = ${fmtFull(totalPt)} Pt`,
      rawResult: it.ef31_total,
      scaledResult: totalPt,
      unit: 'Pt',
      note: 'IDEMAT 2026: 16 EF 3.1-Wirkungskategorien als Datenfelder verfügbar (normiert + gewichtet). Methodische Äquivalenz zu verifizierten EPDs nicht vollständig validiert.',
      assumptions: [],
      limitations: ['Kein Lebenszyklusmodul zugeordnet. IDEMAT enthält keine Modulaufgliederung (A1–A3, B6, C). Alle Wirkungen im Gesamtscore zusammengefasst.'],
    });

    // Per-category steps
    if (it.ef31) {
      for (const [catKey, catVal] of Object.entries(it.ef31)) {
        if (catVal == null) continue;
        const scaledCat = catVal * qty;
        const convEntry = Object.values(EF31_CONV).find(c => c.ef31 === catKey);
        addStep({
          label: `${pLabel}.EF31.${catKey}`,
          category: 'EF 3.1 Prozesskategorie',
          name: it.name,
          module: 'Lifecycle',
          indicator: catKey,
          ef31Category: convEntry?.label || catKey,
          description: `EF 3.1 ${convEntry?.label || catKey} Prozess × Menge`,
          formula: `${catKey} [Pt/Einheit] × Menge`,
          inputs: [
            { key: `${catKey} je Einheit`, value: `${fmtFull(catVal)} Pt/${it.unit}` },
            { key: 'Menge', value: `${fmtFull(qty)} ${it.unit}` },
          ],
          factors: [],
          calc: `${fmtFull(catVal)} × ${fmtFull(qty)} = ${fmtFull(scaledCat)}`,
          rawResult: catVal, scaledResult: scaledCat, unit: 'Pt',
          note: '', assumptions: [], limitations: [],
        });
      }
    }

    // GWP back-calculation
    const ccRaw = it.ef31?.climate_change;
    const ccPt  = ccRaw != null ? ccRaw * qty : null;
    const gwpEquiv = ccPt != null ? ccPt * GWP_NORM / GWP_WF : null;

    if (ccRaw != null) {
      addStep({
        label: `${pLabel}.GWP.back`,
        category: 'GWP Rückrechnung',
        name: it.name,
        module: 'Lifecycle',
        description: `GWP-Äquivalent aus EF 3.1 climate_change Pt rückgerechnet`,
        formula: 'GWP [kg CO₂ eq.] = climate_change [Pt] × GWP_NORM / GWP_WF',
        inputs: [
          { key: 'climate_change Pt je Einheit', value: `${fmtFull(ccRaw)} Pt/${it.unit}` },
          { key: 'Menge', value: `${fmtFull(qty)} ${it.unit}` },
          { key: 'climate_change Pt × Menge', value: `${fmtFull(ccPt)} Pt` },
        ],
        factors: [
          { key: 'GWP_NORM', value: `${fmtFull(GWP_NORM)} kg CO₂ eq./(Person·Jahr)`, src: 'EF 3.1, EC JRC 2021' },
          { key: 'GWP_WF',   value: `${fmtFull(GWP_WF)} (Gewichtungsfaktor Klimawandel)`, src: 'EF 3.1, EC JRC 2021' },
        ],
        calc: `${fmtFull(ccPt)} × ${fmtFull(GWP_NORM)} / ${fmtFull(GWP_WF)} = ${fmtFull(gwpEquiv)}`,
        rawResult: ccPt,
        scaledResult: gwpEquiv,
        unit: 'kg CO₂ eq.',
        note: `Herleitung: Pt = GWP / GWP_NORM × GWP_WF  ⟹  GWP = Pt × GWP_NORM / GWP_WF. ` +
              `Entspricht dem ursprünglichen IDEMAT-GWP-Midpoint und ist direkt mit EPD-GWP-Werten vergleichbar.`,
        assumptions: ['Umrechnung setzt voraus, dass IDEMAT climate_change identisch mit dem EF 3.1-Klimawandel-Midpoint normiert und gewichtet wurde.'],
        limitations: [
          'Rückgerechneter Wert – kein originaler EPD-Deklarationswert.',
          'Nur Lifecycle-Gesamtscore verfügbar; keine Modulaufgliederung (A1–A3, B6, C).',
        ],
      });
    }

    entries.push({
      type: 'process',
      name: it.name,
      source: 'IDEMAT 2026 (TU Delft, CC BY-NC)',
      srcRef: `IDEMAT-2026-${it.process_id || it.id}`,
      qty, unit: it.unit,
      category: it.category,
      a1a3Pt: totalPt,
      b6Pt: 0, eolPt: 0, dPt: 0, lifePt: totalPt,
      gwpA1A3: gwpEquiv,
      gwpB6: null, gwpEoL: null, gwpD: null,
      gwpLife: gwpEquiv,
      coveredInds: ['all-16-ef31-categories'],
      ef31: it.ef31,
      ef31_total: it.ef31_total,
    });
  }

  // ── Aggregate summation steps ─────────────────────────────────────────────
  const matEntries  = entries.filter(e => e.type === 'material');
  const procEntries = entries.filter(e => e.type === 'process');

  const matsA1A3 = matEntries.reduce((s, e) => s + e.a1a3Pt, 0);
  const matsB6   = matEntries.reduce((s, e) => s + e.b6Pt,   0);
  const matsEoL  = matEntries.reduce((s, e) => s + e.eolPt,  0);
  const matsD    = matEntries.reduce((s, e) => s + e.dPt,    0);
  const matsLife = matsA1A3 + matsB6 + matsEoL;

  const procsTotal = procEntries.reduce((s, e) => s + e.lifePt, 0);
  const grandTotal = matsLife + procsTotal;

  if (matEntries.length > 0) {
    addStep({
      label: 'AGG.MAT.Lifecycle',
      category: 'Zwischensumme Materialien',
      name: 'Alle Materialien',
      module: 'A–C',
      description: 'EF 3.1 Lifecycle-Score Materialien gesamt',
      formula: 'Σ a1a3Pt + Σ b6Pt + Σ eolPt aller Materialien',
      inputs: [
        ...matEntries.map(e => ({ key: e.name + ' A1–A3', value: `${fmtFull(e.a1a3Pt)} Pt` })),
        ...matEntries.map(e => ({ key: e.name + ' B6',    value: `${fmtFull(e.b6Pt)} Pt` })),
        ...matEntries.map(e => ({ key: e.name + ' C3+C4', value: `${fmtFull(e.eolPt)} Pt` })),
      ],
      factors: [],
      calc: `A1–A3: ${fmtFull(matsA1A3)} + B6: ${fmtFull(matsB6)} + C3+C4: ${fmtFull(matsEoL)} = ${fmtFull(matsLife)}`,
      rawResult: matsLife, scaledResult: matsLife, unit: 'Pt',
      note: `${matEntries.length} Material(ien). A–C = A1–A3 + B6 + C3+C4. Modul D separat.`,
      assumptions: [], limitations: [],
    });
  }

  if (procEntries.length > 0) {
    addStep({
      label: 'AGG.PROC.Total',
      category: 'Zwischensumme Prozesse',
      name: 'Alle Prozesse',
      module: 'Lifecycle',
      description: 'Ind. EF 3.1 Score Prozesse gesamt (IDEMAT)',
      formula: 'Σ lifePt aller IDEMAT-Prozesse',
      inputs: procEntries.map(e => ({ key: e.name, value: `${fmtFull(e.lifePt)} Pt` })),
      factors: [],
      calc: procEntries.map(e => fmtFull(e.lifePt)).join(' + ') + ` = ${fmtFull(procsTotal)}`,
      rawResult: procsTotal, scaledResult: procsTotal, unit: 'Pt',
      note: '', assumptions: [], limitations: [],
    });
  }

  addStep({
    label: 'AGG.GRAND.Total',
    category: 'Indikative kombinierte Pt-Bewertung',
    name: 'Produkt',
    module: 'Modul-Summe',
    description: 'Indikative kombinierte Pt-Bewertung – Materialien + Prozesse',
    formula: 'Materialien Modul-Summe + Prozesse (ind.)',
    inputs: [
      { key: 'Materialien Modul-Summe', value: `${fmtFull(matsLife)} Pt` },
      { key: 'Prozesse (IDEMAT, ind.)', value: `${fmtFull(procsTotal)} Pt` },
    ],
    factors: [],
    calc: `${fmtFull(matsLife)} + ${fmtFull(procsTotal)} = ${fmtFull(grandTotal)}`,
    rawResult: grandTotal, scaledResult: grandTotal, unit: 'Pt',
    note: 'Modul D (Gutschriften) wird separat ausgewiesen und ist nicht in diesem Wert enthalten.',
    assumptions: [],
    limitations: [
      'EPD-Materialien: Teilscore (nur deklarierte EN 15804+A2-Indikatoren umrechenbar, ca. 72 % der EF 3.1-Gewichtung).',
      'IDEMAT-Prozesse: indikativer EF 3.1-Score, 16 Kategorien als Datenfelder. Kein Lebenszyklusmodul zugeordnet.',
      'Methodisch unterschiedliche Datengrundlagen — Gesamtbewertung ist indikativ, nicht für Zertifizierungszwecke geeignet.',
    ],
  });

  // GWP aggregates
  const gwpMatA1A3  = matEntries.reduce((s, e) => e.gwpA1A3 != null ? s + e.gwpA1A3 : s, 0) || null;
  const gwpMatB6    = matEntries.reduce((s, e) => e.gwpB6   != null ? s + e.gwpB6   : s, 0) || null;
  const gwpMatEoL   = matEntries.reduce((s, e) => e.gwpEoL  != null ? s + e.gwpEoL  : s, 0) || null;
  const gwpMatD     = matEntries.reduce((s, e) => e.gwpD    != null ? s + e.gwpD    : s, 0) || null;
  const gwpMatLife  = [gwpMatA1A3, gwpMatB6, gwpMatEoL].reduce((s, v) => v != null ? s + v : s, 0) || null;
  const gwpProcLife = procEntries.reduce((s, e) => e.gwpLife != null ? s + e.gwpLife : s, 0) || null;
  const gwpTotal    = [gwpMatLife, gwpProcLife].reduce((s, v) => v != null ? s + v : s, 0) || null;
  const gwpGrandD   = gwpMatD;

  if (gwpTotal != null) {
    addStep({
      label: 'AGG.GWP.Total',
      category: 'Gesamtsumme GWP',
      name: 'Produkt',
      module: 'A–C',
      description: 'GWP Gesamt – Materialien + Prozesse – Lifecycle A–C',
      formula: 'GWP Materialien (A–C) + GWP Prozesse (rückgerechnet) = GWP Gesamt A–C',
      inputs: [
        { key: 'GWP Materialien A1–A3', value: gwpMatA1A3 != null ? `${fmtFull(gwpMatA1A3)} kg CO₂ eq.` : 'n. v.' },
        { key: 'GWP Materialien B6',    value: gwpMatB6   != null ? `${fmtFull(gwpMatB6)}   kg CO₂ eq.` : 'n. v.' },
        { key: 'GWP Materialien C3+C4', value: gwpMatEoL  != null ? `${fmtFull(gwpMatEoL)}  kg CO₂ eq.` : 'n. v.' },
        { key: 'GWP Prozesse (rückgerechnet)', value: gwpProcLife != null ? `${fmtFull(gwpProcLife)} kg CO₂ eq.` : 'n. v.' },
      ],
      factors: [],
      calc: `${fmtFull(gwpMatLife)} + ${fmtFull(gwpProcLife)} = ${fmtFull(gwpTotal)}`,
      rawResult: gwpTotal, scaledResult: gwpTotal, unit: 'kg CO₂ eq.',
      note: 'Modul D separat. GWP Prozesse rückgerechnet aus EF 3.1 climate_change Pt.',
      assumptions: [],
      limitations: [
        'GWP für IDEMAT-Prozesse ist aus EF 3.1-Pt rückgerechnet, kein originaler Deklarationswert.',
        'Modul D nicht im Lifecycle A–C-Wert enthalten.',
      ],
    });
  }

  return {
    entries,
    trace,
    ptSummary: { matsA1A3, matsB6, matsEoL, matsD, matsLife, procsTotal, grandTotal },
    gwpSummary: { gwpMatA1A3, gwpMatB6, gwpMatEoL, gwpMatD, gwpMatLife, gwpProcLife, gwpTotal, gwpGrandD },
  };
}
