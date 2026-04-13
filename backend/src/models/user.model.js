/**
 * User Model
 * Database operations for users table
 */

import { getDB } from '../config/db.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} email
 * @property {string} password
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} created_at
 * @property {string} updated_at
 */

const User = {
  /**
   * Find user by ID
   * @param {string} id
   * @returns {User|undefined}
   */
  findById: (id) => {
    const db = getDB();
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  /**
   * Find user by email
   * @param {string} email
   * @returns {User|undefined}
   */
  findByEmail: (email) => {
    const db = getDB();
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  /**
   * Search users by partial email or name
   * @param {string} query
   * @returns {Array}
   */
  search: (query) => {
    const db = getDB();
    const searchTerm = `%${query}%`;
    return db.prepare(`
      SELECT id, email, first_name, last_name 
      FROM users 
      WHERE email LIKE ? OR first_name LIKE ? OR last_name LIKE ?
      LIMIT 10
    `).all(searchTerm, searchTerm, searchTerm);
  },

  /**
   * Find user by ID without password
   * @param {string} id
   * @returns {Object|undefined}
   */
  findByIdSecure: (id) => {
    const db = getDB();
    return db.prepare(`
      SELECT id, email, first_name, last_name, is_admin, created_at, updated_at
      FROM users WHERE id = ?
    `).get(id);
  },

  /**
   * Create new user
   * @param {Object} userData
   * @returns {User}
   */
  create: async (userData) => {
    const db = getDB();
    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const stmt = db.prepare(`
      INSERT INTO users (id, email, password, first_name, last_name)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, userData.email, hashedPassword, userData.first_name || null, userData.last_name || null);
    
    return User.findById(id);
  },

  /**
   * Update user
   * @param {string} id
   * @param {Object} updates
   * @returns {User}
   */
  update: (id, updates) => {
    const db = getDB();
    const fields = [];
    const values = [];
    
    if (updates.email) {
      fields.push('email = ?');
      values.push(updates.email);
    }
    if (updates.first_name !== undefined) {
      fields.push('first_name = ?');
      values.push(updates.first_name);
    }
    if (updates.last_name !== undefined) {
      fields.push('last_name = ?');
      values.push(updates.last_name);
    }
    
    if (fields.length === 0) return User.findById(id);
    
    values.push(id);
    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    
    return User.findById(id);
  },

  /**
   * Delete user
   * @param {string} id
   * @returns {boolean}
   */
  delete: (id) => {
    const db = getDB();
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Verify password
   * @param {string} inputPassword
   * @param {string} hashedPassword
   * @returns {Promise<boolean>}
   */
  matchPassword: async (inputPassword, hashedPassword) => {
    return bcrypt.compare(inputPassword, hashedPassword);
  },

  /**
   * Get all users (without passwords)
   * @returns {Array}
   */
  findAll: () => {
    const db = getDB();
    return db.prepare(`
      SELECT id, email, first_name, last_name, is_admin, created_at, updated_at
      FROM users
    `).all();
  }
};

export default User;
