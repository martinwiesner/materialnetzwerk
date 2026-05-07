/**
 * User Model
 * Database operations for users table
 */

import { getDB } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} zitadel_sub
 * @property {string} email
 * @property {string} first_name
 * @property {string} last_name
 * @property {boolean} is_admin
 * @property {string} created_at
 * @property {string} updated_at
 */

const SECURE_FIELDS = 'id, zitadel_sub, email, first_name, last_name, is_admin, created_at, updated_at';

const User = {
  /**
   * Find user by internal ID
   * @param {string} id
   * @returns {User|undefined}
   */
  findById: (id) => {
    const db = getDB();
    return db.prepare(`SELECT ${SECURE_FIELDS} FROM users WHERE id = ?`).get(id);
  },

  /**
   * Find user by email
   * @param {string} email
   * @returns {User|undefined}
   */
  findByEmail: (email) => {
    const db = getDB();
    return db.prepare(`SELECT ${SECURE_FIELDS} FROM users WHERE email = ?`).get(email);
  },

  /**
   * Find user by Zitadel subject claim
   * @param {string} sub
   * @returns {User|undefined}
   */
  findByZitadelSub: (sub) => {
    const db = getDB();
    return db.prepare(`SELECT ${SECURE_FIELDS} FROM users WHERE zitadel_sub = ?`).get(sub);
  },

  /**
   * Look up a user by Zitadel sub claim, creating one if not found.
   * Called on every authenticated request from the middleware.
   * @param {Object} claims - Verified JWT payload from Zitadel
   * @returns {User}
   */
  findOrCreateBySub: (claims) => {
    const db = getDB();
    const { sub, email, given_name, family_name } = claims;

    let user = db.prepare(`SELECT ${SECURE_FIELDS} FROM users WHERE zitadel_sub = ?`).get(sub);
    if (user) return user;

    // First login: create a local profile from Zitadel claims
    const id = uuidv4();
    db.prepare(`
      INSERT INTO users (id, zitadel_sub, email, first_name, last_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, sub, email ?? null, given_name ?? null, family_name ?? null);

    return db.prepare(`SELECT ${SECURE_FIELDS} FROM users WHERE id = ?`).get(id);
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
   * Find user by ID (alias kept for compatibility)
   * @param {string} id
   * @returns {User|undefined}
   */
  findByIdSecure: (id) => {
    const db = getDB();
    return db.prepare(`SELECT ${SECURE_FIELDS} FROM users WHERE id = ?`).get(id);
  },

  /**
   * Update user profile fields
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
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

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
   * Get all users
   * @returns {Array}
   */
  findAll: () => {
    const db = getDB();
    return db.prepare(`SELECT ${SECURE_FIELDS} FROM users`).all();
  },
};

export default User;
