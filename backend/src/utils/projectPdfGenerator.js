import PDFDocument from 'pdfkit';

const MM = 2.835;
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 20 * MM;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const COLORS = {
  primary: '#14532d',
  accent: '#16a34a',
  light: '#f0fdf4',
  border: '#bbf7d0',
  muted: '#64748b',
  text: '#1e293b',
  headerBg: '#f1f5f9',
  headerBorder: '#cbd5e1',
  amber: '#92400e',
  amberBg: '#fffbeb',
  red: '#991b1b',
};

function sectionHeader(doc, title, y) {
  doc.rect(MARGIN, y, CONTENT_W, 7 * MM).fill(COLORS.primary);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff')
    .text(title.toUpperCase(), MARGIN + 4 * MM, y + 2 * MM, { width: CONTENT_W - 8 * MM });
  return y + 7 * MM + 3 * MM;
}

function divider(doc, y) {
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y)
    .strokeColor(COLORS.headerBorder).lineWidth(0.5).stroke();
  return y + 3 * MM;
}

function rowLine(doc, label, value, x, y, w, labelW = 80 * MM) {
  if (value == null || value === '') return y;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted).text(label, x, y, { width: labelW - 2 * MM });
  doc.fontSize(8).font('Helvetica').fillColor(COLORS.text).text(String(value), x + labelW, y, { width: w - labelW });
  return Math.max(doc.y, y) + 2 * MM;
}

function checkY(doc, y, needed = 30 * MM) {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function fmt(n, decimals = 1) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('de-DE', { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

function normalizeUnit(u) {
  if (!u) return '';
  const s = u.trim().toLowerCase().replace(/^[\d.]+\s*/, '');
  const map = { 'metric ton': 't', 'tonne': 't', 'tonnes': 't', 'kilogram': 'kg', 'kilograms': 'kg' };
  return map[s] ?? s;
}

function unitConv(from, to) {
  const n = normalizeUnit(from);
  const d = normalizeUnit(to);
  if (!n || !d || n === d) return 1;
  const toKg = u => u === 'kg' ? 1 : u === 't' ? 1000 : u === 'g' ? 0.001 : null;
  const fK = toKg(n), tK = toKg(d);
  if (fK != null && tK != null && tK !== 0) return fK / tK;
  return 1;
}

function getEffectiveGwp(mat) {
  const gwpPerUnit = mat.effective_gwp_value != null ? Number(mat.effective_gwp_value) : null;
  if (gwpPerUnit == null) return null;
  const qty = Number(mat.quantity || 0);
  const declaredUnit = mat.gwp_unit ? mat.gwp_unit.split('/')[1]?.trim() : (mat.declared_unit || null);
  const conv = unitConv(mat.unit, declaredUnit);
  return gwpPerUnit * qty * conv;
}

export async function generateProjectPdf(project) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true, bufferPages: true, pdfVersion: '1.4', lang: 'de' });
  const chunks = [];
  doc.on('data', c => chunks.push(c));

  await new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
    _buildProjectPdf(doc, project);
    doc.end();
  });

  return Buffer.concat(chunks);
}

