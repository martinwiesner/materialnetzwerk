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

const Project = {
  findById: (id) => {
    const db = getDB();
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  },

  findByIdWithDetails: (id) => {
    const db = getDB();
    const project = db.prepare(`
      SELECT p.*, u.first_name as owner_first_name, u.last_name as owner_last_name, u.email as owner_email
      FROM projects p JOIN users u ON p.owner_id = u.id WHERE p.id = ?
    `).get(id);
    if (!project) return undefined;
    project.images = db.prepare('SELECT * FROM project_images WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC').all(id);
    project.files  = db.prepare('SELECT * FROM project_files  WHERE project_id = ? ORDER BY created_at ASC').all(id);
    project.materials = db.prepare(`
      SELECT pm.*, m.name as material_name, m.category, m.gwp_value, m.unit
      FROM project_materials pm JOIN materials m ON pm.material_id = m.id WHERE pm.project_id = ?
    `).all(id);
    project.total_gwp_value = (project.materials||[]).reduce((s,r)=>s+Number(r.quantity||0)*Number(r.gwp_value||0),0);
    project.total_gwp_unit = 'kg CO2e';
    project.actors = db.prepare(`
      SELECT a.id, a.name, a.type, a.location_name
      FROM project_actors pa JOIN actors a ON pa.actor_id = a.id
      WHERE pa.project_id = ?
      ORDER BY a.name ASC
    `).all(id);
    return project;
  },

  findByUser: (userId, filters = {}) => {
    const db = getDB();
    let query = `SELECT p.*,
      COALESCE((SELECT SUM(pm.quantity*m.gwp_value) FROM project_materials pm JOIN materials m ON pm.material_id=m.id WHERE pm.project_id=p.id),0) AS total_gwp_value,
      'kg CO2e' AS total_gwp_unit
      FROM projects p WHERE p.owner_id = ?`;
    const params = [userId];
    if (filters.status) { query += ' AND status = ?'; params.push(filters.status); }
    if (filters.is_available) { query += ' AND p.is_available = 1'; }
    if (filters.search) { query += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${filters.search}%`,`%${filters.search}%`); }
    query += ' ORDER BY p.created_at DESC';
    const rows = db.prepare(query).all(...params);
    const matQ = db.prepare('SELECT material_id FROM project_materials WHERE project_id = ?');
    return rows.map(r=>({...r, images: db.prepare('SELECT * FROM project_images WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC').all(r.id), materials: matQ.all(r.id)}));
  },

  findAll: (filters = {}) => {
    const db = getDB();
    let query = `SELECT p.*, u.first_name as owner_first_name, u.last_name as owner_last_name, u.email as owner_email,
      COALESCE((SELECT SUM(pm.quantity*m.gwp_value) FROM project_materials pm JOIN materials m ON pm.material_id=m.id WHERE pm.project_id=p.id),0) AS total_gwp_value,
      'kg CO2e' AS total_gwp_unit
      FROM projects p JOIN users u ON p.owner_id=u.id WHERE 1=1`;
    const params = [];
    if (filters.status) { query += ' AND p.status = ?'; params.push(filters.status); }
    if (filters.is_available) { query += ' AND p.is_available = 1'; }
    if (filters.search) { query += ' AND (p.name LIKE ? OR p.description LIKE ?)'; params.push(`%${filters.search}%`,`%${filters.search}%`); }
    query += ' ORDER BY p.created_at DESC';
    if (filters.limit) { query += ' LIMIT ?'; params.push(filters.limit); }
    const rows = db.prepare(query).all(...params);
    const matQ = db.prepare('SELECT material_id FROM project_materials WHERE project_id = ?');
    return rows.map(r=>({...r, images: db.prepare('SELECT * FROM project_images WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC').all(r.id), materials: matQ.all(r.id)}));
  },

  findPublic: (excludeUserId, filters = {}) => {
    const db = getDB();
    let query = `SELECT p.*, u.first_name as owner_first_name, u.last_name as owner_last_name, u.email as owner_email,
      COALESCE((SELECT SUM(pm.quantity*m.gwp_value) FROM project_materials pm JOIN materials m ON pm.material_id=m.id WHERE pm.project_id=p.id),0) AS total_gwp_value,
      'kg CO2e' AS total_gwp_unit
      FROM projects p JOIN users u ON p.owner_id=u.id WHERE p.is_public=1 AND p.owner_id != ?`;
    const params = [excludeUserId];
    if (filters.status) { query += ' AND p.status = ?'; params.push(filters.status); }
    if (filters.is_available) { query += ' AND p.is_available = 1'; }
    if (filters.search) { query += ' AND (p.name LIKE ? OR p.description LIKE ?)'; params.push(`%${filters.search}%`,`%${filters.search}%`); }
    query += ' ORDER BY p.created_at DESC';
    if (filters.limit) { query += ' LIMIT ?'; params.push(filters.limit); }
    const rows = db.prepare(query).all(...params);
    const matQ = db.prepare('SELECT material_id FROM project_materials WHERE project_id = ?');
    return rows.map(r=>({...r, images: db.prepare('SELECT * FROM project_images WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC').all(r.id), materials: matQ.all(r.id)}));
  },

  create: (data) => {
    const db = getDB();
    const id = uuidv4();
    db.prepare(`INSERT INTO projects (id, name, description, content,
      circular_principles, principles_sufficiency, principles_consistency, principles_efficiency, general_sustainability_principles,
      location_name, latitude, longitude, address,
      time_effort, tools, steps, references,
      status, is_public, is_available, owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.name, data.description||null, data.content||null,
        data.circular_principles||null, data.principles_sufficiency||null, data.principles_consistency||null, data.principles_efficiency||null, data.general_sustainability_principles||null,
        data.location_name||null, data.latitude??null, data.longitude??null, data.address||null,
        data.time_effort||null, data.tools||null,
        data.steps ? JSON.stringify(data.steps) : null,
        data.references ? JSON.stringify(data.references) : null,
        data.status||'draft', data.is_public?1:0, data.is_available?1:0, data.owner_id);
    return Project.findById(id);
  },

  update: (id, updates) => {
    const db = getDB();
    const allowed = [
      'name','description','content',
      'circular_principles','principles_sufficiency','principles_consistency','principles_efficiency','general_sustainability_principles',
      'location_name','latitude','longitude','address',
      'time_effort','tools','steps','references',
      'status','is_public','is_available',
    ];
    const jsonFields = new Set(['steps','references']);
    const boolFields = new Set(['is_public','is_available']);
    const fields = [], values = [];
    for (const f of allowed) {
      if (updates[f] === undefined) continue;
      fields.push(`${f} = ?`);
      if (boolFields.has(f)) values.push(updates[f]?1:0);
      else if (jsonFields.has(f)) values.push(updates[f] ? JSON.stringify(updates[f]) : null);
      else values.push(updates[f]);
    }
    if (fields.length === 0) return Project.findById(id);
    values.push(id);
    db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return Project.findById(id);
  },

  delete: (id) => {
    const db = getDB();
    return db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0;
  },

  // Images
  addImage: (projectId, imageData, sortOrder=0, stepIndex=null, stepCaption=null) => {
    const db = getDB();
    const id = uuidv4();
    db.prepare(`INSERT INTO project_images (id, project_id, filename, original_name, mime_type, file_size, file_path, sort_order, step_index, step_caption) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, projectId, imageData.filename, imageData.originalname, imageData.mimetype, imageData.size, normPath(imageData.path), sortOrder, stepIndex, stepCaption);
    return db.prepare('SELECT * FROM project_images WHERE id = ?').get(id);
  },

  getImages: (projectId) => {
    const db = getDB();
    return db.prepare('SELECT * FROM project_images WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC').all(projectId);
  },

  deleteImage: (imageId) => {
    const db = getDB();
    return db.prepare('DELETE FROM project_images WHERE id = ?').run(imageId).changes > 0;
  },

  /**
   * Set an image as the cover (sort_order = 0).
   * All other images of the same project get sort_order shifted up.
   */
  setCoverImage: (projectId, imageId) => {
    const db = getDB();
    // Bump all images to make room
    db.prepare('UPDATE project_images SET sort_order = sort_order + 1 WHERE project_id = ?').run(projectId);
    // Set the chosen image to 0
    db.prepare('UPDATE project_images SET sort_order = 0 WHERE id = ?').run(imageId);
  },

  /**
   * Update step metadata and/or credit on an image (partial update — only provided fields are changed).
   */
  updateImageMeta: (imageId, updates) => {
    const db = getDB();
    const allowed = ['step_index', 'step_caption', 'credit'];
    const fields = [], values = [];
    for (const f of allowed) {
      if (!(f in updates)) continue;
      fields.push(`${f} = ?`);
      values.push(updates[f] ?? null);
    }
    if (fields.length === 0) return;
    values.push(imageId);
    db.prepare(`UPDATE project_images SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  },

  // Files
  addFile: (projectId, fileData, label=null) => {
    const db = getDB();
    const id = uuidv4();
    db.prepare(`INSERT INTO project_files (id, project_id, filename, original_name, mime_type, file_size, file_path, file_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, projectId, fileData.filename, fileData.originalname, fileData.mimetype, fileData.size, normPath(fileData.path), label);
    return db.prepare('SELECT * FROM project_files WHERE id = ?').get(id);
  },

  getFiles: (projectId) => {
    const db = getDB();
    return db.prepare('SELECT * FROM project_files WHERE project_id = ? ORDER BY created_at ASC').all(projectId);
  },

  deleteFile: (fileId) => {
    const db = getDB();
    return db.prepare('DELETE FROM project_files WHERE id = ?').run(fileId).changes > 0;
  },

  addMaterial: (projectId, materialId, quantity=1, unit=null) => {
    const db = getDB();
    const id = uuidv4();
    db.prepare('INSERT OR REPLACE INTO project_materials (id, project_id, material_id, quantity, unit) VALUES (?, ?, ?, ?, ?)').run(id, projectId, materialId, quantity, unit);
    return db.prepare('SELECT * FROM project_materials WHERE id = ?').get(id);
  },

  removeMaterial: (projectId, materialId) => {
    const db = getDB();
    return db.prepare('DELETE FROM project_materials WHERE project_id = ? AND material_id = ?').run(projectId, materialId).changes > 0;
  },

  // Actor associations
  getActors: (projectId) => {
    const db = getDB();
    return db.prepare(`
      SELECT a.id, a.name, a.type, a.location_name
      FROM project_actors pa JOIN actors a ON pa.actor_id = a.id
      WHERE pa.project_id = ?
      ORDER BY a.name ASC
    `).all(projectId);
  },

  setActors: (projectId, actorIds) => {
    const db = getDB();
    db.prepare('DELETE FROM project_actors WHERE project_id = ?').run(projectId);
    const insert = db.prepare('INSERT OR IGNORE INTO project_actors (project_id, actor_id) VALUES (?, ?)');
    const tx = db.transaction((ids) => { for (const aid of ids) insert.run(projectId, aid); });
    tx(actorIds || []);
  },
};

export default Project;
