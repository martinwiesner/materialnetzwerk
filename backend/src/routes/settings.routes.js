import { Router } from 'express';
import protect from '../middleware/auth.middleware.js';
import { getDB } from '../config/db.js';

const router = Router();

// GET /api/settings — public, returns all settings as { key: value }
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare('SELECT key, value FROM platform_settings').all();
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/settings/:key — admin only
router.put('/:key', protect, (req, res) => {
  if (!req.user?.is_admin) {
    return res.status(403).json({ message: 'Admin-Zugriff erforderlich' });
  }
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined) {
    return res.status(400).json({ message: 'value fehlt' });
  }
  try {
    const db = getDB();
    db.prepare(
      'INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
    ).run(key, String(value));
    res.json({ ok: true, key, value });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