function _buildProjectPdf(doc, p) {
  // ── Header banner ─────────────────────────────────────────────────────────
  doc.rect(0, 0, PAGE_W, 30 * MM).fill(COLORS.primary);
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#ffffff')
    .text('Projektdatenblatt', MARGIN, 6 * MM, { width: CONTENT_W });
  doc.fontSize(9).font('Helvetica').fillColor('#86efac')
    .text('Material Library · Digitaler Projektpass', MARGIN, 14 * MM, { width: CONTENT_W });
  if (p.material_id) {
    doc.fontSize(8).font('Courier-Bold').fillColor('#bbf7d0')
      .text(p.material_id, MARGIN, 22 * MM, { width: CONTENT_W });
  }

  let y = 34 * MM;

  // ── Project name ──────────────────────────────────────────────────────────
  doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.text)
    .text(p.name || 'Unbekanntes Projekt', MARGIN, y, { width: CONTENT_W });
  y = doc.y + 2 * MM;

  if (p.status) {
    const statusMap = { draft: 'Entwurf', active: 'Aktiv', completed: 'Abgeschlossen', archived: 'Archiviert' };
    const label = statusMap[p.status] || p.status;
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted).text(`Status: ${label}`, MARGIN, y);
    y = doc.y + 1 * MM;
  }

  y = divider(doc, y + 1 * MM);

  if (p.description) {
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.text)
      .text(p.description, MARGIN, y, { width: CONTENT_W });
    y = doc.y + 4 * MM;
  }

  // ── Basisdaten ────────────────────────────────────────────────────────────
  y = checkY(doc, y, 35 * MM);
  y = sectionHeader(doc, 'Projektinfos', y);

  y = rowLine(doc, 'Standort', [p.location_name, p.address].filter(Boolean).join(', ') || null, MARGIN, y, CONTENT_W);
  y = rowLine(doc, 'Zeitaufwand', p.time_effort, MARGIN, y, CONTENT_W);
  if (p.owner_first_name || p.owner_last_name) {
    y = rowLine(doc, 'Verantwortlich', [p.owner_first_name, p.owner_last_name].filter(Boolean).join(' '), MARGIN, y, CONTENT_W);
  }
  y += 2 * MM;

  // ── GWP Zusammenfassung ───────────────────────────────────────────────────
  const materials = p.materials || [];
  const libMats = materials.filter(m => m.has_gwp_data || m.effective_gwp_value != null);
  let totalGwp = 0;
  for (const m of libMats) {
    const g = getEffectiveGwp(m);
    if (g != null) totalGwp += g;
  }

  // Oekodat materials
  let oekodatMats = [];
  try { oekodatMats = typeof p.oekodat_materials === 'string' ? JSON.parse(p.oekodat_materials) : (p.oekodat_materials || []); } catch { }

  let oekodatGwp = 0;
  for (const om of oekodatMats) {
    const indicators = om.indicators || {};
    const gwpA1A3 = indicators.gwp?.mods ? Object.values(indicators.gwp.mods).reduce((s, v) => s + (Number(v) || 0), 0) : 0;
    const qty = Number(om.quantity || 0);
    const uf = Number(om.uncertainty_factor || 1);
    const conv = unitConv(om.unit, om.declaredUnit);
    oekodatGwp += gwpA1A3 * qty * conv * uf;
  }

  const grandTotal = totalGwp + oekodatGwp;

  if (grandTotal !== 0 || libMats.length > 0 || oekodatMats.length > 0) {
    y = checkY(doc, y, 25 * MM);
    y = sectionHeader(doc, 'Klimawirkung (GWP A1–A3)', y);

    doc.rect(MARGIN, y, CONTENT_W, 14 * MM).fill(COLORS.light);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(`${fmt(grandTotal)} kg CO₂e`, MARGIN + 4 * MM, y + 1.5 * MM, { width: CONTENT_W - 8 * MM });
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
      .text('Gesamte eingebettete Treibhausgasemissionen', MARGIN + 4 * MM, y + 7 * MM, { width: CONTENT_W - 8 * MM });
    y += 16 * MM;

    if (libMats.length > 0 && oekodatMats.length > 0) {
      y = rowLine(doc, 'Davon Bibliotheksmaterialien', `${fmt(totalGwp)} kg CO₂e`, MARGIN, y, CONTENT_W);
      y = rowLine(doc, 'Davon Ökobaudat-Materialien', `${fmt(oekodatGwp)} kg CO₂e`, MARGIN, y, CONTENT_W);
    }
    y += 2 * MM;
  }

  // ── Bibliotheksmaterialien ────────────────────────────────────────────────
  if (materials.length > 0) {
    y = checkY(doc, y, 35 * MM);
    y = sectionHeader(doc, `Bibliotheksmaterialien (${materials.length})`, y);

    // Table header
    const cols = { name: MARGIN, qty: MARGIN + 75 * MM, unit: MARGIN + 100 * MM, gwp: MARGIN + 125 * MM };
    doc.rect(MARGIN, y, CONTENT_W, 5.5 * MM).fill(COLORS.headerBg);
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(COLORS.muted);
    doc.text('Material', cols.name + 2 * MM, y + 1.5 * MM, { width: 70 * MM });
    doc.text('Menge', cols.qty, y + 1.5 * MM, { width: 22 * MM });
    doc.text('Einheit', cols.unit, y + 1.5 * MM, { width: 22 * MM });
    doc.text('GWP kg CO₂e', cols.gwp, y + 1.5 * MM, { width: CONTENT_W - (cols.gwp - MARGIN) });
    y += 6.5 * MM;

    for (let i = 0; i < materials.length; i++) {
      const m = materials[i];
      y = checkY(doc, y, 6 * MM);
      if (i % 2 === 0) {
        doc.rect(MARGIN, y - 0.5, CONTENT_W, 5.5 * MM).fill('#f8fafc');
      }
      const gwp = getEffectiveGwp(m);
      doc.fontSize(8).font('Helvetica').fillColor(COLORS.text);
      doc.text(m.material_name || m.name || '—', cols.name + 2 * MM, y + 0.5 * MM, { width: 70 * MM, ellipsis: true, lineBreak: false });
      doc.text(fmt(m.quantity, 3), cols.qty, y + 0.5 * MM, { width: 22 * MM });
      doc.text(m.unit || '—', cols.unit, y + 0.5 * MM, { width: 22 * MM });
      doc.text(gwp != null ? fmt(gwp) : '—', cols.gwp, y + 0.5 * MM, { width: CONTENT_W - (cols.gwp - MARGIN) });
      y += 5.5 * MM;
    }
    y += 3 * MM;
  }

  // ── Ökobaudat-Materialien ─────────────────────────────────────────────────
  if (oekodatMats.length > 0) {
    y = checkY(doc, y, 35 * MM);
    y = sectionHeader(doc, `Ökobaudat-Materialien (${oekodatMats.length})`, y);

    const cols = { name: MARGIN, qty: MARGIN + 75 * MM, unit: MARGIN + 100 * MM, gwp: MARGIN + 125 * MM };
    doc.rect(MARGIN, y, CONTENT_W, 5.5 * MM).fill(COLORS.headerBg);
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(COLORS.muted);
    doc.text('Material / EPD', cols.name + 2 * MM, y + 1.5 * MM, { width: 70 * MM });
    doc.text('Menge', cols.qty, y + 1.5 * MM, { width: 22 * MM });
    doc.text('Einheit', cols.unit, y + 1.5 * MM, { width: 22 * MM });
    doc.text('GWP kg CO₂e', cols.gwp, y + 1.5 * MM, { width: CONTENT_W - (cols.gwp - MARGIN) });
    y += 6.5 * MM;

    for (let i = 0; i < oekodatMats.length; i++) {
      const om = oekodatMats[i];
      y = checkY(doc, y, 6 * MM);
      if (i % 2 === 0) {
        doc.rect(MARGIN, y - 0.5, CONTENT_W, 5.5 * MM).fill('#f8fafc');
      }
      const indicators = om.indicators || {};
      const gwpA1A3 = indicators.gwp?.mods ? Object.values(indicators.gwp.mods).reduce((s, v) => s + (Number(v) || 0), 0) : 0;
      const qty = Number(om.quantity || 0);
      const uf = Number(om.uncertainty_factor || 1);
      const conv = unitConv(om.unit, om.declaredUnit);
      const gwpTotal = gwpA1A3 * qty * conv * uf;

      doc.fontSize(8).font('Helvetica').fillColor(COLORS.text);
      doc.text(om.name || '—', cols.name + 2 * MM, y + 0.5 * MM, { width: 70 * MM, ellipsis: true, lineBreak: false });
      doc.text(fmt(om.quantity, 3), cols.qty, y + 0.5 * MM, { width: 22 * MM });
      doc.text(om.unit || '—', cols.unit, y + 0.5 * MM, { width: 22 * MM });
      doc.text(fmt(gwpTotal), cols.gwp, y + 0.5 * MM, { width: CONTENT_W - (cols.gwp - MARGIN) });
      y += 5.5 * MM;
    }
    y += 3 * MM;
  }

  // ── Prinzipien ────────────────────────────────────────────────────────────
  const hasPrinciples = p.principles_sufficiency || p.principles_consistency || p.principles_efficiency || p.general_sustainability_principles;
  if (hasPrinciples) {
    y = checkY(doc, y, 35 * MM);
    y = sectionHeader(doc, 'Nachhaltigkeitsprinzipien', y);
    if (p.general_sustainability_principles) y = rowLine(doc, 'Allgemein', p.general_sustainability_principles, MARGIN, y, CONTENT_W);
    if (p.principles_sufficiency) y = rowLine(doc, 'Suffizienz', p.principles_sufficiency, MARGIN, y, CONTENT_W);
    if (p.principles_consistency) y = rowLine(doc, 'Konsistenz', p.principles_consistency, MARGIN, y, CONTENT_W);
    if (p.principles_efficiency) y = rowLine(doc, 'Effizienz', p.principles_efficiency, MARGIN, y, CONTENT_W);
    y += 2 * MM;
  }

  // ── Akteure ───────────────────────────────────────────────────────────────
  const actors = p.actors || [];
  if (actors.length > 0) {
    y = checkY(doc, y, 25 * MM);
    y = sectionHeader(doc, `Beteiligte Akteure (${actors.length})`, y);
    for (const a of actors) {
      y = checkY(doc, y, 6 * MM);
      const loc = a.location_name ? ` · ${a.location_name}` : '';
      doc.fontSize(8).font('Helvetica').fillColor(COLORS.text)
        .text(`${a.name || '—'} (${a.type || '—'})${loc}`, MARGIN + 2 * MM, y, { width: CONTENT_W - 4 * MM });
      y = doc.y + 1.5 * MM;
    }
    y += 2 * MM;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    const footerY = PAGE_H - 12 * MM;
    doc.rect(0, footerY - 1, PAGE_W, 13 * MM).fill(COLORS.light);
    doc.moveTo(0, footerY - 1).lineTo(PAGE_W, footerY - 1).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.fontSize(7).font('Helvetica').fillColor(COLORS.muted)
      .text(
        `Projektdatenblatt · ${p.name || ''} · Erstellt am ${new Date().toLocaleDateString('de-DE')}`,
        MARGIN, footerY + 1 * MM, { width: CONTENT_W - 30 * MM }
      );
    doc.fontSize(7).font('Helvetica').fillColor(COLORS.muted)
      .text(`Seite ${i + 1} / ${pages.count}`, MARGIN, footerY + 1 * MM, { width: CONTENT_W, align: 'right' });
  }
}
