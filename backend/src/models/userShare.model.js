import { getDB } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

const UserShare = {
  create(entityType, entityId, ownerId, sharedWithUserId, accessLevel = 'view') {
    const db = getDB();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO user_shares (id, entity_type, entity_id, owner_id, shared_with_user_id, access_level)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity_type, entity_id, shared_with_user_id)
      DO UPDATE SET access_level = excluded.access_level
    `).run(id, entityType, entityId, ownerId, sharedWithUserId, accessLevel);
    return db.prepare(`SELECT * FROM user_shares WHERE entity_type=? AND entity_id=? AND shared_with_user_id=?`)
      .get(entityType, entityId, sharedWithUserId);
  },

  delete(entityType, entityId, sharedWithUserId) {
    const db = getDB();
    return db.prepare(
      `DELETE FROM user_shares WHERE entity_type=? AND entity_id=? AND shared_with_user_id=?`
    ).run(entityType, entityId, sharedWithUserId).changes > 0;
  },

  findByEntity(entityType, entityId) {
    const db = getDB();
    return db.prepare(`
      SELECT us.*, u.email, u.first_name, u.last_name
      FROM user_shares us
      JOIN users u ON us.shared_with_user_id = u.id
      WHERE us.entity_type=? AND us.entity_id=?
      ORDER BY us.created_at ASC
    `).all(entityType, entityId);
  },

  findByUser(userId) {
    const db = getDB();
    return db.prepare(
      `SELECT * FROM user_shares WHERE shared_with_user_id=? ORDER BY created_at DESC`
    ).all(userId);
  },
};

export default UserShare;
