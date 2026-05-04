import QRCode from 'qrcode';
import { formatDate } from './dates';

// ── CSV Export ────────────────────────────────────────────────────────────────

function escapeCsv(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportMaterialsToCSV(materials) {
  const headers = [
    'Name', 'Kategorie', 'Beschreibung', 'Einheit',
    'GWP-Wert', 'GWP-Einheit', 'Recyclinganteil (%)',
    'Hersteller', 'Standort', 'Adresse',
    'Recycelbar', 'Biologisch abbaubar',
    'Erstellt am',
  ];
  const rows = materials.map((m) => [
    m.name,
    m.category,
    m.description,
    m.unit,
    m.gwp_value,
    m.gwp_unit,
    m.recycled_content ?? m.recyclate_content,
    m.manufacturer,
    m.location_name,
    m.address,
    m.recyclable ? 'Ja' : 'Nein',
    m.biodegradable ? 'Ja' : 'Nein',
    m.created_at ? formatDate(m.created_at) : '',
  ]);
  downloadCSV([headers, ...rows], 'materialien');
}

export function exportProjectsToCSV(projects) {
  const headers = [
    'Name', 'Beschreibung', 'Status', 'Auftraggeber',
    'Standort', 'Adresse', 'Erstellt am',
  ];
  const rows = projects.map((p) => [
    p.name,
    p.description,
    p.status,
    p.client_name,
    p.location_name,
    p.address,
    p.created_at ? formatDate(p.created_at) : '',
  ]);
  downloadCSV([headers, ...rows], 'projekte');
}

function downloadCSV(rows, filename) {
  const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rzz_${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF Print Export ─────────────────────────────────────────────────────────

export function exportMaterialsToPDF(materials) {
  const rows = materials
    .map(
      (m) => `
      <tr>
        <td>${m.name || ''}</td>
        <td>${m.category || ''}</td>
        <td>${m.unit || ''}</td>
        <td>${m.gwp_value != null ? `${m.gwp_value} ${m.gwp_unit || 'kg CO₂e'}` : '–'}</td>
        <td>${m.location_name || ''}</td>
        <td>${m.description ? m.description.slice(0, 120) + (m.description.length > 120 ? '…' : '') : ''}</td>
      </tr>`
    )
    .join('');

  openPrintWindow({
    title: 'Materialliste – RZZ Materialien',
    heading: 'Materialliste',
    subtitle: `${materials.length} Materialien · Stand: ${new Date().toLocaleDateString('de-DE')}`,
    tableHeaders: ['Name', 'Kategorie', 'Einheit', 'GWP', 'Standort', 'Beschreibung'],
    tableRows: rows,
  });
}

export function exportProjectsToPDF(projects) {
  const rows = projects
    .map(
      (p) => `
      <tr>
        <td>${p.name || ''}</td>
        <td>${p.status || ''}</td>
        <td>${p.client_name || ''}</td>
        <td>${p.location_name || ''}</td>
        <td>${p.description ? p.description.slice(0, 120) + (p.description.length > 120 ? '…' : '') : ''}</td>
      </tr>`
    )
    .join('');

  openPrintWindow({
    title: 'Projektliste – RZZ Materialien',
    heading: 'Projektliste',
    subtitle: `${projects.length} Projekte · Stand: ${new Date().toLocaleDateString('de-DE')}`,
    tableHeaders: ['Name', 'Status', 'Auftraggeber', 'Standort', 'Beschreibung'],
    tableRows: rows,
  });
}

// ── Shared poster helpers ─────────────────────────────────────────────────────

function buildCoverImageUrl(images) {
  const first = Array.isArray(images) ? images[0] : null;
  if (!first?.file_path) return null;
  const path = first.file_path.replace(/^\./, '');
  return `${window.location.origin}${path.startsWith('/') ? path : '/' + path}`;
}

function tearStripsHtml({ qrDataUrl, name, pathUrl, accentColor }) {
  const strips = Array.from({ length: 10 }, (_, i) => `
    <div style="
      flex:1;min-width:0;
      border-right:${i < 9 ? '1px dashed #d1d5db' : 'none'};
      display:flex;flex-direction:column;align-items:center;justify-content:space-between;
      padding:6px 3px 5px;overflow:hidden;writing-mode:vertical-rl;
    ">
      <img src="${qrDataUrl}" alt="QR" style="width:36px;height:36px;flex-shrink:0;border-radius:3px;" />
      <span style="font-size:6.5pt;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;max-height:60px;">${name.length > 22 ? name.slice(0, 21) + '…' : name}</span>
      <span style="font-size:5pt;color:${accentColor};font-family:monospace;white-space:nowrap;overflow:hidden;">${pathUrl}</span>
    </div>
  `).join('');

  return `
    <div style="margin-top:auto;page-break-inside:avoid;">
      <p style="font-size:7pt;color:#9ca3af;text-align:center;margin-bottom:2px;font-style:italic;letter-spacing:0.03em;">
        ✂ &nbsp;&nbsp; Streifen einschneiden und mitnehmen &nbsp;&nbsp; ✂
      </p>
      <div style="display:flex;border-top:2.5px dashed #d1d5db;height:135px;overflow:hidden;">
        ${strips}
      </div>
    </div>
  `;
}

// ── Angebot Poster (Aushang) ──────────────────────────────────────────────────

const VALUE_TYPE_LABELS = {
  swap: 'Tausch',
  free: 'Kostenlose Abgabe',
  loan: 'Entleihe',
  negotiable: 'Verhandlungsbasis',
  fixed: 'Fixer Preis',
};

export async function exportAngebotPoster(offer) {
  const angebotUrl = `${window.location.origin}/angebot/${offer.id}`;
  const w = window.open('', '_blank', 'width=650,height=950');
  if (!w) { alert('Bitte im Browser Popups für diese Seite erlauben.'); return; }
  w.document.write('<html><body style="font-family:sans-serif;padding:40px;color:#9ca3af">Poster wird erstellt…</body></html>');
  const qrDataUrl = await QRCode.toDataURL(angebotUrl, { width: 240, margin: 1, color: { dark: '#1a3a0a', light: '#ffffff' } });
  openAngebotPosterWindow({ offer, qrDataUrl, angebotUrl, w });
}

function openAngebotPosterWindow({ offer, qrDataUrl, angebotUrl, w }) {
  const qty = offer.quantity != null
    ? `${offer.quantity} ${offer.unit || offer.material_unit || ''}`.trim()
    : null;
  const ownerName = offer.owner_first_name
    ? `${offer.owner_first_name} ${offer.owner_last_name || ''}`.trim()
    : offer.owner_email?.split('@')[0] || null;
  const valueLabel = VALUE_TYPE_LABELS[offer.value_type] || offer.value_type || null;
  const dateStr = new Date().toLocaleDateString('de-DE');
  const price = offer.price != null
    ? `${offer.price}${offer.price_unit ? ' ' + offer.price_unit : ' €'}`
    : null;
  const coverImageUrl = buildCoverImageUrl(offer.images);
  const pathUrl = `/angebot/${offer.id}`;

  w.document.write(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8"/>
  <title>Angebot: ${offer.material_name || 'Materialangebot'} – RZZ Materialien</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1f2937; padding: 32px 36px 0; max-width: 560px; margin: 0 auto; display:flex; flex-direction:column; min-height:277mm; }
    .brand { display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #3b6e14; padding-bottom:10px; margin-bottom:16px; }
    .brand-name { font-size:13pt; font-weight:800; color:#3b6e14; letter-spacing:-0.02em; }
    .brand-date { font-size:8pt; color:#9ca3af; }
    .cover-img { width:100%; height:200px; object-fit:cover; border-radius:10px; margin-bottom:14px; }
    .type-badge { display:inline-block; background:#ecfdf5; color:#065f46; border:1.5px solid #6ee7b7; border-radius:20px; padding:4px 14px; font-size:10pt; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:10px; }
    .material-name { font-size:26pt; font-weight:900; color:#111827; line-height:1.1; margin-bottom:12px; }
    .value-highlight { display:inline-flex; align-items:center; gap:8px; background:#f0fdf4; border:1.5px solid #86efac; border-radius:12px; padding:7px 14px; font-size:11pt; font-weight:700; color:#15803d; margin-bottom:14px; }
    .details-grid { display:grid; grid-template-columns:auto 1fr; gap:5px 14px; margin-bottom:14px; font-size:10.5pt; }
    .details-grid .label { color:#6b7280; font-weight:600; white-space:nowrap; }
    .notes-block { background:#f9fafb; border-left:4px solid #3b6e14; border-radius:0 8px 8px 0; padding:9px 13px; font-size:10pt; color:#374151; line-height:1.5; margin-bottom:16px; }
    .cta-box { background:#f0fdf4; border:2px solid #86efac; border-radius:10px; padding:12px 15px; margin-bottom:16px; font-size:10pt; color:#14532d; }
    .cta-box strong { font-size:10.5pt; display:block; margin-bottom:3px; }
    .qr-section { display:flex; align-items:flex-start; gap:16px; border-top:1.5px solid #e5e7eb; padding-top:16px; margin-bottom:16px; }
    .qr-section img { width:110px; height:110px; flex-shrink:0; border:1.5px solid #e5e7eb; border-radius:8px; }
    .qr-label { font-size:7.5pt; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.07em; margin-bottom:3px; }
    .qr-url { font-size:7.5pt; color:#3b6e14; word-break:break-all; font-family:monospace; margin-bottom:6px; }
    .qr-cta { font-size:8.5pt; color:#374151; line-height:1.5; }
    footer { font-size:7.5pt; color:#9ca3af; text-align:center; border-top:1px solid #e5e7eb; padding:8px 0 12px; }
    @media print { body { padding:1cm 1cm 0; max-width:none; min-height:277mm; } @page { margin:1cm; size:A4; } .no-print { display:none!important; } }
  </style>
</head>
<body>
  <div class="brand">
    <span class="brand-name">RZZ Materialien</span>
    <span class="brand-date">Stand: ${dateStr}</span>
  </div>

  ${coverImageUrl ? `<img class="cover-img" src="${coverImageUrl}" alt="${offer.material_name || ''}" />` : ''}

  <div class="type-badge">Materialangebot</div>
  <div class="material-name">${offer.material_name || 'Material verfügbar'}</div>

  ${valueLabel ? `<div class="value-highlight">✓ ${valueLabel}${price ? ` · ${price}` : ''}</div>` : ''}

  <div class="details-grid">
    ${qty ? `<span class="label">Menge</span><span>${qty}</span>` : ''}
    ${offer.location_name ? `<span class="label">Abholort</span><span>${offer.location_name}${offer.address ? ` · ${offer.address}` : ''}</span>` : ''}
    ${offer.category ? `<span class="label">Kategorie</span><span>${offer.category}</span>` : ''}
    ${offer.condition ? `<span class="label">Zustand</span><span>${offer.condition}</span>` : ''}
    ${ownerName ? `<span class="label">Anbieter</span><span>${ownerName}</span>` : ''}
  </div>

  ${offer.notes ? `<div class="notes-block">${offer.notes.replace(/\n/g, '<br/>')}</div>` : ''}

  <div class="cta-box">
    <strong>Interesse? Jetzt anfragen!</strong>
    QR-Code scannen — direkt zum Angebot mit Anfrage-Funktion.
  </div>

  <div class="qr-section">
    <img src="${qrDataUrl}" alt="QR-Code" />
    <div>
      <div class="qr-label">Mehr Info &amp; Kontakt</div>
      <div class="qr-url">${angebotUrl}</div>
      <div class="qr-cta">Direkt zum Angebot auf der RZZ-Materialplattform — dort Anfrage stellen und Details einsehen.</div>
    </div>
  </div>

  <footer>RZZ Materialien · reallabor-zekiwa-zeitz.de · Exportiert ${dateStr}</footer>

  ${tearStripsHtml({ qrDataUrl, name: offer.material_name || 'Materialangebot', pathUrl, accentColor: '#3b6e14' })}

  <p style="margin-top:16px; text-align:center; padding-bottom:24px;" class="no-print">
    <button onclick="window.print()" style="padding:8px 28px;background:#3b6e14;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;">
      Als PDF speichern / Drucken
    </button>
  </p>
</body>
</html>`);
  w.document.close();
}

// ── Gesuch Poster (Aushang) ───────────────────────────────────────────────────

export async function exportGesuchPoster(gesuch) {
  const gesuchUrl = `${window.location.origin}/gesuch/${gesuch.id}`;
  const w = window.open('', '_blank', 'width=650,height=950');
  if (!w) { alert('Bitte im Browser Popups für diese Seite erlauben.'); return; }
  w.document.write('<html><body style="font-family:sans-serif;padding:40px;color:#9ca3af">Poster wird erstellt…</body></html>');
  const qrDataUrl = await QRCode.toDataURL(gesuchUrl, { width: 240, margin: 1, color: { dark: '#1a2e05', light: '#ffffff' } });
  openGesuchPosterWindow({ gesuch, qrDataUrl, gesuchUrl, w });
}

function openGesuchPosterWindow({ gesuch, qrDataUrl, gesuchUrl, w }) {
  const qty = gesuch.quantity != null
    ? `${gesuch.quantity} ${gesuch.unit || gesuch.material_unit || ''}`.trim()
    : null;
  const ownerName = gesuch.owner_first_name
    ? `${gesuch.owner_first_name} ${gesuch.owner_last_name || ''}`.trim()
    : gesuch.owner_email || null;
  const dateStr = new Date().toLocaleDateString('de-DE');
  const coverImageUrl = buildCoverImageUrl(gesuch.images);
  const pathUrl = `/gesuch/${gesuch.id}`;

  const html = '<!DOCTYPE html>\n'
    + '<html lang="de">\n<head>\n'
    + '<meta charset="UTF-8"/>\n'
    + '<title>Gesuch: ' + (gesuch.material_name || 'Materialgesuch') + ' – RZZ Materialien</title>\n'
    + '<style>\n'
    + '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n'
    + 'body { font-family: Helvetica Neue, Arial, sans-serif; background: #fff; color: #1f2937; padding: 32px 36px 0; max-width: 560px; margin: 0 auto; display:flex; flex-direction:column; min-height:277mm; }\n'
    + '.brand { display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #6b21a8; padding-bottom:10px; margin-bottom:16px; }\n'
    + '.brand-name { font-size:13pt; font-weight:800; color:#3b6e14; letter-spacing:-0.02em; }\n'
    + '.brand-date { font-size:8pt; color:#9ca3af; }\n'
    + '.cover-img { width:100%; height:200px; object-fit:cover; border-radius:10px; margin-bottom:14px; }\n'
    + '.type-badge { display:inline-block; background:#f3e8ff; color:#6b21a8; border:1.5px solid #d8b4fe; border-radius:20px; padding:4px 14px; font-size:10pt; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:10px; }\n'
    + '.material-name { font-size:26pt; font-weight:900; color:#111827; line-height:1.1; margin-bottom:12px; }\n'
    + '.details-grid { display:grid; grid-template-columns:auto 1fr; gap:5px 14px; margin-bottom:14px; font-size:10.5pt; }\n'
    + '.details-grid .label { color:#6b7280; font-weight:600; white-space:nowrap; }\n'
    + '.notes-block { background:#faf5ff; border-left:4px solid #9f7aea; border-radius:0 8px 8px 0; padding:9px 13px; font-size:10pt; color:#374151; line-height:1.5; margin-bottom:16px; }\n'
    + '.qr-section { display:flex; align-items:flex-start; gap:16px; border-top:1.5px solid #e5e7eb; padding-top:16px; margin-bottom:16px; }\n'
    + '.qr-section img.qr { width:110px; height:110px; flex-shrink:0; border:1.5px solid #e5e7eb; border-radius:8px; }\n'
    + '.qr-label { font-size:7.5pt; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.07em; margin-bottom:3px; }\n'
    + '.qr-url { font-size:7.5pt; color:#6b21a8; word-break:break-all; font-family:monospace; margin-bottom:6px; }\n'
    + '.qr-cta { font-size:8.5pt; color:#374151; line-height:1.5; }\n'
    + 'footer { font-size:7.5pt; color:#9ca3af; text-align:center; border-top:1px solid #e5e7eb; padding:8px 0 12px; }\n'
    + '@media print { body { padding:1cm 1cm 0; max-width:none; } @page { margin:0.8cm; size:A4; } .no-print { display:none!important; } }\n'
    + '</style>\n</head>\n<body>\n'
    + '<div class="brand"><span class="brand-name">RZZ Materialien</span><span class="brand-date">Stand: ' + dateStr + '</span></div>\n'
    + (coverImageUrl ? '<img class="cover-img" src="' + coverImageUrl + '" alt="' + (gesuch.material_name || '') + '" />\n' : '')
    + '<div class="type-badge">Materialgesuch</div>\n'
    + '<div class="material-name">' + (gesuch.material_name || 'Material gesucht') + '</div>\n'
    + '<div class="details-grid">\n'
    + (qty ? '<span class="label">Menge</span><span>' + qty + '</span>\n' : '')
    + (gesuch.location_name ? '<span class="label">Ort</span><span>' + gesuch.location_name + (gesuch.address ? ' · ' + gesuch.address : '') + '</span>\n' : '')
    + (ownerName ? '<span class="label">Kontakt</span><span>' + ownerName + '</span>\n' : '')
    + (gesuch.category ? '<span class="label">Kategorie</span><span>' + gesuch.category + '</span>\n' : '')
    + '</div>\n'
    + (gesuch.notes ? '<div class="notes-block">' + gesuch.notes.replace(/\n/g, '<br/>') + '</div>\n' : '')
    + '<div class="qr-section">\n'
    + '<img class="qr" src="' + qrDataUrl + '" alt="QR-Code" />\n'
    + '<div><div class="qr-label">Mehr Info &amp; Kontakt</div>\n'
    + '<div class="qr-url">' + gesuchUrl + '</div>\n'
    + '<div class="qr-cta">QR-Code scannen, um dieses Gesuch online zu sehen und Kontakt aufzunehmen.</div></div>\n'
    + '</div>\n'
    + '<footer>RZZ Materialien · reallabor-zekiwa-zeitz.de · Exportiert ' + dateStr + '</footer>\n';

  w.document.write(html + tearStripsHtml({ qrDataUrl, name: gesuch.material_name || 'Materialgesuch', pathUrl, accentColor: '#6b21a8' })
    + '<p style="margin-top:16px; text-align:center; padding-bottom:24px;" class="no-print">'
    + '<button onclick="window.print()" style="padding:8px 28px;background:#6b21a8;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;">Als PDF speichern / Drucken</button>'
    + '</p></body></html>');
  w.document.close();
}


// ── Material Poster (Aushang) ─────────────────────────────────────────────────

export async function exportMaterialPoster(material) {
  const materialUrl = `${window.location.origin}/materials/${material.id}`;
  const w = window.open('', '_blank', 'width=650,height=950');
  if (!w) { alert('Bitte im Browser Popups für diese Seite erlauben.'); return; }
  w.document.write('<html><body style="font-family:sans-serif;padding:40px;color:#9ca3af">Poster wird erstellt…</body></html>');
  const qrDataUrl = await QRCode.toDataURL(materialUrl, { width: 240, margin: 1, color: { dark: '#1a3a6e', light: '#ffffff' } });
  openMaterialPosterWindow({ material, qrDataUrl, materialUrl, w });
}

function openMaterialPosterWindow({ material, qrDataUrl, materialUrl, w }) {
  const dateStr = new Date().toLocaleDateString('de-DE');
  const coverImageUrl = buildCoverImageUrl(material.images);
  const pathUrl = `/materials/${material.id}`;

  const html = '<!DOCTYPE html>\n'
    + '<html lang="de">\n<head>\n'
    + '<meta charset="UTF-8"/>\n'
    + '<title>Material: ' + (material.name || 'Material') + ' – RZZ Materialien</title>\n'
    + '<style>\n'
    + '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n'
    + 'body { font-family: Helvetica Neue, Arial, sans-serif; background: #fff; color: #1f2937; padding: 32px 36px 0; max-width: 560px; margin: 0 auto; display:flex; flex-direction:column; min-height:277mm; }\n'
    + '.brand { display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #2563eb; padding-bottom:10px; margin-bottom:16px; }\n'
    + '.brand-name { font-size:13pt; font-weight:800; color:#2563eb; letter-spacing:-0.02em; }\n'
    + '.brand-date { font-size:8pt; color:#9ca3af; }\n'
    + '.cover-img { width:100%; height:200px; object-fit:cover; border-radius:10px; margin-bottom:14px; }\n'
    + '.type-badge { display:inline-block; background:#dbeafe; color:#1d4ed8; border:1.5px solid #93c5fd; border-radius:20px; padding:4px 14px; font-size:10pt; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:10px; }\n'
    + '.material-name { font-size:26pt; font-weight:900; color:#111827; line-height:1.1; margin-bottom:12px; }\n'
    + '.details-grid { display:grid; grid-template-columns:auto 1fr; gap:5px 14px; margin-bottom:14px; font-size:10.5pt; }\n'
    + '.details-grid .label { color:#6b7280; font-weight:600; white-space:nowrap; }\n'
    + '.notes-block { background:#eff6ff; border-left:4px solid #2563eb; border-radius:0 8px 8px 0; padding:9px 13px; font-size:10pt; color:#374151; line-height:1.5; margin-bottom:16px; }\n'
    + '.qr-section { display:flex; align-items:flex-start; gap:16px; border-top:1.5px solid #e5e7eb; padding-top:16px; margin-bottom:16px; }\n'
    + '.qr-section img.qr { width:110px; height:110px; flex-shrink:0; border:1.5px solid #e5e7eb; border-radius:8px; }\n'
    + '.qr-label { font-size:7.5pt; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.07em; margin-bottom:3px; }\n'
    + '.qr-url { font-size:7.5pt; color:#2563eb; word-break:break-all; font-family:monospace; margin-bottom:6px; }\n'
    + '.qr-cta { font-size:8.5pt; color:#374151; line-height:1.5; }\n'
    + 'footer { font-size:7.5pt; color:#9ca3af; text-align:center; border-top:1px solid #e5e7eb; padding:8px 0 12px; }\n'
    + '@media print { body { padding:1cm 1cm 0; max-width:none; } @page { margin:0.8cm; size:A4; } .no-print { display:none!important; } }\n'
    + '</style>\n</head>\n<body>\n'
    + '<div class="brand"><span class="brand-name">RZZ Materialien</span><span class="brand-date">Stand: ' + dateStr + '</span></div>\n'
    + (coverImageUrl ? '<img class="cover-img" src="' + coverImageUrl + '" alt="' + (material.name || '') + '" />\n' : '')
    + '<div class="type-badge">Material</div>\n'
    + '<div class="material-name">' + (material.name || 'Material') + '</div>\n'
    + '<div class="details-grid">\n'
    + (material.category ? '<span class="label">Kategorie</span><span>' + material.category + '</span>\n' : '')
    + (material.unit ? '<span class="label">Einheit</span><span>' + material.unit + '</span>\n' : '')
    + (material.gwp_value != null ? '<span class="label">GWP-Wert</span><span>' + material.gwp_value + (material.gwp_unit ? ' ' + material.gwp_unit : ' kg CO₂e') + '</span>\n' : '')
    + (material.manufacturer ? '<span class="label">Hersteller</span><span>' + material.manufacturer + '</span>\n' : '')
    + (material.location_name ? '<span class="label">Standort</span><span>' + material.location_name + (material.address ? ' · ' + material.address : '') + '</span>\n' : '')
    + '</div>\n'
    + (material.description || material.short_description ? '<div class="notes-block">' + (material.short_description || material.description).replace(/\n/g, '<br/>') + '</div>\n' : '')
    + '<div class="qr-section">\n'
    + '<img class="qr" src="' + qrDataUrl + '" alt="QR-Code" />\n'
    + '<div><div class="qr-label">Mehr Info</div>\n'
    + '<div class="qr-url">' + materialUrl + '</div>\n'
    + '<div class="qr-cta">QR-Code scannen, um dieses Material in der RZZ-Materialplattform zu sehen.</div></div>\n'
    + '</div>\n'
    + '<footer>RZZ Materialien · reallabor-zekiwa-zeitz.de · Exportiert ' + dateStr + '</footer>\n';

  w.document.write(html + tearStripsHtml({ qrDataUrl, name: material.name || 'Material', pathUrl, accentColor: '#1d4ed8' })
    + '<p style="margin-top:16px; text-align:center; padding-bottom:24px;" class="no-print">'
    + '<button onclick="window.print()" style="padding:8px 28px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;">Als PDF speichern / Drucken</button>'
    + '</p></body></html>');
  w.document.close();
}

// ── Project Poster (Aushang) ──────────────────────────────────────────────────

export async function exportProjectPoster(project) {
  const projectUrl = `${window.location.origin}/projects/${project.id}`;
  const w = window.open('', '_blank', 'width=650,height=950');
  if (!w) { alert('Bitte im Browser Popups für diese Seite erlauben.'); return; }
  w.document.write('<html><body style="font-family:sans-serif;padding:40px;color:#9ca3af">Poster wird erstellt…</body></html>');
  const qrDataUrl = await QRCode.toDataURL(projectUrl, { width: 240, margin: 1, color: { dark: '#1a3a0a', light: '#ffffff' } });
  openProjectPosterWindow({ project, qrDataUrl, projectUrl, w });
}

function openProjectPosterWindow({ project, qrDataUrl, projectUrl, w }) {
  const dateStr = new Date().toLocaleDateString('de-DE');
  const coverImageUrl = buildCoverImageUrl(project.images);
  const pathUrl = `/projects/${project.id}`;
  const ownerName = project.owner_first_name
    ? `${project.owner_first_name} ${project.owner_last_name || ''}`.trim()
    : project.owner_email?.split('@')[0] || null;
  const createdAt = project.created_at
    ? formatDate(project.created_at)
    : null;

  const html = '<!DOCTYPE html>\n'
    + '<html lang="de">\n<head>\n'
    + '<meta charset="UTF-8"/>\n'
    + '<title>Projekt: ' + (project.name || 'Projekt') + ' – RZZ Materialien</title>\n'
    + '<style>\n'
    + '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n'
    + 'body { font-family: Helvetica Neue, Arial, sans-serif; background: #fff; color: #1f2937; padding: 32px 36px 0; max-width: 560px; margin: 0 auto; display:flex; flex-direction:column; min-height:277mm; }\n'
    + '.brand { display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #3b6e14; padding-bottom:10px; margin-bottom:16px; }\n'
    + '.brand-name { font-size:13pt; font-weight:800; color:#3b6e14; letter-spacing:-0.02em; }\n'
    + '.brand-date { font-size:8pt; color:#9ca3af; }\n'
    + '.cover-img { width:100%; height:200px; object-fit:cover; border-radius:10px; margin-bottom:14px; }\n'
    + '.type-badge { display:inline-block; background:#dcfce7; color:#15803d; border:1.5px solid #86efac; border-radius:20px; padding:4px 14px; font-size:10pt; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:10px; }\n'
    + '.material-name { font-size:26pt; font-weight:900; color:#111827; line-height:1.1; margin-bottom:12px; }\n'
    + '.details-grid { display:grid; grid-template-columns:auto 1fr; gap:5px 14px; margin-bottom:14px; font-size:10.5pt; }\n'
    + '.details-grid .label { color:#6b7280; font-weight:600; white-space:nowrap; }\n'
    + '.notes-block { background:#f0fdf4; border-left:4px solid #3b6e14; border-radius:0 8px 8px 0; padding:9px 13px; font-size:10pt; color:#374151; line-height:1.5; margin-bottom:16px; }\n'
    + '.qr-section { display:flex; align-items:flex-start; gap:16px; border-top:1.5px solid #e5e7eb; padding-top:16px; margin-bottom:16px; }\n'
    + '.qr-section img.qr { width:110px; height:110px; flex-shrink:0; border:1.5px solid #e5e7eb; border-radius:8px; }\n'
    + '.qr-label { font-size:7.5pt; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.07em; margin-bottom:3px; }\n'
    + '.qr-url { font-size:7.5pt; color:#3b6e14; word-break:break-all; font-family:monospace; margin-bottom:6px; }\n'
    + '.qr-cta { font-size:8.5pt; color:#374151; line-height:1.5; }\n'
    + 'footer { font-size:7.5pt; color:#9ca3af; text-align:center; border-top:1px solid #e5e7eb; padding:8px 0 12px; }\n'
    + '@media print { body { padding:1cm 1cm 0; max-width:none; } @page { margin:0.8cm; size:A4; } .no-print { display:none!important; } }\n'
    + '</style>\n</head>\n<body>\n'
    + '<div class="brand"><span class="brand-name">RZZ Materialien</span><span class="brand-date">Stand: ' + dateStr + '</span></div>\n'
    + (coverImageUrl ? '<img class="cover-img" src="' + coverImageUrl + '" alt="' + (project.name || '') + '" />\n' : '')
    + '<div class="type-badge">Projekt</div>\n'
    + '<div class="material-name">' + (project.name || 'Projekt') + '</div>\n'
    + '<div class="details-grid">\n'
    + (project.status ? '<span class="label">Status</span><span>' + project.status + '</span>\n' : '')
    + (ownerName ? '<span class="label">Auftraggeber</span><span>' + ownerName + '</span>\n' : '')
    + (project.location_name ? '<span class="label">Standort</span><span>' + project.location_name + (project.address ? ' · ' + project.address : '') + '</span>\n' : '')
    + (createdAt ? '<span class="label">Erstellt am</span><span>' + createdAt + '</span>\n' : '')
    + '</div>\n'
    + (project.description ? '<div class="notes-block">' + project.description.replace(/\n/g, '<br/>') + '</div>\n' : '')
    + '<div class="qr-section">\n'
    + '<img class="qr" src="' + qrDataUrl + '" alt="QR-Code" />\n'
    + '<div><div class="qr-label">Mehr Info</div>\n'
    + '<div class="qr-url">' + projectUrl + '</div>\n'
    + '<div class="qr-cta">QR-Code scannen, um dieses Projekt in der RZZ-Materialplattform zu sehen.</div></div>\n'
    + '</div>\n'
    + '<footer>RZZ Materialien · reallabor-zekiwa-zeitz.de · Exportiert ' + dateStr + '</footer>\n';

  w.document.write(html + tearStripsHtml({ qrDataUrl, name: project.name || 'Projekt', pathUrl, accentColor: '#15803d' })
    + '<p style="margin-top:16px; text-align:center; padding-bottom:24px;" class="no-print">'
    + '<button onclick="window.print()" style="padding:8px 28px;background:#3b6e14;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;">Als PDF speichern / Drucken</button>'
    + '</p></body></html>');
  w.document.close();
}


function openPrintWindow({ title, heading, subtitle, tableHeaders, tableRows }) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #1f2937; background: #fff; padding: 32px 40px; }
    header { display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 2px solid #3b6e14; padding-bottom: 12px; margin-bottom: 20px; }
    header h1 { font-size: 20pt; font-weight: 800; color: #3b6e14; letter-spacing: -0.02em; }
    header .meta { font-size: 9pt; color: #6b7280; text-align: right; line-height: 1.6; }
    header .sub { font-size: 10pt; color: #374151; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    thead tr { background: #f3f4f6; }
    thead th { text-align: left; padding: 7px 10px; font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; color: #374151; border-bottom: 2px solid #e5e7eb; }
    tbody tr { border-bottom: 1px solid #f3f4f6; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    tbody td { padding: 6px 10px; vertical-align: top; line-height: 1.4; }
    tbody td:first-child { font-weight: 600; color: #111827; }
    footer { margin-top: 24px; font-size: 8pt; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    @media print {
      body { padding: 0; }
      @page { margin: 1.5cm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>RZZ Materialien</h1>
      <div class="sub">${heading}</div>
    </div>
    <div class="meta">
      <div>${subtitle}</div>
      <div>reallabor-zekiwa-zeitz.de</div>
    </div>
  </header>
  <table>
    <thead><tr>${tableHeaders.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <footer>Exportiert von RZZ Materialien · ${new Date().toLocaleString('de-DE')}</footer>
  <p style="margin-top:16px; text-align:center;" class="no-print">
    <button onclick="window.print()" style="padding:8px 24px;background:#3b6e14;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;">
      Als PDF speichern / Drucken
    </button>
  </p>
</body>
</html>`);
  w.document.close();
}
