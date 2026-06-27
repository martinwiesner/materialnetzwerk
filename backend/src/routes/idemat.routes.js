import { Router } from 'express';
import { searchIdemat, getIdematById } from '../services/idemat-service.js';

const router = Router();

// GET /api/idemat/search?q=steel&limit=15
router.get('/search', (req, res) => {
  const q     = String(req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  if (q.length < 2) return res.json([]);
  res.json(searchIdemat(q, limit));
});

// GET /api/idemat/process/:id
router.get('/process/:id', (req, res) => {
  const entry = getIdematById(req.params.id);
  if (!entry) return res.status(404).json({ message: 'Prozess nicht gefunden' });
  res.json(entry);
});

export default router;
