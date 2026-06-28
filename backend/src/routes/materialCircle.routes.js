import express from 'express';
import protect, { optionalAuth } from '../middleware/auth.middleware.js';
import MaterialCircle from '../models/materialCircle.model.js';
import Material from '../models/material.model.js';
import { canViewMaterial } from '../utils/access.js';

const router = express.Router();

// GET /api/circles — own circles (+ actor circles if user has actor)
router.get('/', protect, (req, res) => {
  try {
    const circles = MaterialCircle.findByOwner(req.user.id);
    res.json(circles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/circles/actor/:actorId — all circles of an actor
router.get('/actor/:actorId', optionalAuth, (req, res) => {
  try {
    const circles = MaterialCircle.findByActor(req.params.actorId);
    res.json(circles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/circles — create circle
router.post('/', protect, (req, res) => {
  try {
    const { name, description, actor_id, visibility } = req.body;
    if (!name) return res.status(400).json({ message: 'name required' });
    const allowed = ['private', 'actor', 'public'];
    if (visibility && !allowed.includes(visibility)) {
      return res.status(400).json({ message: 'visibility must be private, actor or public' });
    }
    const circle = MaterialCircle.create({ name, description, actor_id, visibility, owner_id: req.user.id });
    res.status(201).json(circle);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/circles/:id — circle detail with items
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const circle = MaterialCircle.findById(req.params.id);
    if (!circle) return res.status(404).json({ message: 'Circle not found' });
    // public circles are visible to all; actor/private require membership or ownership
    if (circle.visibility !== 'public' && circle.owner_id !== req.user?.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(circle);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/circles/:id — update
router.patch('/:id', protect, (req, res) => {
  try {
    const circle = MaterialCircle.findById(req.params.id);
    if (!circle) return res.status(404).json({ message: 'Circle not found' });
    if (circle.owner_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const updated = MaterialCircle.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/circles/:id/items — add material to circle
router.post('/:id/items', protect, (req, res) => {
  try {
    const circle = MaterialCircle.findById(req.params.id);
    if (!circle) return res.status(404).json({ message: 'Circle not found' });
    if (circle.owner_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { material_id } = req.body;
    if (!material_id) return res.status(400).json({ message: 'material_id required' });
    const material = Material.findById(material_id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (!canViewMaterial(req.user.id, material)) {
      return res.status(403).json({ message: 'No access to this material' });
    }
    MaterialCircle.addItem(req.params.id, material_id);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/circles/:id/items/:materialId — remove material from circle
router.delete('/:id/items/:materialId', protect, (req, res) => {
  try {
    const circle = MaterialCircle.findById(req.params.id);
    if (!circle) return res.status(404).json({ message: 'Circle not found' });
    if (circle.owner_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const removed = MaterialCircle.removeItem(req.params.id, req.params.materialId);
    if (!removed) return res.status(404).json({ message: 'Item not found in circle' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/circles/:id — delete circle
router.delete('/:id', protect, (req, res) => {
  try {
    const circle = MaterialCircle.findById(req.params.id);
    if (!circle) return res.status(404).json({ message: 'Circle not found' });
    if (circle.owner_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    MaterialCircle.delete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
