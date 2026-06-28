import { getDB } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

const MaterialCircle = {
  create(data) {
    const db = getDB();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO material_circles (id, name, description, owner_id, actor_id, visibility)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.description || null, data.owner_id, data.actor_id || null, data.visibility || 'actor');
    return MaterialCircle.findById(id);
  },

  findById(id) {
    const db = getDB();
    const circle = db.prepare(`
      SELECT mc.*, u.first_name as owner_first_name, u.last_name as owner_last_name,
             a.name as actor_name
      FROM material_circles mc
      LEFT JOIN users u ON mc.owner_id = u.id
      LEFT JOIN actors a ON mc.actor_id = a.id
      WHERE mc.id = ?
    `).get(id);
    if (!circle) return null;
    circle.items = MaterialCircle.getItems(id);
    return circle;
  },

  findByOwner(ownerId) {
    const db = getDB();
    return db.prepare(`
      SELECT mc.*, a.name as actor_name,
             (SELECT COUNT(*) FROM material_circle_items WHERE circle_id = mc.id) as item_count
      FROM material_circles mc
      LEFT JOIN actors a ON mc.actor_id = a.id
      WHERE mc.owner_id = ?
      ORDER BY mc.created_at DESC
    `).all(ownerId);
  },

  findByActor(actorId) {
    const db = getDB();
    return db.prepare(`
      SELECT mc.*,
             (SELECT COUNT(*) FROM material_circle_items WHERE circle_id = mc.id) as item_count
      FROM material_circles mc
      WHERE mc.actor_id = ?
      ORDER BY mc.created_at DESC
    `).all(actorId);
  },

  getItems(circleId) {
    const db = getDB();
    return db.prepare(`
      SELECT m.id, m.name, m.category, m.unit, m.visibility,
             m.created_by, mci.added_at,
             (SELECT file_path FROM material_images WHERE material_id = m.id ORDER BY sort_order ASC LIMIT 1) as thumbnail
      FROM material_circle_items mci
      JOIN materials m ON mci.material_id = m.id
      WHERE mci.circle_id = ?
      ORDER BY mci.added_at DESC
    `).all(circleId);
  },

  addItem(circleId, materialId) {
    const db = getDB();
    db.prepare(
      `INSERT OR IGNORE INTO material_circle_items (circle_id, material_id) VALUES (?, ?)`
    ).run(circleId, materialId);
  },

  removeItem(circleId, materialId) {
    const db = getDB();
    return db.prepare(
      `DELETE FROM material_circle_items WHERE circle_id=? AND material_id=?`
    ).run(circleId, materialId).changes > 0;
  },

  update(id, data) {
    const db = getDB();
    const allowed = ['name', 'description', 'actor_id', 'visibility'];
    const fields = [], values = [];
    for (const f of allowed) {
      if (data[f] === undefined) continue;
      fields.push(`${f} = ?`);
      values.push(data[f] ?? null);
    }
    if (!fields.length) return MaterialCircle.findById(id);
    values.push(id);
    db.prepare(`UPDATE material_circles SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return MaterialCircle.findById(id);
  },

  delete(id) {
    const db = getDB();
    return db.prepare(`DELETE FROM material_circles WHERE id = ?`).run(id).changes > 0;
  },
};

export default MaterialCircle;
