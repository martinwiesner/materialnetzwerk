// EF 3.1-Einzelwerte (normalisiert + gewichtet) sind in Pt (EcoPoints) angegeben.
// Pro-kg-Werte liegen oft im Bereich 1e-5 bis 1e-8 Pt und lesen sich als rohe
// Pt-Zahl schlecht ("0.00005549 Pt"). formatPt skaliert automatisch auf die
// besser lesbare Einheit (Pt / mPt / µPt), sodass die Zahl selbst meist
// zwischen 1 und 999 bleibt. 1 Pt = 1.000 mPt = 1.000.000 µPt.
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
  if (abs >= 0.001) return `${(n * 1_000).toLocaleString('de-DE', { maximumFractionDigits: 3 })} mPt`;
  if (abs >= 0.000001) return `${(n * 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 3 })} µPt`;
  // Extrem seltener Fall, unterhalb der µPt-Skala noch sinnvoll lesbar zu machen.
  return `${n.toExponential(2)} Pt`;
}
