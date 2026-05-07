/**
 * Material Category Model
 * Operations for predefined material categories
 */

import { getDB } from '../config/db.js';

const MaterialCategory = {
  /**
   * Get all category names
   * @returns {Array<string>}
   */
  getAll: () => {
    const db = getDB();
    const rows = db.prepare('SELECT name FROM material_categories ORDER BY name ASC').all();
    return rows.map(r => r.name);
  },

  /**
   * Check if a category exists
   * @param {string} name
   * @returns {boolean}
   */
  exists: (name) => {
    if (!name) return false;
    const db = getDB();
    const row = db.prepare('SELECT 1 as ok FROM material_categories WHERE name = ?').get(name);
    return Boolean(row);
  }
};

export default MaterialCategory;
