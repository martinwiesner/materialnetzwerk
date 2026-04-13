/**
 * Message Model
 * Database operations for user-to-user messages
 */

import { getDB } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

const Message = {
  /**
   * Find message by ID
   * @param {string} id
   * @returns {Object|undefined}
   */
  findById: (id) => {
    const db = getDB();
    return db.prepare(`
      SELECT m.*,
             s.email as sender_email, s.first_name as sender_first_name, s.last_name as sender_last_name,
             r.email as receiver_email, r.first_name as receiver_first_name, r.last_name as receiver_last_name,
             i.quantity as inventory_quantity, mat.name as material_name
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      LEFT JOIN inventory i ON m.inventory_id = i.id
      LEFT JOIN materials mat ON i.material_id = mat.id
      WHERE m.id = ?
    `).get(id);
  },

  /**
   * Find messages for a user (inbox)
   * @param {string} userId
   * @param {Object} filters
   * @returns {Array}
   */
  findInbox: (userId, filters = {}) => {
    const db = getDB();
    let query = `
      SELECT m.*,
             s.email as sender_email, s.first_name as sender_first_name, s.last_name as sender_last_name,
             i.quantity as inventory_quantity, mat.name as material_name
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      LEFT JOIN inventory i ON m.inventory_id = i.id
      LEFT JOIN materials mat ON i.material_id = mat.id
      WHERE m.receiver_id = ?
    `;
    const params = [userId];

    if (filters.unread_only) {
      query += ' AND m.is_read = 0';
    }

    query += ' ORDER BY m.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  },

  /**
   * Find messages sent by user
   * @param {string} userId
   * @returns {Array}
   */
  findSent: (userId) => {
    const db = getDB();
    return db.prepare(`
      SELECT m.*,
             r.email as receiver_email, r.first_name as receiver_first_name, r.last_name as receiver_last_name,
             i.quantity as inventory_quantity, mat.name as material_name
      FROM messages m
      JOIN users r ON m.receiver_id = r.id
      LEFT JOIN inventory i ON m.inventory_id = i.id
      LEFT JOIN materials mat ON i.material_id = mat.id
      WHERE m.sender_id = ?
      ORDER BY m.created_at DESC
    `).all(userId);
  },

  /**
   * Get unread message count for user
   * @param {string} userId
   * @returns {number}
   */
  getUnreadCount: (userId) => {
    const db = getDB();
    const result = db.prepare('SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0').get(userId);
    return result.count;
  },

  /**
   * Create new message
   * @param {Object} messageData
   * @returns {Object}
   */
  create: (messageData) => {
    const db = getDB();
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO messages (id, sender_id, receiver_id, inventory_id, subject, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      messageData.sender_id,
      messageData.receiver_id,
      messageData.inventory_id || null,
      messageData.subject || null,
      messageData.content
    );
    
    return Message.findById(id);
  },

  /**
   * Mark message as read
   * @param {string} id
   * @returns {Object}
   */
  markAsRead: (id) => {
    const db = getDB();
    db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(id);
    return Message.findById(id);
  },

  /**
   * Mark all messages as read for user
   * @param {string} userId
   * @returns {number} Number of messages updated
   */
  markAllAsRead: (userId) => {
    const db = getDB();
    const result = db.prepare('UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND is_read = 0').run(userId);
    return result.changes;
  },

  /**
   * Get conversation between two users
   * @param {string} userId1
   * @param {string} userId2
   * @returns {Array}
   */
  findConversation: (userId1, userId2) => {
    const db = getDB();
    return db.prepare(`
      SELECT m.*,
             s.email as sender_email, s.first_name as sender_first_name, s.last_name as sender_last_name,
             r.email as receiver_email, r.first_name as receiver_first_name, r.last_name as receiver_last_name,
             i.quantity as inventory_quantity, mat.name as material_name
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      LEFT JOIN inventory i ON m.inventory_id = i.id
      LEFT JOIN materials mat ON i.material_id = mat.id
      WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at ASC
    `).all(userId1, userId2, userId2, userId1);
  },

  /**
   * Delete message
   * @param {string} id
   * @returns {boolean}
   */
  delete: (id) => {
    const db = getDB();
    const result = db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

export default Message;
