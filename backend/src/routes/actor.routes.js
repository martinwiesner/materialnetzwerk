import { Router } from 'express';
import multer from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join, extname, resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import protect, { optionalAuth } from '../middleware/auth.middleware.js';
import User from '../models/user.model.js';
import { getDB } from '../config/db.js';
import {
  getActors, getActor, createActor, updateActor, deleteActor,
  uploadActorImage, updateActorImage, deleteActorImage,
  addActorLink, removeActorLink,
} from '../controllers/actor.controller.js';

const uploadDir = resolve(process.env.UPLOAD_PATH || './uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = join(uploadDir, 'actors', req.params.id || 'general');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images allowed'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

const router = Router();

router.get('/', getActors);

// GET /api/actors/directory — actors + individual users combined, for people-finder
router.get('/directory/all', optionalAuth, (req, res) => {
  try {
    const db = getDB();
    const { q = '', type = 'all' } = req.query;
    const pattern = q ? `%${q}%` : '%';

    const actors = type !== 'users' ? db.prepare(`
      SELECT a.id, a.name, a.type, a.tagline, a.location_name,
             'actor' as kind,
             (SELECT COUNT(*) FROM users u2 WHERE u2.actor_id = a.id) +
             (SELECT COUNT(*) FROM user_actors ua WHERE ua.actor_id = a.id) as member_count,
             (SELECT file_path FROM actor_images WHERE actor_id = a.id ORDER BY sort_order ASC LIMIT 1) as cover_image
      FROM actors a
      WHERE (a.name LIKE ? OR a.tagline LIKE ? OR a.type LIKE ?)
      ORDER BY a.name ASC
    `).all(pattern, pattern, pattern) : [];

    const users = type !== 'actors' ? db.prepare(`
      SELECT u.id,
             COALESCE(u.first_name || ' ' || u.last_name, u.email) as name,
             u.email, u.first_name, u.last_name, u.actor_id,
             'user' as kind,
             a.name as actor_name
      FROM users u
      LEFT JOIN actors a ON a.id = u.actor_id
      WHERE (u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?
             OR (u.first_name || ' ' || u.last_name) LIKE ?)
      ORDER BY u.first_name ASC, u.email ASC
    `).all(pattern, pattern, pattern, pattern) : [];

    res.json({ actors, users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', getActor);
router.post('/', protect, createActor);
router.put('/:id', protect, updateActor);
router.delete('/:id', protect, deleteActor);
router.post('/:id/images', protect, upload.array('images', 5), uploadActorImage);
router.patch('/:id/images/:imageId', protect, updateActorImage);
router.delete('/:id/images/:imageId', protect, deleteActorImage);
router.post('/:id/links', protect, addActorLink);
router.delete('/:id/links/:linkId', protect, removeActorLink);

// GET /api/actors/:id/members — union of legacy actor_id + user_actors table
router.get('/:id/members', optionalAuth, (req, res) => {
  try {
    const db = getDB();
    const actor = db.prepare('SELECT id FROM actors WHERE id = ?').get(req.params.id);
    if (!actor) return res.status(404).json({ message: 'Actor not found' });
    const members = db.prepare(`
      SELECT DISTINCT u.id, u.first_name, u.last_name, u.email
      FROM users u
      WHERE u.actor_id = ?
      UNION
      SELECT DISTINCT u.id, u.first_name, u.last_name, u.email
      FROM users u JOIN user_actors ua ON ua.user_id = u.id
      WHERE ua.actor_id = ?
      ORDER BY first_name ASC
    `).all(req.params.id, req.params.id);
    res.json(members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/actors/:id/join — request membership (or join directly if open)
router.post('/:id/join', protect, (req, res) => {
  try {
    const db = getDB();
    const actor = db.prepare('SELECT id, owner_id, membership_mode FROM actors WHERE id = ?').get(req.params.id);
    if (!actor) return res.status(404).json({ message: 'Akteur nicht gefunden' });
    const userId = req.user.id;
    const mode = actor.membership_mode || 'open';

    if (mode === 'open') {
      db.prepare(`INSERT OR IGNORE INTO user_actors (user_id, actor_id) VALUES (?, ?)`).run(userId, actor.id);
      db.prepare("DELETE FROM actor_membership_requests WHERE actor_id = ? AND user_id = ?").run(actor.id, userId);
      return res.json({ status: 'joined' });
    }

    // approval_required
    const id = uuidv4();
    db.prepare(`
      INSERT INTO actor_membership_requests (id, actor_id, user_id, status, message)
      VALUES (?, ?, ?, 'pending', ?)
      ON CONFLICT(actor_id, user_id) DO UPDATE SET status = 'pending', updated_at = CURRENT_TIMESTAMP
    `).run(id, actor.id, userId, req.body.message || null);
    return res.json({ status: 'pending' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/actors/:id/leave — leave actor
router.delete('/:id/leave', protect, (req, res) => {
  try {
    const db = getDB();
    db.prepare("DELETE FROM user_actors WHERE user_id = ? AND actor_id = ?").run(req.user.id, req.params.id);
    // also clear legacy actor_id if it points here
    db.prepare("UPDATE users SET actor_id = NULL WHERE id = ? AND actor_id = ?").run(req.user.id, req.params.id);
    db.prepare("DELETE FROM actor_membership_requests WHERE actor_id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ status: 'left' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/actors/:id/membership-requests — owner sees pending requests
router.get('/:id/membership-requests', protect, (req, res) => {
  try {
    const db = getDB();
    const actor = db.prepare('SELECT owner_id FROM actors WHERE id = ?').get(req.params.id);
    if (!actor) return res.status(404).json({ message: 'Not found' });
    if (actor.owner_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ message: 'Forbidden' });
    const requests = db.prepare(`
      SELECT r.*, u.first_name, u.last_name, u.email
      FROM actor_membership_requests r
      JOIN users u ON u.id = r.user_id
      WHERE r.actor_id = ? ORDER BY r.created_at ASC
    `).all(req.params.id);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/actors/:id/membership-requests/:requestId — approve or reject
router.patch('/:id/membership-requests/:requestId', protect, (req, res) => {
  try {
    const db = getDB();
    const actor = db.prepare('SELECT owner_id FROM actors WHERE id = ?').get(req.params.id);
    if (!actor) return res.status(404).json({ message: 'Not found' });
    if (actor.owner_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ message: 'Forbidden' });

    const { status } = req.body; // 'approved' | 'rejected'
    const request = db.prepare('SELECT * FROM actor_membership_requests WHERE id = ?').get(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    db.prepare("UPDATE actor_membership_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(status, req.params.requestId);

    if (status === 'approved') {
      db.prepare(`INSERT OR IGNORE INTO user_actors (user_id, actor_id) VALUES (?, ?)`).run(request.user_id, req.params.id);
    }
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/actors/:id/my-request — check current user's membership / request status
router.get('/:id/my-request', protect, (req, res) => {
  try {
    const db = getDB();
    const isMember = db.prepare(
      `SELECT 1 FROM user_actors WHERE user_id = ? AND actor_id = ?
       UNION SELECT 1 FROM users WHERE id = ? AND actor_id = ?`
    ).get(req.user.id, req.params.id, req.user.id, req.params.id);
    if (isMember) return res.json({ status: 'member' });
    const r = db.prepare("SELECT status FROM actor_membership_requests WHERE actor_id = ? AND user_id = ?")
      .get(req.params.id, req.user.id);
    res.json({ status: r?.status || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
