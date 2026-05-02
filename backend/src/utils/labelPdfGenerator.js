import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

// 1 mm = 2.835 PDF points
const MM = 2.835;
// Label dimensions: 105 × 57 mm (Avery Zweckform 3425, Herma 4615)
const LABEL_W  = 105 * MM;  // 297.675 pt
const LABEL_H  =  57 * MM;  // 161.595 pt
const COLS     = 2;
const ROWS     = 5;
// Top margin so the 5-row grid is vertically centred on A4 (297mm)
// (297mm − 5 × 57mm) / 2 = 13.5mm
const TOP_MARGIN = 13.5 * MM;
const QR_SIZE    =  38 * MM;  // visible QR square
const QR_PAD_L   =   5 * MM;  // padding left of QR
const TEXT_PAD_L =   4 * MM;  // gap between QR right edge and text
const TEXT_PAD_R =   4 * MM;  // right margin inside label

/**
 * Generate an A4 PDF with 10 identical self-adhesive labels (2 × 5 grid).
 * @param {object} entity  - material / project row from DB (needs material_id, name, category, location_name)
 * @param {string} entityType - 'materials' | 'projects'
 * @returns {Promise<Buffer>} PDF as a Buffer
 */
export async function generateLabelsPdf(entity, entityType) {
  const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://reallabor-zekiwa-zeitz.de';
  const resolverUrl = `${appUrl}/id/${entity.material_id}`;
  const passportType = entity.passport_type || 'construction';
  const regLabel = passportType === 'product' ? 'EU ESPR 2024/1781' : 'EU CPR 2024/3110';

  // Generate QR code as PNG buffer (high res for crisp print)
  const qrBuffer = await QRCode.toBuffer(resolverUrl, {
    width: 200,
    margin: 1,
    type: 'png',
    color: { dark: '#000000', light: '#ffffff' },
  });

  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true, pdfVersion: '1.4', lang: 'de' });
  const chunks = [];
  doc.on('data', c => chunks.push(c));

  await new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    for (let i = 0; i < COLS * ROWS; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = col * LABEL_W;
      const y = TOP_MARGIN + row * LABEL_H;
      _drawLabel(doc, { x, y, entity, qrBuffer, resolverUrl, regLabel });
    }

    doc.end();
  });

  return Buffer.concat(chunks);
}

function _drawLabel(doc, { x, y, entity, qrBuffer, resolverUrl, regLabel }) {
  doc.save();

  // Dashed cut border
  doc.rect(x + 0.5, y + 0.5, LABEL_W - 1, LABEL_H - 1)
    .dash(2, { space: 2 })
    .strokeColor('#cccccc')
    .lineWidth(0.5)
    .stroke();
  doc.undash().lineWidth(1);

  // QR code image (vertically centred)
  const qrX = x + QR_PAD_L;
  const qrY = y + (LABEL_H - QR_SIZE) / 2;
  doc.image(qrBuffer, qrX, qrY, { width: QR_SIZE, height: QR_SIZE });

  // Text column
  const textX   = qrX + QR_SIZE + TEXT_PAD_L;
  const textMaxW = LABEL_W - (textX - x) - TEXT_PAD_R;
  let   ty       = y + 7 * MM;

  // RZZ header
  doc.fillColor('#666666').fontSize(4.5).font('Helvetica-Bold')
    .text('\u267B RZZ MATERIALIEN', textX, ty, { width: textMaxW });
  ty += 8;

  // Entity name (truncated if too long)
  const name = entity.name || entity.material_name || '';
  doc.fillColor('#111111').fontSize(9).font('Helvetica-Bold')
    .text(name, textX, ty, { width: textMaxW, lineBreak: false, ellipsis: true });
  ty += 13;

  // Category
  if (entity.category) {
    doc.fillColor('#555555').fontSize(6).font('Helvetica')
      .text(entity.category, textX, ty, { width: textMaxW, lineBreak: false });
    ty += 9;
  }

  // Material ID (monospace, prominent)
  doc.fillColor('#000000').fontSize(6.5).font('Courier-Bold')
    .text(entity.material_id, textX, ty, { width: textMaxW, lineBreak: false });
  ty += 10;

  // Location
  const loc = entity.location_name || '';
  if (loc) {
    doc.fillColor('#555555').fontSize(5).font('Helvetica')
      .text(loc, textX, ty, { width: textMaxW, lineBreak: false });
    ty += 8;
  }

  // Regulation badge
  doc.fillColor('#888888').fontSize(4.5).font('Helvetica')
    .text(regLabel, textX, ty, { width: textMaxW, lineBreak: false });

  // Footer URL (bottom of label)
  const urlStr = resolverUrl.replace(/^https?:\/\//, '');
  doc.fillColor('#999999').fontSize(4.5).font('Helvetica')
    .text('Scan \u00B7 ' + urlStr, x + 4 * MM, y + LABEL_H - 7 * MM, { width: LABEL_W - 8 * MM, lineBreak: false });

  doc.restore();
}
