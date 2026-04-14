import { getDB } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

const VALID_STATUSES = ['pending', 'accepted', 'declined', 'reserved', 'completed'];

const MaterialRequest = {
  create: ({ inventory_id, requester_id, quantity, unit, message }) => {
    const db = getDB();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO material_requests (id, inventory_id, requester_id, quantity, unit, message, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(id, inventory_id, requester_id, quantity ?? null, unit || null, message || null);
    return MaterialRequest.findById(id);
  },

  findById: (id) => {
    const db = getDB();
    return db.prepare(`
      SELECT r.*,
        u.first_name as requester_first_name, u.last_name as requester_last_name, u.email as requester_email,
        i.quantity as inventory_quantity, i.unit as inventory_unit,
        i.user_id as owner_id,
        m.name as material_name
      FROM material_requests r
      JOIN users u ON r.requester_id = u.id
      JOIN inventory i ON r.inventory_id = i.id
      JOIN materials m ON i.material_id = m.id
      WHERE r.id = ?
    `).get(id);
  },

  // All requests FOR a given inventory entry (for the owner)
  findByInventory: (inventory_id) => {
    const db = getDB();
    return db.prepare(`
      SELECT r.*,
        u.first_name as requester_first_name, u.last_name as requester_last_name, u.email as requester_email
      FROM material_requests r
      JOIN users u ON r.requester_id = u.id
      WHERE r.inventory_id = ?
      ORDER BY r.created_at DESC
    `).all(inventory_id);
  },

  // All requests made BY a given user
  findByRequester: (requester_id) => {
    const db = getDB();
    return db.prepare(`
      SELECT r.*,
        m.name as material_name,
        i.quantity as inventory_quantity, i.unit as inventory_unit,
        i.location_name,
        u2.first_name as owner_first_name, u2.last_name as owner_last_name, u2.email as owner_email
      FROM material_requests r
      JOIN inventory i ON r.inventory_id = i.id
      JOIN materials m ON i.material_id = m.id
      JOIN users u2 ON i.user_id = u2.id
      WHERE r.requester_id = ?
      ORDER BY r.created_at DESC
    `).all(requester_id);
  },

  // All pending requests for all offers owned by a user
  findPendingForOwner: (owner_id) => {
    const db = getDB();
    return db.prepare(`
      SELECT r.*,
        u.first_name as requester_first_name, u.last_name as requester_last_name, u.email as requester_email,
        m.name as material_name,
        i.quantity as inventory_quantity, i.unit as inventory_unit, i.location_name
      FROM material_requests r
      JOIN inventory i ON r.inventory_id = i.id
      JOIN materials m ON i.material_id = m.id
      JOIN users u ON r.requester_id = u.id
      WHERE i.user_id = ?
      ORDER BY r.created_at DESC
    `).all(owner_id);
  },

  updateStatus: (id, status, owner_note) => {
    if (!VALID_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`);
    const db = getDB();

    const current = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(id);
    if (!current) throw new Error('Request not found');

    db.prepare(`
      UPDATE material_requests
      SET status = ?, owner_note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, owner_note || null, id);

    // Adjust inventory.quantity when a request is completed or un-completed
    if (current.quantity) {
      if (status === 'completed' && current.status !== 'completed') {
        // Deduct picked-up quantity; never go below 0
        db.prepare(`
          UPDATE inventory SET quantity = MAX(0, quantity - ?) WHERE id = ?
        `).run(current.quantity, current.inventory_id);
      } else if (current.status === 'completed' && status !== 'completed') {
        // Restore quantity if completion is reversed
        db.prepare(`
          UPDATE inventory SET quantity = quantity + ? WHERE id = ?
        `).run(current.quantity, current.inventory_id);
      }
    }

    return MaterialRequest.findById(id);
  },

  delete: (id) => {
    const db = getDB();
    return db.prepare('DELETE FROM material_requests WHERE id = ?').run(id).changes > 0;
  },
};

export default MaterialRequest;
