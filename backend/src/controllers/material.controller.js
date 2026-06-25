/**
 * Material Controller
 * Handles material CRUD operations
 */

import Material from '../models/material.model.js';
import MaterialCategory from '../models/materialCategory.model.js';
import { readFileSync, unlinkSync } from 'fs';
import OpenAI from 'openai';
import { generateMaterialPdf } from '../utils/materialPdfGenerator.js';

const isAdmin = (u) => u?.is_admin === 1 || u?.is_admin === true;

/**
 * Get all materials
 * @param {Object} req
 * @param {Object} res
 */
export const getMaterials = (req, res) => {
  try {
    const { category, search, limit, offset, my_materials } = req.query;
    
    const filters = {};
    if (category) filters.category = category;
    if (search) filters.search = search;
    const parsedLimit = Number.parseInt(limit, 10);
    const parsedOffset = Number.parseInt(offset, 10);
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) filters.limit = parsedLimit;
    if (Number.isFinite(parsedOffset) && parsedOffset >= 0) filters.offset = parsedOffset;
    if (my_materials === 'true') {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required for my_materials filter' });
      }
      filters.created_by = req.user.id;
    }

    const materials = Material.findAll(filters);
    // count() ignores limit/offset, but we pass only the relevant filters anyway
    const total = Material.count({
      category: filters.category,
      created_by: filters.created_by,
    });

    res.json({
      data: materials,
      total,
      limit: filters.limit || materials.length,
      offset: filters.offset || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch materials', error: error.message });
  }
};

/**
 * Get material by ID
 * @param {Object} req
 * @param {Object} res
 */
export const getMaterialById = (req, res) => {
  try {
    const material = Material.findById(req.params.id);

    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }

    material.actors = Material.getActors(req.params.id);
    res.json(material);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch material', error: error.message });
  }
};

/**
 * Create new material
 * @param {Object} req
 * @param {Object} res
 */
export const createMaterial = (req, res) => {
  try {
    const materialData = {
      ...req.body,
      created_by: req.user.id
    };

    // Category is optional; only validate if a non-empty value is provided
    if (materialData.category && !MaterialCategory.exists(materialData.category)) {
      return res.status(400).json({ message: 'Invalid category. Please select a predefined category.' });
    }

    const material = Material.create(materialData);
    res.status(201).json(material);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create material', error: error.message });
  }
};

/**
 * Update material
 * @param {Object} req
 * @param {Object} res
 */
export const updateMaterial = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }

    // Check ownership
    if (material.created_by !== req.user.id && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized to update this material' });
    }

    // Validate category if attempting to change it
    if (Object.prototype.hasOwnProperty.call(req.body, 'category')) {
      const newCategory = req.body.category;
      const currentCategory = material.category;
      // Allow keeping legacy value unchanged; enforce for changes
      const isChanging = newCategory !== currentCategory;
      if (isChanging && newCategory && !MaterialCategory.exists(newCategory)) {
        return res.status(400).json({ message: 'Invalid category. Please select a predefined category.' });
      }
    }

    const updated = Material.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    console.error('[updateMaterial] ERROR:', error.message, '\nBody keys:', Object.keys(req.body || {}));
    res.status(500).json({ message: 'Failed to update material', error: error.message });
  }
};

/**
 * Delete material
 * @param {Object} req
 * @param {Object} res
 */
export const deleteMaterial = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }

    // Check ownership
    if (material.created_by !== req.user.id && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized to delete this material' });
    }

    Material.delete(req.params.id);
    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete material', error: error.message });
  }
};

