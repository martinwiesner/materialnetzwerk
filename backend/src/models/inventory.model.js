import { getDB } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

// Normalise multer file.path → web-accessible /uploads/... path
// Works with both relative (./uploads/...) and absolute (/home/.../uploads/...) paths
function normPath(p = '') {
  if (!p) return '';
  const fwd = p.replace(/\\/g, '/');
  const idx = fwd.indexOf('/uploads/');
  if (idx !== -1) return fwd.slice(idx);
  const clean = fwd.replace(/^\.?\//, '');
  return clean.startsWith('/') ? clean : '/' + clean;
}

const NEW_FIELDS = [
  'min_order_quantity','available_from_date','is_immediately_available',
  'is_regularly_available','regular_availability_period','regular_availability_type',
  'is_mobile','contact_user_id',
  'value_type','price','price_unit','is_negotiable',
  'transaction_options','logistics_options','transport_costs','condition',
];

const Inventory = {
  findById: (id) => {
    const db = getDB();
    const row = db.prepare(`
      SELECT i.*, m.name as material_name, m.category, m.gwp_value
      FROM inventory i
      JOIN materials m ON i.material_id = m.id
      WHERE i.id = ?
    `).get(id);
    if (!row) return undefined;
    row.images = db.prepare('SELECT * FROM inventory_images WHERE inventory_id = ? ORDER BY sort_order ASC').all(id);
    row.files  = db.prepare('SELECT * FROM inventory_files  WHERE inventory_id = ? ORDER BY created_at ASC').all(id);
    return row;
  },

  findByUser: (userId, filters = {}) => {
    const db = getDB();
    let query = `
      SELECT i.*, m.name as material_name, m.category, m.gwp_value, m.unit as material_unit
      FROM inventory i
      JOIN materials m ON i.material_id = m.id
      WHERE i.user_id = ?
    `;
    const params = [userId];
    if (filters.material_id) { query += ' AND i.material_id = ?'; params.push(filters.material_id); }
    if (filters.is_available !== undefined) { query += ' AND i.is_available = ?'; params.push(filters.is_available ? 1 : 0); }
    if (filters.available_for_transfer !== undefined) { query += ' AND i.available_for_transfer = ?'; params.push(filters.available_for_transfer ? 1 : 0); }
    if (filters.available_for_gift !== undefined) { query += ' AND i.available_for_gift = ?'; params.push(filters.available_for_gift ? 1 : 0); }
    query += ' ORDER BY i.created_at DESC';
    const rows = db.prepare(query).all(...params);
    return rows.map(r => ({
      ...r,
      images: db.prepare('SELECT * FROM inventory_images WHERE inventory_id = ? ORDER BY sort_order ASC').all(r.id),
    }));
  },

  findAvailable: (excludeUserId, filters = {}) => {
    const db = getDB();
    let query = `
      SELECT i.*, m.name as material_name, m.category, m.gwp_value,
             u.id as owner_id, u.email as owner_email, u.first_name as owner_first_name, u.last_name as owner_last_name
      FROM inventory i
      JOIN materials m ON i.material_id = m.id
      JOIN users u ON i.user_id = u.id
      WHERE i.user_id != ? AND i.is_available = 1 AND i.quantity > 0
    `;
    const params = [excludeUserId];
    if (filters.transfer_only) { query += ' AND i.available_for_transfer = 1'; }
    if (filters.gift_only) { query += ' AND i.available_for_gift = 1'; }
    if (filters.category) { query += ' AND m.category = ?'; params.push(filters.category); }
    if (filters.search) {
      query += ' AND (m.name LIKE ? OR m.description LIKE ? OR i.location_name LIKE ? OR i.address LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }
    query += ' ORDER BY i.created_at DESC';
    const rows = db.prepare(query).all(...params);
    return rows.map(r => ({
      ...r,
      images: db.prepare('SELECT * FROM inventory_images WHERE inventory_id = ? ORDER BY sort_order ASC').all(r.id),
    }));
  },

  create: (data) => {
    const db = getDB();
    const id = uuidv4();
    const boolFields = ['is_available','available_for_transfer','available_for_gift','swap_possible',
      'is_immediately_available','is_regularly_available','is_mobile','is_negotiable'];
    const cols = [
      'id','user_id','material_id','quantity','unit',
      'location_name','latitude','longitude','address',
      'is_available','availability_mode','external_url','season_from','season_to',
      'swap_possible','swap_against','available_for_transfer','available_for_gift','notes',
      ...NEW_FIELDS,
    ];
    const vals = [
      id, data.user_id, data.material_id,
      data.quantity || 0, data.unit || null,
      data.location_name || null, data.latitude || null, data.longitude || null, data.address || null,
      data.is_available !== undefined ? (data.is_available ? 1 : 0) : 1,
      data.availability_mode || 'negotiable',
      data.external_url || null, data.season_from || null, data.season_to || null,
      data.swap_possible ? 1 : 0, data.swap_against || null,
      data.available_for_transfer ? 1 : 0, data.available_for_gift ? 1 : 0,
      data.notes || null,
      // new fields
      data.min_order_quantity ?? null,
      data.available_from_date || null,
      data.is_immediately_available !== undefined ? (data.is_immediately_available ? 1 : 0) : 1,
      data.is_regularly_available ? 1 : 0,
      data.regular_availability_period || null,
      data.regular_availability_type || null,
      data.is_mobile ? 1 : 0,
      data.contact_user_id || null,
      data.value_type || null,
      data.price ?? null,
      data.price_unit || null,
      data.is_negotiable ? 1 : 0,
      data.transaction_options ? JSON.stringify(data.transaction_options) : null,
      data.logistics_options ? JSON.stringify(data.logistics_options) : null,
      data.transport_costs || null,
      data.condition || null,
    ];
    const placeholders = cols.map(() => '?').join(', ');
    db.prepare(`INSERT INTO inventory (${cols.join(', ')}) VALUES (${placeholders})`).run(...vals);
    return Inventory.findById(id);
  },

  update: (id, updates) => {
    const db = getDB();
    const allowedFields = [
      'quantity','unit','location_name','latitude','longitude','address',
      'is_available','availability_mode','external_url','season_from','season_to',
      'swap_possible','swap_against','available_for_transfer','available_for_gift','notes',
      ...NEW_FIELDS,
    ];
    const boolFields = new Set(['is_available','available_for_transfer','available_for_gift','swap_possible',
      'is_immediately_available','is_regularly_available','is_mobile','is_negotiable']);
    const jsonFields = new Set(['transaction_options','logistics_options']);
    const fields = [], values = [];
    for (const f of allowedFields) {
      if (updates[f] === undefined) continue;
      fields.push(`${f} = ?`);
      if (boolFields.has(f)) values.push(updates[f] ? 1 : 0);
      else if (jsonFields.has(f)) values.push(updates[f] ? JSON.stringify(updates[f]) : null);
      else values.push(updates[f]);
    }
    if (fields.length === 0) return Inventory.findById(id);
    values.push(id);
    db.prepare(`UPDATE inventory SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return Inventory.findById(id);
  },

  delete: (id) => {
    const db = getDB();
    return db.prepare('DELETE FROM inventory WHERE id = ?').run(id).changes > 0;
  },

  // Images
  addImage: (inventoryId, imageData, sortOrder = 0, stepIndex = null, stepCaption = null) => {
    const db = getDB();
    const id = uuidv4();
    db.prepare(`INSERT INTO inventory_images
      (id, inventory_id, filename, original_name, mime_type, file_size, file_path, sort_order, step_index, step_caption)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, inventoryId, imageData.filename, imageData.originalname, imageData.mimetype, imageData.size, normPath(imageData.path), sortOrder, stepIndex, stepCaption);
    return db.prepare('SELECT * FROM inventory_images WHERE id = ?').get(id);
  },

  getImages: (inventoryId) => {
    const db = getDB();
    return db.prepare('SELECT * FROM inventory_images WHERE inventory_id = ? ORDER BY sort_order ASC').all(inventoryId);
  },

  deleteImage: (imageId) => {
    const db = getDB();
    return db.prepare('DELETE FROM inventory_images WHERE id = ?').run(imageId).changes > 0;
  },

  // Files
  addFile: (inventoryId, fileData, label = null) => {
    const db = getDB();
    const id = uuidv4();
    db.prepare(`INSERT INTO inventory_files
      (id, inventory_id, filename, original_name, mime_type, file_size, file_path, file_label)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, inventoryId, fileData.filename, fileData.originalname, fileData.mimetype, fileData.size, normPath(fileData.path), label);
    return db.prepare('SELECT * FROM inventory_files WHERE id = ?').get(id);
  },

  getFiles: (inventoryId) => {
    const db = getDB();
    return db.prepare('SELECT * FROM inventory_files WHERE inventory_id = ? ORDER BY created_at ASC').all(inventoryId);
  },

  deleteFile: (fileId) => {
    const db = getDB();
    return db.prepare('DELETE FROM inventory_files WHERE id = ?').run(fileId).changes > 0;
  },

  adjustQuantity: (id, adjustment) => {
    const db = getDB();
    db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE id = ?').run(adjustment, id);
    return Inventory.findById(id);
  },

  transfer: (inventoryId, toUserId, quantity, transferType = 'transfer') => {
    const db = getDB();
    const inventory = db.prepare('SELECT * FROM inventory WHERE id = ?').get(inventoryId);
    if (!inventory || inventory.quantity < quantity) throw new Error('Insufficient inventory');
    const transferId = uuidv4();
    db.prepare(`INSERT INTO material_transfers (id, from_user_id, to_user_id, material_id, inventory_id, quantity, transfer_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`)
      .run(transferId, inventory.user_id, toUserId, inventory.material_id, inventoryId, quantity, transferType);
    return db.prepare('SELECT * FROM material_transfers WHERE id = ?').get(transferId);
  },

  completeTransfer: (transferId) => {
    const db = getDB();
    const transfer = db.prepare('SELECT * FROM material_transfers WHERE id = ?').get(transferId);
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.status !== 'pending') throw new Error('Transfer already processed');
    db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE id = ?').run(transfer.quantity, transfer.inventory_id);
    let targetInventory = db.prepare('SELECT * FROM inventory WHERE user_id = ? AND material_id = ?').get(transfer.to_user_id, transfer.material_id);
    if (targetInventory) {
      db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE id = ?').run(transfer.quantity, targetInventory.id);
    } else {
      const newId = uuidv4();
      db.prepare('INSERT INTO inventory (id, user_id, material_id, quantity, is_available) VALUES (?, ?, ?, ?, 1)').run(newId, transfer.to_user_id, transfer.material_id, transfer.quantity);
    }
    db.prepare('UPDATE material_transfers SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?').run('completed', transferId);
    return db.prepare('SELECT * FROM material_transfers WHERE id = ?').get(transferId);
  },

  getTransfers: (userId, type = 'all') => {
    const db = getDB();
    let query = `SELECT mt.*, m.name as material_name,
      fu.email as from_email, fu.first_name as from_first_name,
      tu.email as to_email, tu.first_name as to_first_name
      FROM material_transfers mt
      JOIN materials m ON mt.material_id = m.id
      JOIN users fu ON mt.from_user_id = fu.id
      JOIN users tu ON mt.to_user_id = tu.id WHERE 1=1`;
    const params = [];
    if (type === 'incoming') { query += ' AND mt.to_user_id = ?'; params.push(userId); }
    else if (type === 'outgoing') { query += ' AND mt.from_user_id = ?'; params.push(userId); }
    else { query += ' AND (mt.from_user_id = ? OR mt.to_user_id = ?)'; params.push(userId, userId); }
    query += ' ORDER BY mt.created_at DESC';
    return db.prepare(query).all(...params);
  },
};

export default Inventory;
