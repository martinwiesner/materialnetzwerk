import express from 'express';
import protect from '../middleware/auth.middleware.js';
import UserShare from '../models/userShare.model.js';
import Material from '../models/material.model.js';
import Project from '../models/project.model.js';
import User from '../models/user.model.js';
import { getDB } from '../config/db.js';

const router = express.Router();

// GET /api/shares/material/:materialId — list shares (owner only)
router.get('/material/:materialId', protect, (req, res) => {
  try {
    const material = Material.findById(req.params.materialId);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (material.created_by !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const shares = UserShare.findByEntity('material', req.params.materialId);
    res.json(shares);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/shares/material/:materialId — add or update a share
router.post('/material/:materialId', protect, (req, res) => {
  try {
    const material = Material.findById(req.params.materialId);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (material.created_by !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { email, access_level = 'view' } = req.body;
    if (!email) return res.status(400).json({ message: 'email required' });
    if (!['view', 'edit'].includes(access_level)) {
      return res.status(400).json({ message: 'access_level must be view or edit' });
    }
    const target = User.findByEmail(email);
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot share with yourself' });
    }
    const share = UserShare.create('material', req.params.materialId, req.user.id, target.id, access_level);
    res.status(201).json(share);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/shares/material/:materialId/:userId — revoke share
router.delete('/material/:materialId/:userId', protect, (req, res) => {
  try {
    const material = Material.findById(req.params.materialId);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (material.created_by !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const deleted = UserShare.delete('material', req.params.materialId, req.params.userId);
    if (!deleted) return res.status(404).json({ message: 'Share not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/shares/users/search?q=... — search users by name or email (for sharing UI)
router.get('/users/search', protect, (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const db = getDB();
    const pattern = `%${q}%`;
    const users = db.prepare(`
      SELECT id, first_name, last_name, email
      FROM users
      WHERE id != ?
        AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?
             OR (first_name || ' ' || last_name) LIKE ?)
      ORDER BY first_name ASC
      LIMIT 10
    `).all(req.user.id, pattern, pattern, pattern, pattern);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/shares/material/:materialId/actors — list shared actors
router.get('/material/:materialId/actors', protect, (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare(`
      SELECT a.id, a.name FROM material_shared_actors msa
      JOIN actors a ON a.id = msa.actor_id
      WHERE msa.material_id = ?
    `).all(req.params.materialId);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/shares/material/:materialId/actors — replace all shared actors
router.put('/material/:materialId/actors', protect, (req, res) => {
  try {
    const db = getDB();
    const material = Material.findById(req.params.materialId);
    if (!material) return res.status(404).json({ message: 'Not found' });
    if (material.created_by !== req.user.id && !req.user.is_admin) return res.status(403).json({ message: 'Forbidden' });
    const actor_ids = Array.isArray(req.body.actor_ids) ? req.body.actor_ids : [];
    db.prepare('DELETE FROM material_shared_actors WHERE material_id = ?').run(req.params.materialId);
    for (const aid of actor_ids) {
      db.prepare('INSERT OR IGNORE INTO material_shared_actors (material_id, actor_id) VALUES (?, ?)').run(req.params.materialId, aid);
    }
    res.json({ ok: true, actor_ids });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/shares/project/:projectId — list shares (owner only)
router.get('/project/:projectId', protect, (req, res) => {
  try {
    const project = Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.owner_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const shares = UserShare.findByEntity('project', req.params.projectId);
    res.json(shares);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/shares/project/:projectId — add or update a share
router.post('/project/:projectId', protect, (req, res) => {
  try {
    const project = Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.owner_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { email, access_level = 'view' } = req.body;
    if (!email) return res.status(400).json({ message: 'email required' });
    if (!['view', 'edit'].includes(access_level)) {
      return res.status(400).json({ message: 'access_level must be view or edit' });
    }
    const target = User.findByEmail(email);
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot share with yourself' });
    }
    const share = UserShare.create('project', req.params.projectId, req.user.id, target.id, access_level);
    res.status(201).json(share);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/shares/project/:projectId/:userId — revoke share
router.delete('/project/:projectId/:userId', protect, (req, res) => {
  try {
    const project = Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.owner_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const deleted = UserShare.delete('project', req.params.projectId, req.params.userId);
    if (!deleted) return res.status(404).json({ message: 'Share not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/shares/me/actor — link current user to an actor
router.patch('/me/actor', protect, (req, res) => {
  try {
    const { actor_id } = req.body;
    const db = getDB();
    if (actor_id) {
      const actor = db.prepare('SELECT id FROM actors WHERE id = ?').get(actor_id);
      if (!actor) return res.status(404).json({ message: 'Actor not found' });
    }
    const updated = User.setActorId(req.user.id, actor_id || null);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
