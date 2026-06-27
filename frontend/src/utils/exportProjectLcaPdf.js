import { buildLcaWithTrace, EF31_CONV, NOT_CONV, COVERED_WF, GWP_NORM, GWP_WF, fmtN, fmtGWP, fmtFull, unitInfo } from './lcaCalcTrace.js';

const APP_VERSION = '1.0.0';
const CALC_VERSION = '2026-06-27';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dateStr() {
  return new Date().toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── CSS shared across all export modes ───────────────────────────────────────

const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 10pt;
    color: #1f2937;
    background: #fff;
    padding: 24px 32px 0;
    max-width: 860px;
    margin: 0 auto;
  }
  h1 { font-size: 22pt; font-weight: 900; color: #111827; margin-bottom: 4px; }
  h2 { font-size: 13pt; font-weight: 800; color: #111827; margin: 20px 0 8px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
  h3 { font-size: 11pt; font-weight: 700; color: #374151; margin: 14px 0 6px; }
  h4 { font-size: 10pt; font-weight: 700; color: #6b7280; margin: 10px 0 4px; }
  p { margin-bottom: 6px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 12px; }
  thead tr { background: #f3f4f6; }
  thead th { text-align: left; padding: 6px 8px; font-weight: 700; font-size: 8pt;
             text-transform: uppercase; letter-spacing: 0.04em; color: #374151;
             border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
  thead th.right { text-align: right; }
  tbody td { padding: 5px 8px; vertical-align: top; line-height: 1.4; border-bottom: 1px solid #f3f4f6; }
  tbody td.right { text-align: right; font-family: monospace; }
  tbody td.label { font-weight: 600; color: #111827; }
  tbody td.mono  { font-family: monospace; }
  tfoot td { padding: 6px 8px; font-weight: 700; border-top: 2px solid #e5e7eb; }
  tfoot td.right { text-align: right; font-family: monospace; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0; }
  .kpi-card { border: 1.5px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
  .kpi-card.dark { background: #15803d; border-color: #15803d; color: white; }
  .kpi-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
               letter-spacing: 0.06em; color: #6b7280; margin-bottom: 2px; }
  .kpi-card.dark .kpi-label { color: #d1fae5; }
  .kpi-value { font-size: 14pt; font-weight: 800; font-family: monospace; color: #111827; }
  .kpi-card.dark .kpi-value { color: white; }
  .kpi-unit { font-size: 8pt; color: #6b7280; }
  .kpi-card.dark .kpi-unit { color: #a7f3d0; }
  .warn-box { background: #fffbeb; border: 1.5px solid #fbbf24; border-radius: 6px;
              padding: 8px 12px; margin: 10px 0; font-size: 9pt; }
  .info-box { background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 6px;
              padding: 8px 12px; margin: 10px 0; font-size: 9pt; }
  .error-box { background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 6px;
               padding: 8px 12px; margin: 10px 0; font-size: 9pt; }
  .badge { display: inline-block; font-size: 7pt; font-weight: 700; text-transform: uppercase;
           letter-spacing: 0.05em; padding: 1px 5px; border-radius: 3px; margin-right: 4px; }
  .badge-mat  { background: #dbeafe; color: #1d4ed8; }
  .badge-proc { background: #d1fae5; color: #065f46; }
  .badge-gwp  { background: #ffedd5; color: #c2410c; }
  .badge-warn { background: #fef3c7; color: #92400e; }
  .section-break { page-break-before: always; }
  footer-area { display: block; margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb;
                font-size: 8pt; color: #9ca3af; }
  .no-print { display: block; margin: 20px 0 8px; text-align: center; padding-bottom: 24px; }
  .bar-row { display: flex; align-items: center; gap: 8px; margin: 3px 0; }
  .bar-label { min-width: 160px; font-size: 8.5pt; color: #374151; }
  .bar-track { flex: 1; height: 10px; background: #f3f4f6; border-radius: 3px; overflow: hidden; }
  .bar-fill  { height: 100%; border-radius: 3px; }
  .bar-val   { min-width: 80px; text-align: right; font-size: 8pt; font-family: monospace; }
  /* Trace styles */
  .trace-step { border: 1px solid #e5e7eb; border-radius: 6px; margin: 8px 0;
                page-break-inside: avoid; overflow: hidden; }
  .trace-head { display: flex; gap: 8px; align-items: center; background: #f9fafb;
                padding: 6px 10px; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
  .trace-id   { font-size: 7.5pt; font-weight: 800; font-family: monospace;
                background: #e5e7eb; padding: 1px 6px; border-radius: 3px; color: #374151; }
  .trace-cat  { font-size: 7.5pt; font-weight: 700; color: #6b7280; }
  .trace-name { font-size: 8pt; font-weight: 600; color: #111827; }
  .trace-mod  { font-size: 7.5pt; background: #dbeafe; color: #1d4ed8; padding: 1px 5px; border-radius: 3px; }
  .trace-body { padding: 8px 10px; }
  .trace-desc { font-size: 8.5pt; color: #374151; margin-bottom: 4px; font-style: italic; }
  .trace-formula { font-size: 9pt; font-family: monospace; font-weight: 700; color: #065f46;
                   background: #f0fdf4; border-left: 3px solid #22c55e;
                   padding: 4px 8px; margin: 6px 0; border-radius: 0 4px 4px 0; }
  .trace-calc   { font-size: 9pt; font-family: monospace; color: #7c3aed;
                  background: #faf5ff; border-left: 3px solid #a78bfa;
                  padding: 4px 8px; margin: 6px 0; border-radius: 0 4px 4px 0; }
  .trace-result { font-size: 10pt; font-family: monospace; font-weight: 800; color: #111827;
                  background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 4px;
                  padding: 4px 10px; margin-top: 6px; display: inline-block; }
  .trace-note   { font-size: 8pt; color: #6b7280; margin-top: 4px; }
  .trace-limit  { font-size: 8pt; color: #b45309; margin-top: 2px; }
  .trace-tbl { width: 100%; margin: 4px 0; font-size: 8pt; border-collapse: collapse; }
  .trace-tbl td { padding: 2px 8px; border: 1px solid #f3f4f6; }
  .trace-tbl td:first-child { width: 46%; font-weight: 600; color: #374151; background: #f9fafb; }
  .trace-tbl td:last-child  { font-family: monospace; color: #111827; }
  .trace-sect { margin: 12px 0; }
  @media print {
    body { padding: 0; max-width: none; font-size: 9pt; }
    @page { margin: 1.5cm; size: A4; }
    .no-print { display: none !important; }
    .section-break { page-break-before: always; }
    .trace-step { page-break-inside: avoid; }
    h2 { page-break-after: avoid; }
  }
`;

// ── Section generators ────────────────────────────────────────────────────────

function secCover(project) {
  const d = dateStr();
  return `
  <div style="border-bottom:3px solid #15803d;padding-bottom:12px;margin-bottom:20px;">
    <div style="font-size:9pt;font-weight:700;color:#15803d;letter-spacing:0.08em;
                text-transform:uppercase;margin-bottom:8px;">RZZ Materialien · Umweltbilanz</div>
    <h1>${esc(project.name || 'Projekt')}</h1>
    <p style="color:#6b7280;margin-top:4px;">${esc(project.description || '')}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:14px;font-size:9pt;">
      ${project.client_name   ? `<div><b>Auftraggeber:</b> ${esc(project.client_name)}</div>` : ''}
      ${project.location_name ? `<div><b>Standort:</b> ${esc(project.location_name)}</div>` : ''}
      ${project.status        ? `<div><b>Status:</b> ${esc(project.status)}</div>` : ''}
      <div><b>Exportiert:</b> ${d}</div>
      <div><b>Berechnungsversion:</b> ${CALC_VERSION}</div>
      <div><b>Projekt-ID:</b> ${esc(project.id || '—')}</div>
    </div>
  </div>`;
}

function secSummaryKpis(ptSummary, gwpSummary, entries) {
  const { grandTotal, matsLife, procsTotal, matsD } = ptSummary;
  const { gwpTotal, gwpGrandD } = gwpSummary;
  const matN  = entries.filter(e => e.type === 'material').length;
  const procN = entries.filter(e => e.type === 'process').length;

  return `
  <h2>1 · Gesamtbilanz</h2>
  <div class="kpi-grid">
    <div class="kpi-card dark">
      <div class="kpi-label">Ind. kombinierte Pt-Bewertung</div>
      <div class="kpi-value">${fmtN(grandTotal)}</div>
      <div class="kpi-unit">Pt (indikativ)</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">davon Materialien</div>
      <div class="kpi-value">${fmtN(matsLife)}</div>
      <div class="kpi-unit">Pt ${matN > 0 ? '(Teilscore, ~72 % EF 3.1)' : ''}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">davon Prozesse (IDEMAT)</div>
      <div class="kpi-value">${fmtN(procsTotal)}</div>
      <div class="kpi-unit">Pt (ind., 16 Kat. als Datenf.)</div>
    </div>
    <div class="kpi-card" style="background:#fff7ed;border-color:#fed7aa;">
      <div class="kpi-label" style="color:#9a3412;">GWP Gesamt (ind.)</div>
      <div class="kpi-value" style="color:#9a3412;">${fmtGWP(gwpTotal)}</div>
      <div class="kpi-unit" style="color:#c2410c;">kg CO₂ eq.</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Modul D (sep.)</div>
      <div class="kpi-value">${fmtN(matsD)}</div>
      <div class="kpi-unit">Pt (Gutschriften, separat)</div>
    </div>
    ${gwpGrandD != null && gwpGrandD !== 0 ? `
    <div class="kpi-card">
      <div class="kpi-label">GWP Modul D (sep.)</div>
      <div class="kpi-value">${fmtGWP(gwpGrandD)}</div>
      <div class="kpi-unit">kg CO₂ eq.</div>
    </div>` : '<div></div>'}
  </div>
  <div class="warn-box">
    ⚠ <b>Methodischer Hinweis – Indikative Bewertung:</b>
    Materialien aus EN 15804+A2-EPDs: nur ca. ${Math.round(COVERED_WF * 100)} % der EF 3.1-Gewichtung umrechenbar
    (fehlende Kategorien: Feinstaub, Human-/Ökotoxizität, Ionisierende Strahlung, Landnutzung).
    IDEMAT-Prozesse: 16 EF 3.1-Wirkungskategorien als Datenfelder; methodische Äquivalenz zu verifizierten EPDs nicht vollständig validiert.
    Modul D wird separat ausgewiesen und darf nicht zum Gesamtscore addiert werden.
    Die Gesamtbewertung ist indikativ und nicht für Zertifizierungszwecke geeignet.
  </div>`;
}

function secMaterials(entries, opts = {}) {
  const mats = entries.filter(e => e.type === 'material');
  if (!mats.length) return '';
  const detailed = opts.detailed;

  // Detect unit mismatches for warning
  const unitIssues = (opts.rawEpdMats || []).map(m => ({ name: m.name, ui: unitInfo(m) }))
    .filter(x => x.ui.mismatch);

  const rows = mats.map((e, i) => {
    const rawMat = opts.rawEpdMats?.[i];
    const ui = rawMat ? unitInfo(rawMat) : null;
    const unitCell = ui
      ? ui.mismatch
        ? `<td style="font-size:8pt;">
             <span style="color:#b45309;font-weight:600;">${esc(ui.enteredUnit)}</span>
             <span style="color:#9ca3af;"> → </span>
             <span style="color:#374151;">${esc(ui.declaredUnit)}</span>
             <span style="color:#b45309;" title="${esc(ui.note)}"> ⚠</span>
           </td>`
        : `<td style="font-size:8pt;color:#6b7280;">${esc(e.unit)}</td>`
      : `<td style="font-size:8pt;color:#6b7280;">${esc(e.unit)}</td>`;

    return `
    <tr>
      <td class="label">${esc(e.name)}</td>
      <td><span class="badge ${e.isLib ? 'badge-mat' : ''}">${esc(e.source)}</span></td>
      <td class="right">${fmtN(e.qty)}</td>
      ${detailed ? unitCell : ''}
      ${detailed ? `<td style="font-size:8pt;color:#6b7280;">${esc(e.unit === e.srcRef ? '—' : (rawMat?.declaredUnit || e.unit))}</td>` : ''}
      <td class="right">${fmtN(e.a1a3Pt)}</td>
      ${detailed ? `<td class="right">${fmtN(e.b6Pt)}</td><td class="right">${fmtN(e.eolPt)}</td>` : ''}
      <td class="right"><b>${fmtN(e.lifePt)}</b></td>
      <td class="right">${e.dPt !== 0 ? fmtN(e.dPt) : '—'}</td>
      ${detailed ? `<td class="right">${fmtGWP(e.gwpA1A3)}</td>` : ''}
    </tr>`;
  }).join('');

  return `
  <h2>2 · Materialien</h2>
  <p style="font-size:8.5pt;color:#6b7280;">${mats.length} Material(ien) mit EPD-Daten</p>
  ${mats.some(e => e.coveredInds && e.coveredInds.length < 10) ? `
  <div class="warn-box"><span class="badge badge-warn">Teilscore</span>
    Nicht alle EF 3.1-Kategorien aus EPD-Daten umrechenbar (~72 % der EF 3.1-Gewichtung).
  </div>` : ''}
  ${unitIssues.length ? `
  <div class="warn-box" style="border-color:#f59e0b;background:#fffbeb;">
    ⚠ <b>Einheitenhinweis:</b> Bei ${unitIssues.length} Material(ien) weicht die Eingabeeinheit
    von der deklarierten EPD-Einheit ab. Die Berechnung verwendet die Eingabemenge direkt
    ohne automatische Konversion.
    Bitte prüfen, ob die eingegebenen Mengen bereits der EPD-Bezugsgröße entsprechen.<br/>
    ${unitIssues.map(x => `<span style="margin-top:4px;display:inline-block;">
      <b>${esc(x.name)}:</b> Eingabe ${esc(x.ui.enteredUnit)} / EPD-Bezug ${esc(x.ui.declaredUnit)}
      → Faktor ${x.ui.factor} (${fmtFull(1)} ${esc(x.ui.enteredUnit)} = ${fmtFull(x.ui.factor)} ${esc(x.ui.declaredUnit)})
    </span>`).join('<br/>')}
  </div>` : ''}
  <table>
    <thead><tr>
      <th>Material</th><th>Quelle</th><th class="right">Menge</th>
      ${detailed ? '<th>Eingabeeinheit</th><th>EPD-Einheit</th>' : ''}
      <th class="right">A1–A3 Pt</th>
      ${detailed ? '<th class="right">B6 Pt</th><th class="right">EoL Pt</th>' : ''}
      <th class="right">Modul-Summe Pt</th><th class="right">D Pt</th>
      ${detailed ? '<th class="right">GWP A1–A3 kg CO₂ eq.</th>' : ''}
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="${detailed ? 5 : 3}" class="label">Σ Materialien</td>
      <td class="right">${fmtN(mats.reduce((s,e)=>s+e.a1a3Pt,0))}</td>
      ${detailed ? `<td class="right">${fmtN(mats.reduce((s,e)=>s+e.b6Pt,0))}</td>
                   <td class="right">${fmtN(mats.reduce((s,e)=>s+e.eolPt,0))}</td>` : ''}
      <td class="right"><b>${fmtN(mats.reduce((s,e)=>s+e.lifePt,0))}</b></td>
      <td class="right">${fmtN(mats.reduce((s,e)=>s+e.dPt,0))}</td>
      ${detailed ? `<td class="right">${fmtGWP(mats.reduce((s,e)=>e.gwpA1A3!=null?s+e.gwpA1A3:s,0)||null)}</td>` : ''}
    </tr></tfoot>
  </table>`;
}

function secProcesses(entries, opts = {}) {
  const procs = entries.filter(e => e.type === 'process');
  if (!procs.length) return '';
  const detailed = opts.detailed;

  const rows = procs.map(e => `
    <tr>
      <td class="label">${esc(e.name)}</td>
      <td style="font-size:8pt;color:#6b7280;">${esc(e.category || '—')}</td>
      <td class="right">${fmtN(e.qty)} ${esc(e.unit)}</td>
      <td class="right"><b>${fmtN(e.lifePt)}</b></td>
      ${detailed ? `<td class="right">${fmtGWP(e.gwpA1A3)}</td>` : ''}
    </tr>`).join('');

  return `
  <h2>3 · Prozesse (IDEMAT 2026)</h2>
  <p style="font-size:8.5pt;color:#6b7280;">${procs.length} Prozess(e) · IDEMAT 2026 (TU Delft, CC BY-NC) · EF 3.1 (ind.) · 16 Wirkungskategorien als Datenfelder · kein Lebenszyklusmodul zugeordnet</p>
  <table>
    <thead><tr>
      <th>Prozess</th><th>Kategorie</th><th class="right">Menge</th>
      <th class="right">EF 3.1 Total Pt</th>
      ${detailed ? '<th class="right">GWP (rückger.)</th>' : ''}
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="3" class="label">Σ Prozesse</td>
      <td class="right"><b>${fmtN(procs.reduce((s,e)=>s+e.lifePt,0))}</b></td>
      ${detailed ? `<td class="right">${fmtGWP(procs.reduce((s,e)=>e.gwpA1A3!=null?s+e.gwpA1A3:s,0)||null)}</td>` : ''}
    </tr></tfoot>
  </table>`;
}

function secGWP(entries, gwpSummary) {
  const { gwpMatA1A3, gwpMatB6, gwpMatEoL, gwpMatD, gwpMatLife, gwpProcLife, gwpTotal, gwpGrandD } = gwpSummary;
  const mats  = entries.filter(e => e.type === 'material');
  const procs = entries.filter(e => e.type === 'process');
  const hasProcGwp = procs.some(e => e.gwpA1A3 != null);

  const matRows = mats.map(e => `
    <tr>
      <td><span class="badge badge-mat">Mat</span>${esc(e.name)}</td>
      <td class="right">${fmtGWP(e.gwpA1A3)}</td>
      <td class="right">${fmtGWP(e.gwpB6)}</td>
      <td class="right">${fmtGWP(e.gwpEoL)}</td>
      <td class="right" style="color:#6b7280;">${fmtGWP(e.gwpD)}</td>
      <td class="right"><b>${fmtGWP(e.gwpLife)}</b></td>
      <td style="font-size:8pt;color:#6b7280;">EPD direkt</td>
    </tr>`).join('');

  const procRows = procs.map(e => `
    <tr>
      <td><span class="badge badge-proc">Proz</span>${esc(e.name)}</td>
      <td class="right">${fmtGWP(e.gwpA1A3)}</td>
      <td class="right" style="color:#d1d5db;">—</td>
      <td class="right" style="color:#d1d5db;">—</td>
      <td class="right" style="color:#d1d5db;">—</td>
      <td class="right"><b>${fmtGWP(e.gwpLife)}</b></td>
      <td style="font-size:8pt;color:#6b7280;">Rückrechnung EF 3.1 ⁺</td>
    </tr>`).join('');

  return `
  <h2>4 · GWP – Treibhausgaspotenzial</h2>
  <table>
    <thead><tr>
      <th>Position</th>
      <th class="right">A1–A3</th><th class="right">B6</th>
      <th class="right">EoL</th><th class="right">D</th>
      <th class="right">Gesamt (dekl.)</th><th>Quelle</th>
    </tr><tr style="font-size:7.5pt;color:#9ca3af;">
      <td colspan="7">Einheit: kg CO₂ eq.</td>
    </tr></thead>
    <tbody>
      ${matRows}
      ${mats.length > 1 ? `<tr style="background:#dbeafe;font-weight:600;">
        <td style="padding-left:8px;color:#1d4ed8;">Σ Materialien</td>
        <td class="right">${fmtGWP(gwpMatA1A3)}</td>
        <td class="right">${fmtGWP(gwpMatB6)}</td>
        <td class="right">${fmtGWP(gwpMatEoL)}</td>
        <td class="right" style="color:#0891b2;">${fmtGWP(gwpMatD)}</td>
        <td class="right"><b>${fmtGWP(gwpMatLife)}</b></td>
        <td style="font-size:8pt;color:#6b7280;">EPD</td>
      </tr>` : ''}
      ${procRows}
      ${procs.length > 1 && hasProcGwp ? `<tr style="background:#d1fae5;font-weight:600;">
        <td style="padding-left:8px;color:#065f46;">Σ Prozesse</td>
        <td class="right">${fmtGWP(gwpProcLife)}</td>
        <td class="right" style="color:#d1d5db;">—</td>
        <td class="right" style="color:#d1d5db;">—</td>
        <td class="right" style="color:#d1d5db;">—</td>
        <td class="right"><b>${fmtGWP(gwpProcLife)}</b></td>
        <td style="font-size:8pt;color:#6b7280;">EF 3.1 ⁺</td>
      </tr>` : ''}
    </tbody>
    <tfoot>
      <tr style="background:#9a3412;color:white;">
        <td class="label" style="color:white;">Gesamt (indikativ)</td>
        <td class="right">${fmtGWP((gwpMatA1A3??0)+(gwpProcLife??0))}</td>
        <td class="right">${fmtGWP(gwpMatB6)}</td>
        <td class="right">${fmtGWP(gwpMatEoL)}</td>
        <td class="right" style="color:#fed7aa;">—</td>
        <td class="right"><b>${fmtGWP(gwpTotal)}</b></td>
        <td style="font-size:8pt;color:#fed7aa;">kg CO₂ eq.</td>
      </tr>
      ${gwpGrandD != null && gwpGrandD !== 0 ? `
      <tr style="background:#f1f5f9;">
        <td class="label">Modul D (Gutschriften, separat)</td>
        <td class="right" style="color:#d1d5db;">—</td>
        <td class="right" style="color:#d1d5db;">—</td>
        <td class="right" style="color:#d1d5db;">—</td>
        <td class="right" style="color:#0891b2;font-weight:700;">${fmtGWP(gwpGrandD)}</td>
        <td class="right" style="color:#0891b2;font-weight:700;">${fmtGWP(gwpGrandD)}</td>
        <td style="font-size:8pt;color:#6b7280;">sep.</td>
      </tr>` : ''}
    </tfoot>
  </table>
  ${hasProcGwp ? `<p style="font-size:8pt;color:#6b7280;margin-top:-6px;">
    ⁺ GWP für Prozesse rückgerechnet:
    GWP [kg CO₂ eq.] = climate_change_Pt × ${GWP_NORM.toLocaleString('de-DE')} / ${GWP_WF}
    (EF 3.1-Normierungsfaktor / Gewichtungsfaktor, EC JRC 2021). Entspricht dem ursprünglichen IDEMAT-GWP-Midpoint.
  </p>` : ''}`;
}

function secEF31(entries, ptSummary) {
  const mats  = entries.filter(e => e.type === 'material');
  const procs = entries.filter(e => e.type === 'process');
  const { matsA1A3, matsB6, matsEoL, matsD, matsLife, procsTotal, grandTotal } = ptSummary;

  const ef31Rows = Object.entries(EF31_CONV).map(([indKey, { ef31, label, unit }]) => {
    const matA1A3 = mats.reduce((s, e) => {
      const raw = e.source?.includes('IDEMAT') ? 0 : 0; // mat entries don't store per-category
      return s; // we'd need per-cat data to show this
    }, null);
    return { ef31, label, unit };
  });

  const procEf31 = procs.flatMap(e =>
    e.ef31 ? Object.entries(e.ef31).map(([k, v]) => ({ proc: e, key: k, val: v * e.qty })) : []
  );

  const catTotals = {};
  for (const p of procEf31) {
    catTotals[p.key] = (catTotals[p.key] || 0) + (p.val || 0);
  }

  const phases = [
    { key: 'A1–A3', pt: matsA1A3 + procsTotal, label: 'A1–A3 (Mat.) + Prozesse (ind.)' },
    { key: 'B6',    pt: matsB6,                 label: 'B6 Materialien' },
    { key: 'EoL',   pt: matsEoL,                label: 'EoL / C3+C4 Materialien' },
    { key: 'D',     pt: matsD,                  label: 'Modul D (sep.)' },
  ];
  const maxPt = Math.max(...phases.map(p => Math.abs(p.pt)), 0.0001);

  return `
  <h2>5 · Ind. EF 3.1 Pt-Bewertung nach Lebenszyklusphasen</h2>
  <div style="margin:12px 0;">
    ${phases.map(ph => {
      const pct = Math.max(2, Math.abs(ph.pt) / maxPt * 100);
      return `
      <div class="bar-row">
        <div class="bar-label">${esc(ph.label)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${ph.key==='D'?'#93c5fd':'#059669'};"></div></div>
        <div class="bar-val">${fmtN(ph.pt)} Pt</div>
      </div>`;
    }).join('')}
    <div class="bar-row" style="margin-top:6px;border-top:1px solid #e5e7eb;padding-top:6px;">
      <div class="bar-label" style="font-weight:700;">Indikative Gesamtbewertung</div>
      <div class="bar-track"><div class="bar-fill" style="width:100%;background:#15803d;"></div></div>
      <div class="bar-val" style="font-weight:700;">${fmtN(grandTotal)} Pt</div>
    </div>
  </div>

  ${procs.length && Object.keys(catTotals).length ? `
  <h3>EF 3.1 Kategorien – IDEMAT-Prozesse</h3>
  <table>
    <thead><tr><th>EF 3.1 Kategorie</th><th class="right">Σ Prozesse (Pt × Menge)</th></tr></thead>
    <tbody>
      ${Object.entries(catTotals).sort((a,b) => Math.abs(b[1])-Math.abs(a[1])).map(([k,v])=>`
      <tr>
        <td>${esc(Object.values(EF31_CONV).find(c=>c.ef31===k)?.label || k)}</td>
        <td class="right">${fmtN(v)}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}`;
}

function secMethodology() {
  return `
  <h2>6 · Methodenhinweise und Einschränkungen</h2>
  <div class="info-box">
    <b>EF 3.1 (Environmental Footprint 3.1):</b> Normierungsbasierte und gewichtete Lebenszyklusbewertungsmethode
    der Europäischen Kommission (EC JRC, 2021). 16 Wirkungskategorien, normiert auf
    Person·Jahr, gewichtet auf dimensionslose Punktzahl (Pt = Punkte).
  </div>
  <div class="info-box">
    <b>EN 15804+A2 (EPD-Norm):</b> Deklarationsnorm für Umwelt-Produktdeklarationen (EPDs) von Bauprodukten.
    Pflichtindikatoren umfassen GWP, ODP, AP, EP-terrestrial, EP-freshwater, EP-marine, POCP,
    ADP-fossil, ADP-elements, WDP. Diese 10 Indikatoren entsprechen 10 der 16 EF 3.1-Kategorien (~72 % Gewichtung).
  </div>
  <div class="warn-box">
    <b>Nicht konvertierbare EF 3.1-Kategorien aus EN 15804+A2 (~28 % Gewichtung):</b><br/>
    ${NOT_CONV.map(c => `${esc(c.label)} (Gewichtungsfaktor: ${c.wf})`).join(' · ')}<br/>
    Diese Kategorien fehlen im Materialanteil. Der Material-Pt-Score ist daher ein <b>Teilscore</b>.
  </div>
  <div class="warn-box">
    <b>IDEMAT 2026 (TU Delft, CC BY-NC):</b> EF 3.1-Prozessdatenbank. Enthält alle 16 EF 3.1-Kategorien.
    Keine Modulaufgliederung (A1–A3, B6, C) vorhanden — Gesamtscore enthält alle Lebensphasen.
  </div>
  <table>
    <thead><tr><th>Aspekt</th><th>Behandlung</th></tr></thead>
    <tbody>
      <tr><td>Modul D (Gutschriften)</td><td>Separat ausgewiesen, nicht in A–C-Score eingerechnet</td></tr>
      <tr><td>Fehlende Werte</td><td>Als „—" oder „n. v." angezeigt, nie als 0 gewertet</td></tr>
      <tr><td>Biogenes GWP</td><td>Nur wenn vom EPD als GWP-biogenic deklariert; nicht automatisch berücksichtigt</td></tr>
      <tr><td>Negative GWP-Werte</td><td>Werden direkt übernommen (biogene Speicherwirkung oder Gutschrift)</td></tr>
      <tr><td>Nullwerte</td><td>Nur wenn vom EPD explizit als 0 deklariert</td></tr>
      <tr><td>Skalierung</td><td>Alle Werte mit tatsächlicher Einsatzmenge multipliziert</td></tr>
      <tr><td>EF 3.1 Umrechnungsformel</td><td>Pt = (Indikatorwert / Normierungsfaktor) × Gewichtungsfaktor</td></tr>
      <tr><td>GWP Rückrechnung IDEMAT</td><td>GWP = climate_change_Pt × 7.550 / 0,2106</td></tr>
    </tbody>
  </table>`;
}

function secDataSources(entries, rawEpdMats) {
  const mats  = entries.filter(e => e.type === 'material');
  const procs = entries.filter(e => e.type === 'process');

  const matRows = mats.map((e, i) => {
    const rawMat = rawEpdMats?.[i];
    const ui = rawMat ? unitInfo(rawMat) : null;
    const unitNote = ui?.mismatch
      ? `<br/><span style="color:#b45309;font-size:7.5pt;">⚠ Eingabe: ${ui.enteredUnit} / EPD-Bezug: ${ui.declaredUnit} (Faktor ${ui.factor})</span>`
      : '';
    return `
    <tr>
      <td class="label">${esc(e.name)}</td>
      <td>${e.isLib ? 'Materialdatenbank (intern)' : 'ÖKOBAUDAT'}</td>
      <td style="font-size:8pt;font-family:monospace;">${esc(e.srcRef || '—')}</td>
      <td>EN 15804+A2</td>
      <td>${fmtN(e.qty)} ${esc(e.unit)}${unitNote}</td>
    </tr>`;
  }).join('');

  const procRows = procs.map(e => `
    <tr>
      <td class="label">${esc(e.name)}</td>
      <td>IDEMAT 2026</td>
      <td style="font-size:8pt;font-family:monospace;">${esc(e.srcRef || '—')}</td>
      <td>EF 3.1</td>
      <td>${fmtN(e.qty)} ${esc(e.unit)}</td>
    </tr>`).join('');

  return `
  <h2>7 · Datenquellen und Datensätze</h2>
  <h3>Materialien und Prozesse</h3>
  <table>
    <thead><tr><th>Name</th><th>Datenbank</th><th>Datensatz-ID</th><th>Methode/Norm</th><th class="right">Menge</th></tr></thead>
    <tbody>${matRows}${procRows}</tbody>
  </table>
  <h3>EF 3.1 Faktoren (Normierung und Gewichtung)</h3>
  <table>
    <thead><tr><th>EF 3.1 Kategorie / EN 15804+A2-Indikator</th><th class="right">Normierungsfaktor</th><th>Einheit</th><th class="right">Gewichtungsfaktor</th><th>Quelle</th></tr></thead>
    <tbody>
      ${Object.entries(EF31_CONV).map(([indKey, {norm, wf, label, unit}]) => `
      <tr>
        <td><b>${esc(label)}</b> ← ${esc(indKey)}</td>
        <td class="right">${norm.toLocaleString('de-DE')}</td>
        <td>${esc(unit)}/(Person·Jahr)</td>
        <td class="right">${wf}</td>
        <td style="font-size:8pt;color:#6b7280;">EC JRC, EF 3.1, 2021</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function secVersionInfo(project) {
  const now = new Date();
  return `
  <h2>8 · Versions- und Reproduzierbarkeitsnachweis</h2>
  <table>
    <tbody>
      <tr><td class="label" style="width:220px;">Softwareversion</td><td>${APP_VERSION}</td></tr>
      <tr><td class="label">Berechnungsversion</td><td>${CALC_VERSION}</td></tr>
      <tr><td class="label">EF 3.1 Methodenversion</td><td>EF 3.1 (EC JRC, 2021)</td></tr>
      <tr><td class="label">IDEMAT-Datenbankversion</td><td>IDEMAT 2026 (TU Delft)</td></tr>
      <tr><td class="label">ÖKOBAUDAT</td><td>ÖKOBAUDAT 2024 (sofern verwendet)</td></tr>
      <tr><td class="label">Berechnungszeitpunkt</td><td>${now.toLocaleString('de-DE')}</td></tr>
      <tr><td class="label">Exportzeitpunkt</td><td>${now.toLocaleString('de-DE')}</td></tr>
      <tr><td class="label">Projekt-ID</td><td>${esc(project.id || '—')}</td></tr>
    </tbody>
  </table>
  <p style="font-size:8pt;color:#6b7280;">
    Die im Bericht ausgewiesenen Werte entsprechen exakt den in der Anwendung angezeigten Werten.
    Der Berechnungsnachweis basiert auf demselben Algorithmus wie die Frontend-Darstellung
    (Berechnungsversion ${CALC_VERSION}).
  </p>`;
}

// ── Full Calculation Trace ────────────────────────────────────────────────────

function secCalcTrace(trace) {
  function stepHtml(s) {
    const inputRows = (s.inputs || []).map(({key, value}) =>
      `<tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`
    ).join('');
    const factorRows = (s.factors || []).map(({key, value, src}) =>
      `<tr><td>${esc(key)}</td><td>${esc(value)}${src ? ` <span style="color:#9ca3af;font-size:7.5pt;">[${esc(src)}]</span>` : ''}</td></tr>`
    ).join('');
    const hasResult = s.scaledResult != null;
    const resultStr = hasResult
      ? `${fmtFull(s.scaledResult)} ${esc(s.unit || '')}`
      : 'n. v.';

    return `
    <div class="trace-step">
      <div class="trace-head">
        <span class="trace-id">#${String(s.stepN).padStart(3,'0')}</span>
        <span class="trace-cat">${esc(s.category || '')}</span>
        ${s.module ? `<span class="trace-mod">Modul ${esc(s.module)}</span>` : ''}
        <span class="trace-name">${esc(s.name || '')}</span>
        ${s.indicator ? `<span style="font-size:7.5pt;color:#6b7280;">Indikator: ${esc(s.indicator)}</span>` : ''}
      </div>
      <div class="trace-body">
        ${s.description ? `<div class="trace-desc">${esc(s.description)}</div>` : ''}
        ${s.formula ? `<div class="trace-formula">Formel: ${esc(s.formula)}</div>` : ''}
        ${inputRows ? `
        <div class="trace-sect">
          <div style="font-size:7.5pt;font-weight:700;color:#374151;margin-bottom:2px;">Eingangsgrößen</div>
          <table class="trace-tbl"><tbody>${inputRows}</tbody></table>
        </div>` : ''}
        ${factorRows ? `
        <div class="trace-sect">
          <div style="font-size:7.5pt;font-weight:700;color:#374151;margin-bottom:2px;">Faktoren</div>
          <table class="trace-tbl"><tbody>${factorRows}</tbody></table>
        </div>` : ''}
        ${s.calc ? `<div class="trace-calc">Rechnung: ${esc(s.calc)}</div>` : ''}
        <div class="trace-result">Ergebnis: <b>${esc(resultStr)}</b></div>
        ${s.note ? `<div class="trace-note">Hinweis: ${esc(s.note)}</div>` : ''}
        ${(s.limitations || []).length ? `
        <div class="trace-limit">
          ⚠ Einschränkungen: ${s.limitations.map(esc).join(' · ')}
        </div>` : ''}
        ${(s.assumptions || []).length ? `
        <div class="trace-note">
          Annahmen: ${s.assumptions.map(esc).join(' · ')}
        </div>` : ''}
      </div>
    </div>`;
  }

  // Group by category
  const categories = [...new Set(trace.map(s => s.category))];

  return `
  <div class="section-break">
    <h2>9 · Vollständiger Berechnungsnachweis</h2>
    <div class="warn-box">
      Dieser Abschnitt dokumentiert jeden einzelnen Berechnungsschritt in der Reihenfolge, in der er ausgeführt wurde.
      Alle Eingangs-, Zwischen- und Endwerte sind explizit angegeben.
      Die Werte stimmen exakt mit der Anwendungsanzeige überein.
      Gesamt: <b>${trace.length} Berechnungsschritte</b>.
    </div>
    ${categories.map(cat => {
      const steps = trace.filter(s => s.category === cat);
      return `
      <h3>${esc(cat)} <span style="font-size:8.5pt;font-weight:400;color:#6b7280;">(${steps.length} Schritte)</span></h3>
      ${steps.map(stepHtml).join('')}`;
    }).join('')}
  </div>`;
}

// ── Main export function ──────────────────────────────────────────────────────

/**
 * Generate and open a print-ready PDF export window.
 *
 * @param {Object} project - Project data object
 * @param {Array}  epdMats - Pre-processed EPD/library materials
 * @param {Array}  idematItems - Raw IDEMAT process items
 * @param {Object} options - Export options: { scope, sections }
 */
export function exportProjectLcaPdf(project, epdMats, idematItems, options = {}) {
  const scope    = options.scope || 'compact';
  const sections = options.sections || {};

  const detailed  = scope === 'detailed' || scope === 'full';
  const fullProof = scope === 'full';

  const show = (key, defaultVal) => {
    if (key in sections) return !!sections[key];
    return defaultVal;
  };

  const { entries, trace, ptSummary, gwpSummary } = buildLcaWithTrace(epdMats, idematItems);

  const parts = [];

  parts.push(secCover(project));

  if (show('summary', true))
    parts.push(secSummaryKpis(ptSummary, gwpSummary, entries));

  if (show('materials', true) && entries.some(e => e.type === 'material'))
    parts.push(secMaterials(entries, { detailed, rawEpdMats: epdMats }));

  if (show('processes', true) && entries.some(e => e.type === 'process'))
    parts.push(secProcesses(entries, { detailed }));

  if (show('gwp', true))
    parts.push(secGWP(entries, gwpSummary));

  if (show('ef31', true))
    parts.push(secEF31(entries, ptSummary));

  if (show('methodology', true))
    parts.push(secMethodology());

  if (detailed && show('dataSources', true))
    parts.push(secDataSources(entries, epdMats));

  if (detailed && show('versionInfo', true))
    parts.push(secVersionInfo(project));

  if (fullProof && show('calcTrace', true) && trace.length)
    parts.push(secCalcTrace(trace));

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8"/>
  <title>Umweltbilanz – ${esc(project.name || 'Projekt')}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  ${parts.join('\n')}
  <footer-area>
    RZZ Materialien · reallabor-zekiwa-zeitz.de ·
    Exportiert ${dateStr()} · Berechnungsversion ${CALC_VERSION}
    ${fullProof ? ` · Modus: Vollständiger Berechnungsnachweis · ${trace.length} Berechnungsschritte` : ''}
  </footer-area>
  <div class="no-print">
    <button
      onclick="window.print()"
      style="padding:10px 32px;background:#15803d;color:#fff;border:none;border-radius:8px;
             font-size:14px;cursor:pointer;font-weight:700;"
    >Drucken / Als PDF speichern</button>
    <p style="font-size:9pt;color:#6b7280;margin-top:8px;">
      Im Druckdialog „Als PDF speichern" wählen · Empfehlung: Querformat A4 für breite Tabellen
    </p>
  </div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=920,height=800');
  if (!w) { alert('Bitte Popups für diese Seite erlauben.'); return; }
  w.document.write(html);
  w.document.close();
}
