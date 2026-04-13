import { getDB } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { resolve } from 'path';

function normPath(absPath) {
  if (!absPath) return null;
  const fwd = absPath.replace(/\\/g, '/');
  const idx = fwd.indexOf('/uploads/');
  if (idx !== -1) return fwd.slice(idx);
  return null;
}

const Actor = {
  findAll: (filters = {}) => {
    const db = getDB();
    let query = `SELECT a.*, u.first_name as owner_first_name, u.last_name as owner_last_name, u.email as owner_email
      FROM actors a LEFT JOIN users u ON a.owner_id = u.id WHERE 1=1`;
    const params = [];
    if (filters.search) {
      query += ' AND (a.name LIKE ? OR a.type LIKE ? OR a.description LIKE ? OR a.location_name LIKE ?)';
      const q = `%${filters.search}%`;
      params.push(q, q, q, q);
    }
    if (filters.type) { query += ' AND a.type = ?'; params.push(filters.type); }
    query += ' ORDER BY a.created_at DESC';
    const rows = db.prepare(query).all(...params);
    const imgQ = db.prepare('SELECT * FROM actor_images WHERE actor_id = ? ORDER BY sort_order ASC, created_at ASC');
    const linkQ = db.prepare('SELECT * FROM actor_links WHERE actor_id = ? ORDER BY created_at ASC');
    return rows.map(r => ({
      ...r,
      images: imgQ.all(r.id),
      links: linkQ.all(r.id),
    }));
  },

  findById: (id) => {
    const db = getDB();
    const actor = db.prepare(`
      SELECT a.*, u.first_name as owner_first_name, u.last_name as owner_last_name, u.email as owner_email
      FROM actors a JOIN users u ON a.owner_id = u.id WHERE a.id = ?
    `).get(id);
    if (!actor) return null;
    actor.images = db.prepare('SELECT * FROM actor_images WHERE actor_id = ? ORDER BY sort_order ASC, created_at ASC').all(id);
    actor.links = db.prepare('SELECT * FROM actor_links WHERE actor_id = ? ORDER BY created_at ASC').all(id);
    return actor;
  },

  create: (data) => {
    const db = getDB();
    const id = uuidv4();
    db.prepare(`INSERT INTO actors (
      id, name, type, tagline, description, website, email, phone,
      location_name, address, latitude, longitude, owner_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.name, data.type || null, data.tagline || null, data.description || null,
        data.website || null, data.email || null, data.phone || null,
        data.location_name || null, data.address || null,
        data.latitude ?? null, data.longitude ?? null, data.owner_id);
    return Actor.findById(id);
  },

  update: (id, data) => {
    const db = getDB();
    db.prepare(`UPDATE actors SET
      name = ?, type = ?, tagline = ?, description = ?, website = ?, email = ?, phone = ?,
      location_name = ?, address = ?, latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`)
      .run(data.name, data.type || null, data.tagline || null, data.description || null,
        data.website || null, data.email || null, data.phone || null,
        data.location_name || null, data.address || null,
        data.latitude ?? null, data.longitude ?? null, id);
    return Actor.findById(id);
  },

  delete: (id) => {
    const db = getDB();
    return db.prepare('DELETE FROM actors WHERE id = ?').run(id).changes > 0;
  },

  addImage: (actorId, file, sortOrder = 0) => {
    const db = getDB();
    const id = uuidv4();
    const webPath = normPath(file.path);
    db.prepare(`INSERT INTO actor_images (id, actor_id, filename, original_name, mime_type, file_size, file_path, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, actorId, file.filename, file.originalname, file.mimetype, file.size, webPath, sortOrder);
    return db.prepare('SELECT * FROM actor_images WHERE id = ?').get(id);
  },

  deleteImage: (imageId) => {
    const db = getDB();
    const img = db.prepare('SELECT * FROM actor_images WHERE id = ?').get(imageId);
    db.prepare('DELETE FROM actor_images WHERE id = ?').run(imageId);
    return img;
  },

  addLink: (actorId, entityType, entityId) => {
    const db = getDB();
    const id = uuidv4();
    try {
      db.prepare('INSERT INTO actor_links (id, actor_id, entity_type, entity_id) VALUES (?, ?, ?, ?)')
        .run(id, actorId, entityType, entityId);
    } catch (e) {
      if (!e.message?.includes('UNIQUE')) throw e;
      // already linked — return existing
      return db.prepare('SELECT * FROM actor_links WHERE actor_id = ? AND entity_type = ? AND entity_id = ?')
        .get(actorId, entityType, entityId);
    }
    return db.prepare('SELECT * FROM actor_links WHERE id = ?').get(id);
  },

  removeLink: (linkId) => {
    const db = getDB();
    return db.prepare('DELETE FROM actor_links WHERE id = ?').run(linkId).changes > 0;
  },
};

export default Actor;
