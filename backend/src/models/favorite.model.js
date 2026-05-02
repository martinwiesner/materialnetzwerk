import { getDB } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

const Favorite = {
  add(userId, entityType, entityId) {
    const db = getDB();
    db.prepare(
      'INSERT OR IGNORE INTO user_favorites (id, user_id, entity_type, entity_id) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), userId, entityType, entityId);
  },

  remove(userId, entityType, entityId) {
    const db = getDB();
    db.prepare(
      'DELETE FROM user_favorites WHERE user_id = ? AND entity_type = ? AND entity_id = ?'
    ).run(userId, entityType, entityId);
  },

  findByUser(userId) {
    const db = getDB();
    return db.prepare(
      'SELECT * FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId);
  },

  isFavorited(userId, entityType, entityId) {
    const db = getDB();
    return !!db.prepare(
      'SELECT 1 FROM user_favorites WHERE user_id = ? AND entity_type = ? AND entity_id = ?'
    ).get(userId, entityType, entityId);
  },

  countByEntity(entityType, entityId) {
    const db = getDB();
    return (
      db.prepare(
        'SELECT COUNT(*) as count FROM user_favorites WHERE entity_type = ? AND entity_id = ?'
      ).get(entityType, entityId)?.count || 0
    );
  },
};

export default Favorite;
