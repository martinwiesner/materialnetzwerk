// EF 3.1-Einzelwerte (normalisiert + gewichtet) sind in Pt (EcoPoints) angegeben.
// Pro-kg-Werte liegen oft im Bereich 1e-5 bis 1e-8 Pt und lesen sich als rohe
// Pt-Zahl schlecht ("0.00005549 Pt"). formatPt skaliert automatisch auf mPt,
// sodass die Zahl selbst meist zwischen 1 und 999 bleibt. 1 Pt = 1.000 mPt.
//
// Bewusst NICHT bis µPt (oder kleiner) skaliert: für Laien ist bereits mPt
// eine ungewohnte Einheit, eine dritte Stufe darunter macht es nur schwerer
// nachvollziehbar. Sehr kleine Werte bleiben in mPt, nur mit mehr
// Nachkommastellen; erst unterhalb von 0,000001 mPt (= 1e-9 Pt, praktisch
// vernachlässigbar) greift ein wissenschaftlicher Pt-Fallback.
//
// Nur für einzeln angezeigte Werte gedacht (Karten, Listen, Balken-Beschriftungen).
// In Vergleichstabellen mit einer festen "alle Werte in Pt"-Spaltenüberschrift
// bewusst NICHT einsetzen — dort würde eine gemischte Einheit pro Zelle
// verwirren statt helfen.
export function formatPt(v) {
  if (v == null || v === '' || isNaN(Number(v))) return '—';
  const n = Number(v);
  if (n === 0) return '0 Pt';

  const abs = Math.abs(n);
  if (abs >= 1) return `${n.toLocaleString('de-DE', { maximumFractionDigits: 3 })} Pt`;

  const mPt = n * 1_000;
  const absMPt = Math.abs(mPt);
  if (absMPt >= 0.000001) {
    // Genug Nachkommastellen für ~3 signifikante Stellen, auch bei kleinen mPt-Werten.
    const digits = absMPt >= 1 ? 3 : Math.min(8, Math.ceil(-Math.log10(absMPt)) + 3);
    return `${mPt.toLocaleString('de-DE', { maximumFractionDigits: digits })} mPt`;
  }
  // Praktisch vernachlässigbar (< 1e-9 Pt) - wissenschaftlicher Pt-Fallback.
  return `${n.toExponential(2)} Pt`;
}

/** Kurzerklärung für Laien, wo immer Pt/mPt-Werte angezeigt werden. */
export const PT_LEGEND_TEXT =
  'Pt (Points/EcoPoints) ist die Einheit der EF 3.1-Methode für den ökologischen ' +
  'Gesamt-Fußabdruck eines Produkts oder Prozesses — je niedriger, desto besser. ' +
  '1 Pt = 1.000 mPt (Millipoints). Kleine Werte werden hier automatisch in mPt ' +
  'angezeigt, damit die Zahl lesbar bleibt.';
