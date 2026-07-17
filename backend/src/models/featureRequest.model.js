import { getDB } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

const FeatureRequest = {
  create: ({ user_id, name, email, title, description }) => {
    const db = getDB();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO feature_requests (id, user_id, name, email, title, description, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(id, user_id || null, name || null, email || null, title, description);
    return id;
  },

  markSent: (id, openproject_wp_id) => {
    const db = getDB();
    db.prepare(`UPDATE feature_requests SET status = 'sent', openproject_wp_id = ? WHERE id = ?`)
      .run(String(openproject_wp_id), id);
  },

  markFailed: (id, error_message) => {
    const db = getDB();
    db.prepare(`UPDATE feature_requests SET status = 'failed', error_message = ? WHERE id = ?`)
      .run(error_message?.slice(0, 500) || null, id);
  },
};

export default FeatureRequest;
