import { Router } from 'express';
import { getDB } from '../config/db.js';

const router = Router();

/**
 * Resolver: /id/:materialId
 * Browser requests → 302 redirect to the frontend detail page.
 * API clients (Accept: application/json) → JSON with resolved path.
 */
router.get('/:materialId', (req, res) => {
  const { materialId } = req.params;
  const db = getDB();

  const parts = materialId.split('-');
  // Expected format: RZZ-{TYPE}-YYYYMM-NNNN
  if (parts.length < 2) {
    return res.status(400).json({ message: 'Invalid ID format', id: materialId });
  }

  const typeCode = parts[1]; // MAT, PRJ, AKT, INV
  let row, redirectPath;

  if (typeCode === 'MAT') {
    row = db.prepare('SELECT id FROM materials WHERE material_id = ?').get(materialId);
    if (row) redirectPath = `/materials/${row.id}`;
  } else if (typeCode === 'PRJ') {
    row = db.prepare('SELECT id FROM projects WHERE material_id = ?').get(materialId);
    if (row) redirectPath = `/projects/${row.id}`;
  } else if (typeCode === 'AKT') {
    row = db.prepare('SELECT id FROM actors WHERE material_id = ?').get(materialId);
    if (row) redirectPath = `/actors/${row.id}`;
  } else if (typeCode === 'INV' || typeCode === 'GSC') {
    row = db.prepare('SELECT id FROM inventory WHERE material_id_code = ?').get(materialId);
    if (row) redirectPath = `/`;
  }

  if (!row) {
    return res.status(404).json({ message: 'ID not found', id: materialId });
  }

  // API clients get JSON
  const accept = req.headers['accept'] || '';
  if (accept.includes('application/json') && !accept.includes('text/html')) {
    return res.json({ id: materialId, redirect: redirectPath });
  }

  // Browsers get redirected to the frontend SPA
  const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
  return res.redirect(302, `${frontendUrl}${redirectPath}`);
});

export default router;