export const downloadMaterialPdf = async (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    const pdfBuffer = await generateMaterialPdf(material);
    const filename = `material-${(material.material_id || material.id).replace(/[^a-z0-9-]/gi, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: 'PDF-Generierung fehlgeschlagen', error: error.message });
  }
};

/**
 * Get material categories
 * @param {Object} req
 * @param {Object} res
 */
export const getCategories = (req, res) => {
  try {
    const categories = MaterialCategory.getAll();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
};

// ── Image endpoints ─────────────────────────────────────────────────────────

export const uploadMaterialImages = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (material.created_by !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Not authorized' });
    if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded' });
    const sortStart = parseInt(req.body.sort_start || '0', 10);
    const stepIndex = req.body.step_index !== undefined ? parseInt(req.body.step_index, 10) : null;
    const stepCaption = req.body.step_caption || null;
    const saved = req.files.map((file, i) => Material.addImage(req.params.id, file, sortStart + i, stepIndex, stepCaption));
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload images', error: error.message });
  }
};

export const getMaterialImages = (req, res) => {
  try {
    res.json(Material.getImages(req.params.id));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch images', error: error.message });
  }
};

export const updateMaterialImage = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (material.created_by !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Not authorized' });
    const updates = {};
    if (Object.hasOwn(req.body, 'credit')) updates.credit = req.body.credit;
    Material.updateImageMeta(req.params.imageId, updates);
    res.json(Material.getImages(req.params.id));
  } catch (error) {
    res.status(500).json({ message: 'Failed to update image', error: error.message });
  }
};

export const deleteMaterialImage = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (material.created_by !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Not authorized' });
    Material.deleteImage(req.params.imageId);
    res.json({ message: 'Image deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete image', error: error.message });
  }
};

// ── File endpoints ──────────────────────────────────────────────────────────

export const uploadMaterialFilesCtrl = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (material.created_by !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Not authorized' });
    if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded' });
    const label = req.body.label || null;
    const saved = req.files.map(file => Material.addFile(req.params.id, file, label));
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload files', error: error.message });
  }
};

export const getMaterialFiles = (req, res) => {
  try {
    res.json(Material.getFiles(req.params.id));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch files', error: error.message });
  }
};

export const deleteMaterialFile = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (material.created_by !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Not authorized' });
    Material.deleteFile(req.params.fileId);
    res.json({ message: 'File deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete file', error: error.message });
  }
};

export const getMaterialActors = (req, res) => {
  try {
    const actors = Material.getActors(req.params.id);
    res.json(actors);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get actors', error: error.message });
  }
};

export const setMaterialActors = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (material.created_by !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Not authorized' });
    const actorIds = Array.isArray(req.body.actor_ids) ? req.body.actor_ids : [];
    Material.setActors(req.params.id, actorIds);
    res.json({ actor_ids: actorIds });
  } catch (error) {
    res.status(500).json({ message: 'Failed to set actors', error: error.message });
  }
};

// ── EPD PDF parsing ──────────────────────────────────────────────────────────

// Keywords that strongly indicate an EPD LCA results table page
const EPD_HIGH_KEYWORDS = ['GWP', 'ODP', 'POCP', 'ADPE', 'ADPF', 'PERE', 'PENRE', 'PERM', 'HWD', 'NHWD', 'RWD', 'WDP'];
const EPD_MED_KEYWORDS  = ['A1-A3', 'ÖKOBILANZ', 'OKOBILANZ', 'LCA', 'UMWELTWIRKUNG', 'RESSOURCENINANSPRUCHNAHME',
                           'DEKLARIERTE EINHEIT', 'DECLARED UNIT', 'EN 15804', 'KG CO', 'MOL H', 'MOL N'];

function scorePageForEpd(text) {
  if (!text || text.trim().length < 20) return 0;
  const t = text.toUpperCase();
  let score = 0;
  for (const k of EPD_HIGH_KEYWORDS) if (t.includes(k)) score += 3;
  for (const k of EPD_MED_KEYWORDS)  if (t.includes(k)) score += 2;
  // Scientific notation numbers (including negative) are common in EPD tables
  const sciMatches = (text.match(/[-−]?\d[,.]?\d*\s*[Ee][+\-]?\d+/g) || []).length;
  score += Math.min(sciMatches, 6);
  // Many numbers = table-like structure
  const numCount = (text.match(/[-]?\d+[,.]\d+/g) || []).length;
  score += Math.min(Math.floor(numCount / 8), 3);
  return score;
}

const EPD_EXTRACT_PROMPT = `Du bist Experte für Umweltproduktdeklarationen (EPDs) nach EN 15804+A2.
Du erhältst den extrahierten Text einer EPD und sollst alle relevanten Felder extrahieren.

WICHTIGE HINWEISE:
- Für LCA-Zahlenwerte: Verwende IMMER den Wert für Phase A1-A3 (Herstellungsphase). Falls nur Einzelmodule (A1, A2, A3) vorliegen: summiere diese.
- Deutsche Dezimalnotation: "32,1" = 32.1, wissenschaftliche Notation "1,10E-06" = 0.0000011
- NEGATIVE WERTE: Sehr wichtig — GWP-biogenic ist bei Holz/Biomasse oft NEGATIV (gespeicherter Kohlenstoff). Negative Werte können im PDF als "-2,45", "−2,45" (Gedankenstrich), "- 2,45" (mit Leerzeichen) oder "-2,45E+00" erscheinen. Gib diese IMMER als negativen Float aus, z.B. -2.45
- Felder die nicht eindeutig gefunden wurden WEGLASSEN (nicht als null oder "" ausgeben)

Gib folgende JSON-Struktur zurück:
{
  "fields": {
    "name": "Produktname",
    "short_description": "1-2 Sätze Beschreibung",
    "manufacturer": "Hersteller",
    "declared_unit": "z.B. 1 m³",
    "lifecycle_scope": "A1-A3 | A1-A5 | A1-D",
    "tech_density": 123.4,
    "category": "eines von: Dämmmaterial, Holz, Metall, Kunststoff, Stein, Keramik, Textil, Glas, Papier, Verbundstoff, Beton, Ziegel, Sonstiges",
    "material_type": "primary | secondary_rückbau | secondary_restposten | secondary_überschuss | secondary_upcycling | secondary_eigenproduktion — EPDs sind fast immer Neuware (primary), nur abweichen wenn EPD explizit Recycling-/Rückbauprodukt deklariert",
    "cert_epd": true,
    "cert_cradle_to_cradle": false,
    "cert_fsc_pefc": false,
    "gwp_fossil": Zahl,
    "gwp_biogenic": Zahl,
    "gwp_luluc": Zahl,
    "odp": Zahl,
    "ap": Zahl,
    "ep_terrestrial": Zahl,
    "ep_freshwater": Zahl,
    "ep_marine": Zahl,
    "pocp": Zahl,
    "adp_elements": Zahl,
    "adp_fossil": Zahl,
    "water_consumption": Zahl,
    "hwd": Zahl,
    "nhwd": Zahl,
    "rwd": Zahl,
    "pere": Zahl,
    "penre": Zahl,
    "perm": Zahl,
    "sust_climate_description": "1-3 Sätze qualitative Zusammenfassung des Klimaimpakts und der wichtigsten Umweltwirkungen laut EPD",
    "circularity": "Kreislauffähigkeit, Recyclingfähigkeit, Rezyklat-Anteil laut EPD",
    "human_health": "VOC-Emissionen, Schadstoffaussagen, relevante Gesundheitsaspekte laut EPD",
    "processing_sustainability": "Verarbeitung, Einbau, Entsorgungshinweise laut EPD",
    "principles_consistency": ["Nachwachsende Rohstoffe", "Recycelte Rohstoffe", "Recyclinggerecht", "Kompostierbar"],
    "principles_efficiency": ["Schadstofffrei", "Naturraumerhaltend", "Faire Materialgewinnung", "Regional"],
    "source_url": "URL falls vorhanden",
    "notes": "EPD-Nummer falls vorhanden"
  },
  "confidence": {
    "overall": "high | medium | low",
    "score": 0-100,
    "summary": "Kurze Einschätzung (1-2 Sätze): was war klar erkennbar, was war unsicher",
    "vision_helped": true | false,
    "per_field": {
      "name": "high | medium | low",
      "category": "high | medium | low",
      "material_type": "high | medium | low",
      "gwp_fossil": "high | medium | low",
      "sust_climate_description": "high | medium | low",
      "principles_consistency": "high | medium | low",
      "principles_efficiency": "high | medium | low"
    }
  }
}

Hinweise zu den neuen Feldern:
- principles_consistency: Nur Werte aus exakt dieser Liste aufnehmen die durch EPD-Inhalt belegt sind: ["Nachwachsende Rohstoffe", "Recycelte Rohstoffe", "Recyclinggerecht", "Kompostierbar"]
- principles_efficiency: Nur Werte aus exakt dieser Liste: ["Schadstofffrei", "Naturraumerhaltend", "Faire Materialgewinnung", "Regional"]
- Leere Arrays weglassen (nicht [] ausgeben)

confidence.score Richtlinien:
- 90-100: Tabellenstruktur eindeutig, alle Spalten/Zeilen klar, A1-A3-Werte zweifelsfrei
- 70-89: Meiste Werte erkannt, einzelne Felder leicht unsicher (z.B. Modulzuordnung)
- 50-69: Einige Werte erkannt, Tabelle teils unklar oder Spalten schwer zuzuordnen
- <50: Wenige oder keine LCA-Tabellen gefunden, Werte unzuverlässig

Antworte NUR mit dem JSON-Objekt, keine Erklärungen außerhalb.`;

function parseAiResponse(raw) {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(cleaned);
}

async function runEpdPrompt(textContent, client) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    messages: [{ role: 'user', content: EPD_EXTRACT_PROMPT + '\n\nEPD-Text:\n' + textContent.slice(0, 28000) }],
  });
  const raw = response.choices[0]?.message?.content ?? '';
  const parsed = parseAiResponse(raw);
  const fields = parsed.fields || parsed;
  const confidence = parsed.confidence || null;
  if (!fields.gwp_value) {
    const f = parseFloat(fields.gwp_fossil), b = parseFloat(fields.gwp_biogenic), l = parseFloat(fields.gwp_luluc);
    if (!isNaN(f) || !isNaN(b) || !isNaN(l)) fields.gwp_value = (isNaN(f)?0:f)+(isNaN(b)?0:b)+(isNaN(l)?0:l);
  }
  return { fields, confidence };
}

export const parseEpdFromPdf = async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'Keine Datei hochgeladen' });
  if (!process.env.OPENAI_API_KEY) {
    try { unlinkSync(file.path); } catch {}
    return res.status(503).json({ message: 'OpenAI API-Key nicht konfiguriert' });
  }

  const ext = file.originalname.toLowerCase().split('.').pop();
  const isJson = ext === 'json' || file.mimetype === 'application/json';
  const isXml  = ext === 'xml'  || file.mimetype === 'application/xml' || file.mimetype === 'text/xml';

  // ── JSON / XML: read text, send directly to GPT ──────────────────────────
  if (isJson || isXml) {
    try {
      const raw = readFileSync(file.path, 'utf8');
      let textContent = raw;
      if (isJson) {
        try { textContent = JSON.stringify(JSON.parse(raw), null, 2); } catch { /* use raw */ }
      }
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const { fields, confidence } = await runEpdPrompt(textContent, client);
      return res.json({
        data: fields,
        confidence,
        meta: { format: isJson ? 'json' : 'xml', usedVision: false },
      });
    } catch (error) {
      return res.status(500).json({ message: 'EPD-Analyse fehlgeschlagen', error: error.message });
    } finally {
      try { unlinkSync(file.path); } catch {}
    }
  }

  // ── PDF: existing dual-approach flow ─────────────────────────────────────
  try {
    const { PDFParse } = await import('pdf-parse');
    const buffer = readFileSync(file.path);

    // ── Phase 1: Text extraction ──────────────────────────────────────────────
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    const fullText = textResult.text || '';
    const pages = Array.isArray(textResult.pages) ? textResult.pages : [];

    if (!fullText || fullText.trim().length < 50) {
      return res.status(422).json({ message: 'PDF enthält keinen lesbaren Text (möglicherweise gescannt/verschlüsselt)' });
    }

    // ── Phase 2: Score pages, identify EPD table pages ────────────────────────
    const scored = pages.map(p => ({
      num: p.num || 1,
      text: p.text || '',
      score: scorePageForEpd(p.text || ''),
    }));

    const epdPageNums = scored
      .filter(p => p.score >= 6)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(p => p.num);

    // ── Phase 3: Screenshot relevant pages for vision ─────────────────────────
    const pageImages = [];
    if (epdPageNums.length > 0) {
      try {
        const parser2 = new PDFParse({ data: buffer });
        const shots = await parser2.getScreenshot({ partial: epdPageNums, desiredWidth: 1400 });
        for (const pg of (shots.pages || [])) {
          if (pg.dataUrl) pageImages.push({ pageNum: pg.pageNumber, dataUrl: pg.dataUrl });
        }
      } catch (e) {
        // Non-fatal — continue without vision
        console.warn('[EPD-parse] Screenshot failed:', e.message);
      }
    }

    const usedVision = pageImages.length > 0;

    // ── Phase 4: Build GPT-4o message (text + optional vision) ───────────────
    const relevantText = epdPageNums.length > 0
      ? scored.filter(p => epdPageNums.includes(p.num)).map(p => `[Seite ${p.num}]\n${p.text}`).join('\n\n')
        + '\n\n[Weitere Seiten (Kontext)]\n' + fullText.slice(0, 8000)
      : fullText.slice(0, 28000);

    const visionNote = usedVision
      ? `\n\nZUSATZ: ${pageImages.length} Seiten-Screenshots der LCA-Tabellen (Seiten ${epdPageNums.join(', ')}) sind ebenfalls angehängt. Nutze die Bilder um die Tabellenstruktur zu verifizieren — besonders für die korrekte Spaltenzuordnung der A1-A3-Werte.`
      : '\n\nHINWEIS: Nur Text verfügbar, kein Seitenbild. Sei konservativer bei der Confidence-Bewertung.';

    const textPart = { type: 'text', text: EPD_EXTRACT_PROMPT + visionNote + '\n\nEPD-Text:\n' + relevantText.slice(0, 22000) };
    const imageParts = pageImages.map(img => ({
      type: 'image_url',
      image_url: { url: img.dataUrl, detail: 'high' },
    }));

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4000,
      messages: [{ role: 'user', content: [textPart, ...imageParts] }],
    });

    // ── Phase 5: Parse response ───────────────────────────────────────────────
    const raw = response.choices[0]?.message?.content ?? '';
    let parsed;
    try {
      parsed = parseAiResponse(raw);
    } catch {
      return res.status(422).json({ message: 'KI-Antwort konnte nicht geparst werden', raw });
    }

    const fields = parsed.fields || parsed;
    const confidence = parsed.confidence || null;

    // Compute gwp_value from components if missing
    if (!fields.gwp_value) {
      const f = parseFloat(fields.gwp_fossil), b = parseFloat(fields.gwp_biogenic), l = parseFloat(fields.gwp_luluc);
      if (!isNaN(f) || !isNaN(b) || !isNaN(l)) {
        fields.gwp_value = (isNaN(f) ? 0 : f) + (isNaN(b) ? 0 : b) + (isNaN(l) ? 0 : l);
      }
    }

    res.json({
      data: fields,
      confidence,
      meta: {
        totalPages: pages.length || 1,
        epdPages: epdPageNums,
        usedVision,
        screenshotPages: pageImages.map(p => p.pageNum),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'EPD-Analyse fehlgeschlagen', error: error.message });
  } finally {
    try { unlinkSync(file.path); } catch {}
  }
};
