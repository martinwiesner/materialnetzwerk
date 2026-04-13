/**
 * User Relationship Model
 * Database operations for user_relationships table
 */

import { getDB } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

const UserRelationship = {
  /**
   * Find relationship by ID
   * @param {string} id
   * @returns {Object|undefined}
   */
  findById: (id) => {
    const db = getDB();
    return db.prepare(`
      SELECT ur.*,
             req.email as requester_email, req.first_name as requester_first_name, req.last_name as requester_last_name,
             rec.email as receiver_email, rec.first_name as receiver_first_name, rec.last_name as receiver_last_name
      FROM user_relationships ur
      JOIN users req ON ur.requester_id = req.id
      JOIN users rec ON ur.receiver_id = rec.id
      WHERE ur.id = ?
    `).get(id);
  },

  /**
   * Find relationships for a user
   * @param {string} userId
   * @param {Object} filters
   * @returns {Array}
   */
  findByUser: (userId, filters = {}) => {
    const db = getDB();
    let query = `
      SELECT ur.*,
             req.email as requester_email, req.first_name as requester_first_name, req.last_name as requester_last_name,
             rec.email as receiver_email, rec.first_name as receiver_first_name, rec.last_name as receiver_last_name
      FROM user_relationships ur
      JOIN users req ON ur.requester_id = req.id
      JOIN users rec ON ur.receiver_id = rec.id
      WHERE (ur.requester_id = ? OR ur.receiver_id = ?)
    `;
    const params = [userId, userId];

    if (filters.status) {
      query += ' AND ur.status = ?';
      params.push(filters.status);
    }
    if (filters.relationship_type) {
      query += ' AND ur.relationship_type = ?';
      params.push(filters.relationship_type);
    }

    query += ' ORDER BY ur.created_at DESC';

    return db.prepare(query).all(...params);
  },

  /**
   * Find pending requests for a user (where they are the receiver)
   * @param {string} userId
   * @returns {Array}
   */
  findPendingRequests: (userId) => {
    const db = getDB();
    return db.prepare(`
      SELECT ur.*,
             req.email as requester_email, req.first_name as requester_first_name, req.last_name as requester_last_name
      FROM user_relationships ur
      JOIN users req ON ur.requester_id = req.id
      WHERE ur.receiver_id = ? AND ur.status = 'pending'
      ORDER BY ur.created_at DESC
    `).all(userId);
  },

  /**
   * Check if relationship exists between two users
   * @param {string} userId1
   * @param {string} userId2
   * @returns {Object|undefined}
   */
  findBetweenUsers: (userId1, userId2) => {
    const db = getDB();
    return db.prepare(`
      SELECT * FROM user_relationships
      WHERE (requester_id = ? AND receiver_id = ?)
         OR (requester_id = ? AND receiver_id = ?)
    `).get(userId1, userId2, userId2, userId1);
  },

  /**
   * Check if users have an accepted relationship
   * @param {string} userId1
   * @param {string} userId2
   * @returns {boolean}
   */
  hasRelationship: (userId1, userId2) => {
    const relationship = UserRelationship.findBetweenUsers(userId1, userId2);
    return relationship && relationship.status === 'accepted';
  },

  /**
   * Create relationship request
   * @param {Object} data
   * @returns {Object}
   */
  create: (data) => {
    const db = getDB();
    const id = uuidv4();
    
    // Check if relationship already exists
    const existing = UserRelationship.findBetweenUsers(data.requester_id, data.receiver_id);
    if (existing) {
      throw new Error('Relationship already exists between these users');
    }
    
    const stmt = db.prepare(`
      INSERT INTO user_relationships (id, requester_id, receiver_id, status, relationship_type)
      VALUES (?, ?, ?, 'pending', ?)
    `);
    
    stmt.run(
      id,
      data.requester_id,
      data.receiver_id,
      data.relationship_type || 'sharing'
    );
    
    return UserRelationship.findById(id);
  },

  /**
   * Update relationship status
   * @param {string} id
   * @param {string} status - 'accepted' or 'rejected'
   * @returns {Object}
   */
  updateStatus: (id, status) => {
    const db = getDB();
    if (!['accepted', 'rejected'].includes(status)) {
      throw new Error('Invalid status');
    }
    
    db.prepare('UPDATE user_relationships SET status = ? WHERE id = ?').run(status, id);
    return UserRelationship.findById(id);
  },

  /**
   * Delete relationship
   * @param {string} id
   * @returns {boolean}
   */
  delete: (id) => {
    const db = getDB();
    const result = db.prepare('DELETE FROM user_relationships WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Get accepted relationships (contacts) for a user
   * @param {string} userId
   * @returns {Array}
   */
  getContacts: (userId) => {
    const db = getDB();
    return db.prepare(`
      SELECT 
        ur.id as relationship_id,
        CASE 
          WHEN ur.requester_id = ? THEN rec.id 
          ELSE req.id 
        END as contact_id,
        CASE 
          WHEN ur.requester_id = ? THEN rec.email 
          ELSE req.email 
        END as contact_email,
        CASE 
          WHEN ur.requester_id = ? THEN rec.first_name 
          ELSE req.first_name 
        END as contact_first_name,
        CASE 
          WHEN ur.requester_id = ? THEN rec.last_name 
          ELSE req.last_name 
        END as contact_last_name,
        ur.relationship_type,
        ur.created_at
      FROM user_relationships ur
      JOIN users req ON ur.requester_id = req.id
      JOIN users rec ON ur.receiver_id = rec.id
      WHERE (ur.requester_id = ? OR ur.receiver_id = ?) AND ur.status = 'accepted'
      ORDER BY ur.created_at DESC
    `).all(userId, userId, userId, userId, userId, userId);
  }
};

export default UserRelationship;
