import PDFDocument from 'pdfkit';

const MM = 2.835;
const PAGE_W = 595; // A4
const PAGE_H = 842;
const MARGIN = 20 * MM;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const COLORS = {
  primary: '#1e3a5f',
  accent: '#2563eb',
  light: '#f1f5f9',
  border: '#cbd5e1',
  muted: '#64748b',
  text: '#1e293b',
  green: '#166534',
  greenBg: '#f0fdf4',
  amber: '#92400e',
  amberBg: '#fffbeb',
};

function row(doc, label, value, x, y, w, labelW = 80 * MM) {
  if (value == null || value === '' || value === false) return y;
  const valX = x + labelW;
  const valW = w - labelW;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted).text(label, x, y, { width: labelW - 2 * MM });
  const startY = doc.y;
  doc.fontSize(8).font('Helvetica').fillColor(COLORS.text).text(String(value), valX, y, { width: valW });
  return Math.max(startY, doc.y) + 2 * MM;
}

function sectionHeader(doc, title, y) {
  doc.rect(MARGIN, y, CONTENT_W, 7 * MM).fill(COLORS.primary);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff')
    .text(title.toUpperCase(), MARGIN + 4 * MM, y + 2 * MM, { width: CONTENT_W - 8 * MM });
  return y + 7 * MM + 3 * MM;
}

function divider(doc, y) {
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y)
    .strokeColor(COLORS.border).lineWidth(0.5).stroke();
  return y + 3 * MM;
}

function checkY(doc, y, needed = 30 * MM) {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function boolLabel(v) {
  return v ? 'Ja' : 'Nein';
}

function fmt(n, unit = '') {
  if (n == null) return null;
  return `${Number(n).toLocaleString('de-DE', { maximumFractionDigits: 4 })}${unit ? ' ' + unit : ''}`;
}

export async function generateMaterialPdf(material) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true, bufferPages: true, pdfVersion: '1.4', lang: 'de' });
  const chunks = [];
  doc.on('data', c => chunks.push(c));

  await new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
    _buildMaterialPdf(doc, material);
    doc.end();
  });

  return Buffer.concat(chunks);
}

