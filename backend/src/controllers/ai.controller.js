import OpenAI from 'openai';
import { readFileSync, unlinkSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

const MATERIAL_PROMPT = `Du bist ein Experte für Baumaterialien und Werkstoffe.
Analysiere die hochgeladenen Bilder und extrahiere alle erkennbaren Informationen über das Material.

Antworte NUR mit einem validen JSON-Objekt ohne Markdown-Codeblöcke. Felder die du nicht erkennen kannst lässt du leer ("") oder weg.

Mögliche Kategorien: Holz, Metall, Kunststoff, Stein, Keramik, Textil, Glas, Papier, Verbundstoff, Dämmmaterial, Beton, Ziegel, Sonstiges

Mögliche origin_source-Werte (exakt so zurückgeben): primary, secondary_rückbau, secondary_restposten, secondary_überschuss, secondary_upcycling, secondary_eigenproduktion

JSON-Schema:
{
  "name": "prägnanter Materialname",
  "category": "eine der obigen Kategorien",
  "short_description": "1-2 Sätze",
  "description": "ausführliche Beschreibung (Herkunft, Eigenschaften, Besonderheiten)",
  "origin_acquisition": "woher stammt das Material typischerweise",
  "use_processing": "wie wird es verarbeitet / welche Werkzeuge braucht man",
  "use_where": "wofür eignet es sich",
  "use_not_suitable": "wofür ist es nicht geeignet",
  "use_indoor": true,
  "use_outdoor": false,
  "origin_source": "primary | secondary_rückbau | secondary_restposten | secondary_überschuss | secondary_upcycling | secondary_eigenproduktion",
  "previous_use": "falls gebraucht: was war der frühere Verwendungszweck",
  "tech_dimensions": "typische Abmessungen/Formate",
  "tech_density": "Dichte falls erkennbar",
  "tech_flammability": "Brennbarkeitsklasse falls erkennbar",
  "tech_thermal_insulation": "Dämmwert falls erkennbar",
  "tech_compressive_strength": "Druckfestigkeit falls erkennbar",
  "condition": "Zustand des Materials auf dem Bild (neu/gebraucht/beschädigt)",
  "_confidence": "low|medium|high — wie sicher bist du dir über deine Angaben"
}`;

const PROJECT_PROMPT = `Du bist ein Experte für Bauprojekte, Upcycling und kreative Materialprojekte.
Analysiere die hochgeladenen Bilder und extrahiere alle erkennbaren Informationen über das Projekt.

Antworte NUR mit einem validen JSON-Objekt ohne Markdown-Codeblöcke. Felder die du nicht erkennen kannst lässt du leer ("") oder weg.

JSON-Schema:
{
  "name": "prägnanter Projektname",
  "description": "ausführliche Projektbeschreibung",
  "content": "Hintergründe, Motivation, Kontext",
  "time_effort": "geschätzter Zeitaufwand (z.B. 2-4 Stunden)",
  "tools": "benötigte Werkzeuge und Hilfsmittel (kommagetrennt)",
  "_confidence": "low|medium|high"
}`;

const STEP_PROMPT = `Du bist ein Experte für DIY-Anleitungen, Bauprojekte und Upcycling.
Analysiere das Bild und beschreibe präzise den dargestellten Arbeitsschritt.

Antworte NUR mit einem validen JSON-Objekt ohne Markdown-Codeblöcke.

JSON-Schema:
{
  "title": "kurzer, prägnanter Schritttitel (max. 6 Wörter)",
  "text": "klare Schritt-für-Schritt-Anleitung für diesen Arbeitsschritt (2-4 Sätze, konkret und handlungsorientiert)"
}`;

async function toBase64Jpeg(filePath, mimeType) {
  const isHeic = mimeType === 'image/heic' || mimeType === 'image/heif'
    || filePath.toLowerCase().endsWith('.heic') || filePath.toLowerCase().endsWith('.heif');
  if (isHeic) {
    const jpegPath = filePath + '.jpg';
    try {
      await execFileAsync('heif-convert', ['-q', '85', filePath, jpegPath]);
      const buffer = readFileSync(jpegPath);
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (e) {
      throw Object.assign(new Error('HEIC_UNSUPPORTED'), { isHeicError: true });
    } finally {
      try { unlinkSync(jpegPath); } catch {}
    }
  }
  const buffer = readFileSync(filePath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function parseAiJson(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(cleaned);
}

export const analyzeImages = async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ message: 'Keine Bilder hochgeladen' });

  const mode = ['project', 'step'].includes(req.body.mode) ? req.body.mode : 'material';

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ message: 'OpenAI API-Key nicht konfiguriert (OPENAI_API_KEY fehlt in .env)' });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const imageContents = await Promise.all(files.map(async (f) => ({
      type: 'image_url',
      image_url: { url: await toBase64Jpeg(f.path, f.mimetype), detail: 'high' },
    })));

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1200,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: mode === 'project' ? PROJECT_PROMPT : mode === 'step' ? STEP_PROMPT : MATERIAL_PROMPT },
            ...imageContents,
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? '';
    let data;
    try {
      data = parseAiJson(raw);
    } catch {
      return res.status(422).json({ message: 'KI-Antwort konnte nicht geparst werden', raw });
    }

    res.json({ data, mode });
  } catch (error) {
    if (error.isHeicError) {
      return res.status(415).json({ message: 'HEIC-Dateien werden auf diesem Server nicht unterstützt. Bitte das Foto als JPEG oder PNG exportieren (iPhone: Einstellungen → Kamera → Formate → Kompatibel) und erneut hochladen.' });
    }
    res.status(500).json({ message: 'KI-Analyse fehlgeschlagen', error: error.message });
  } finally {
    for (const f of files) {
      try { unlinkSync(f.path); } catch { /* ignore */ }
    }
  }
};