function _buildMaterialPdf(doc, m) {
  // ── Header banner ─────────────────────────────────────────────────────────
  doc.rect(0, 0, PAGE_W, 30 * MM).fill(COLORS.primary);
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#ffffff')
    .text('Materialdatenblatt', MARGIN, 6 * MM, { width: CONTENT_W });
  doc.fontSize(9).font('Helvetica').fillColor('#93c5fd')
    .text('Material Library · Digitaler Materialpass', MARGIN, 14 * MM, { width: CONTENT_W });

  // Material ID badge
  if (m.material_id) {
    doc.fontSize(8).font('Courier-Bold').fillColor('#bfdbfe')
      .text(m.material_id, MARGIN, 22 * MM, { width: CONTENT_W });
  }

  let y = 34 * MM;

  // ── Name + category ───────────────────────────────────────────────────────
  doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.text)
    .text(m.name || 'Unbekanntes Material', MARGIN, y, { width: CONTENT_W });
  y = doc.y + 2 * MM;

  if (m.category || m.material_type) {
    const chips = [m.category, m.material_type].filter(Boolean).join(' · ');
    doc.rect(MARGIN, y, doc.widthOfString(chips) + 8, 5.5 * MM).fill(COLORS.light);
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
      .text(chips, MARGIN + 4, y + 1.5 * MM);
    y += 7 * MM;
  }

  y = divider(doc, y + 1 * MM);

  // ── Description ───────────────────────────────────────────────────────────
  if (m.description || m.short_description) {
    const desc = m.description || m.short_description;
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.text)
      .text(desc, MARGIN, y, { width: CONTENT_W });
    y = doc.y + 4 * MM;
  }

  // ── Basisdaten ────────────────────────────────────────────────────────────
  y = checkY(doc, y, 40 * MM);
  y = sectionHeader(doc, 'Basisdaten', y);

  y = row(doc, 'Einheit', m.unit || m.declared_unit, MARGIN, y, CONTENT_W);
  if (m.declared_unit && m.declared_unit !== m.unit) {
    y = row(doc, 'Deklarierte Einheit', m.declared_unit, MARGIN, y, CONTENT_W);
  }
  y = row(doc, 'Standort', [m.location_name, m.address].filter(Boolean).join(', ') || null, MARGIN, y, CONTENT_W);
  y = row(doc, 'Lebenszyklus', m.lifecycle_scope, MARGIN, y, CONTENT_W);
  if (m.is_reusable != null) y = row(doc, 'Wiederverwendbar', boolLabel(m.is_reusable), MARGIN, y, CONTENT_W);
  if (m.is_transferable != null) y = row(doc, 'Übertragbar', boolLabel(m.is_transferable), MARGIN, y, CONTENT_W);
  if (m.use_indoor || m.use_outdoor) {
    const use = [m.use_indoor && 'Innen', m.use_outdoor && 'Außen'].filter(Boolean).join(', ');
    y = row(doc, 'Einsatzbereich', use, MARGIN, y, CONTENT_W);
  }
  y += 2 * MM;

  // ── GWP / Klimawirkung ────────────────────────────────────────────────────
  const hasGwp = m.gwp_value != null || m.gwp_fossil != null || m.gwp_biogenic != null || m.gwp_luluc != null;
  if (hasGwp) {
    y = checkY(doc, y, 40 * MM);
    y = sectionHeader(doc, 'Klimawirkung (GWP) · A1–A3', y);

    if (m.gwp_value != null) {
      y = row(doc, 'GWP gesamt', fmt(m.gwp_value, m.gwp_unit || 'kg CO₂e'), MARGIN, y, CONTENT_W);
    }
    if (m.gwp_fossil != null) y = row(doc, 'GWP fossil', fmt(m.gwp_fossil, 'kg CO₂e'), MARGIN, y, CONTENT_W);
    if (m.gwp_biogenic != null) y = row(doc, 'GWP biogen', fmt(m.gwp_biogenic, 'kg CO₂e'), MARGIN, y, CONTENT_W);
    if (m.gwp_luluc != null) y = row(doc, 'GWP LULUC', fmt(m.gwp_luluc, 'kg CO₂e'), MARGIN, y, CONTENT_W);
    if (m.gwp_total_value != null) y = row(doc, 'GWP total (alle Module)', fmt(m.gwp_total_value, m.gwp_total_unit || 'kg CO₂e'), MARGIN, y, CONTENT_W);
    y += 2 * MM;
  }

  // ── Weitere LCA-Indikatoren ───────────────────────────────────────────────
  const hasLca = m.adp_fossil != null || m.adp_elements != null || m.water_consumption != null;
  if (hasLca) {
    y = checkY(doc, y, 30 * MM);
    y = sectionHeader(doc, 'Weitere LCA-Indikatoren', y);

    if (m.adp_fossil != null) y = row(doc, 'PENRT (nicht-ern. Energie)', fmt(m.adp_fossil, 'MJ'), MARGIN, y, CONTENT_W);
    if (m.adp_elements != null) y = row(doc, 'ADP Elemente', fmt(m.adp_elements, 'kg Sb-Äq.'), MARGIN, y, CONTENT_W);
    if (m.water_consumption != null) y = row(doc, 'Wasserverbrauch', fmt(m.water_consumption, 'm³'), MARGIN, y, CONTENT_W);
    if (m.recyclate_content != null) y = row(doc, 'Recyclatanteil', fmt(m.recyclate_content, '%'), MARGIN, y, CONTENT_W);
    y += 2 * MM;
  }

  // ── Nachhaltigkeitsbeschreibung ───────────────────────────────────────────
  const hasSust = m.sust_climate_description || m.circularity || m.human_health || m.processing_sustainability;
  if (hasSust) {
    y = checkY(doc, y, 40 * MM);
    y = sectionHeader(doc, 'Nachhaltigkeitsbeschreibung', y);

    if (m.sust_climate_description) y = row(doc, 'Klimaschutz', m.sust_climate_description, MARGIN, y, CONTENT_W);
    if (m.circularity) y = row(doc, 'Kreislaufwirtschaft', m.circularity, MARGIN, y, CONTENT_W);
    if (m.human_health) y = row(doc, 'Gesundheit', m.human_health, MARGIN, y, CONTENT_W);
    if (m.processing_sustainability) y = row(doc, 'Verarbeitung', m.processing_sustainability, MARGIN, y, CONTENT_W);
    y += 2 * MM;
  }

  // ── Ökodesign-Prinzipien ──────────────────────────────────────────────────
  const hasPrinciples = m.principles_sufficiency || m.principles_consistency || m.principles_efficiency;
  if (hasPrinciples) {
    y = checkY(doc, y, 35 * MM);
    y = sectionHeader(doc, 'Ökodesign-Prinzipien', y);

    if (m.principles_sufficiency) y = row(doc, 'Suffizienz', m.principles_sufficiency, MARGIN, y, CONTENT_W);
    if (m.principles_consistency) y = row(doc, 'Konsistenz', m.principles_consistency, MARGIN, y, CONTENT_W);
    if (m.principles_efficiency) y = row(doc, 'Effizienz', m.principles_efficiency, MARGIN, y, CONTENT_W);
    y += 2 * MM;
  }

  // ── Zertifizierungen ──────────────────────────────────────────────────────
  const certs = [
    m.cert_epd && 'EPD (Umweltproduktdeklaration)',
    m.cert_cradle_to_cradle && 'Cradle to Cradle',
    m.cert_fsc_pefc && 'FSC / PEFC',
  ].filter(Boolean);

  if (certs.length > 0) {
    y = checkY(doc, y, 25 * MM);
    y = sectionHeader(doc, 'Zertifizierungen', y);

    for (const cert of certs) {
      doc.rect(MARGIN, y, 3 * MM, 3 * MM).fill(COLORS.green);
      doc.fontSize(8).font('Helvetica').fillColor(COLORS.text)
        .text('✓ ' + cert, MARGIN + 5 * MM, y + 0.5 * MM, { width: CONTENT_W - 5 * MM });
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
        `Materialdatenblatt · ${m.name || ''} · ${m.material_id || ''} · Erstellt am ${new Date().toLocaleDateString('de-DE')}`,
        MARGIN, footerY + 1 * MM, { width: CONTENT_W - 30 * MM }
      );
    doc.fontSize(7).font('Helvetica').fillColor(COLORS.muted)
      .text(`Seite ${i + 1} / ${pages.count}`, MARGIN, footerY + 1 * MM, { width: CONTENT_W, align: 'right' });
  }
}
