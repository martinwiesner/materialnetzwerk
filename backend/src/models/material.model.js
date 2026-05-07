import { getDB } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

// Normalise multer file.path → web-accessible /uploads/... path
// Works with both relative (./uploads/...) and absolute (/home/.../uploads/...) paths
function normPath(p = '') {
  if (!p) return '';
  const fwd = p.replace(/\\/g, '/');
  // Extract everything from /uploads/ onwards
  const idx = fwd.indexOf('/uploads/');
  if (idx !== -1) return fwd.slice(idx);
  // Fallback: strip leading ./ and ensure leading /
  const clean = fwd.replace(/^\.?\//, '');
  return clean.startsWith('/') ? clean : '/' + clean;
}

const NEW_FIELDS = [
  'tech_compressive_strength','tech_tensile_strength',
  'recycling_percentage','voc_values',
  'origin_source','previous_use',
  'use_indoor','use_outdoor','use_where','use_not_suitable',
  'cert_epd','cert_cradle_to_cradle','cert_fsc_pefc',
  'latitude','longitude','location_name','address',
];

const BOOL_FIELDS = new Set(['is_reusable','is_transferable','is_giftable','use_indoor','use_outdoor','cert_epd','cert_cradle_to_cradle','cert_fsc_pefc']);

const Material = {
  findById: (id) => {
    const db = getDB();
    const row = db.prepare(`
      SELECT m.*, u.first_name as owner_first_name, u.last_name as owner_last_name,
             u.email as owner_email, u.id as owner_id
      FROM materials m LEFT JOIN users u ON m.created_by = u.id
      WHERE m.id = ?
    `).get(id);
    if (!row) return undefined;
    row.images = db.prepare('SELECT * FROM material_images WHERE material_id = ? ORDER BY sort_order ASC').all(id);
    row.files  = db.prepare('SELECT * FROM material_files  WHERE material_id = ? ORDER BY created_at ASC').all(id);
    return row;
  },

  findAll: (filters = {}) => {
    const db = getDB();
    let query = `SELECT m.*, u.first_name as owner_first_name, u.last_name as owner_last_name,
                        u.email as owner_email, u.id as owner_id
                 FROM materials m LEFT JOIN users u ON m.created_by = u.id WHERE 1=1`;
    const params = [];
    if (filters.category) { query += ' AND m.category = ?'; params.push(filters.category); }
    if (filters.created_by) { query += ' AND m.created_by = ?'; params.push(filters.created_by); }
    if (filters.is_reusable !== undefined) { query += ' AND m.is_reusable = ?'; params.push(filters.is_reusable ? 1 : 0); }
    if (filters.search) { query += ' AND (m.name LIKE ? OR m.description LIKE ?)'; params.push(`%${filters.search}%`, `%${filters.search}%`); }
    query += ' ORDER BY m.created_at DESC';
    if (filters.limit) { query += ' LIMIT ?'; params.push(filters.limit); }
    if (filters.offset) { query += ' OFFSET ?'; params.push(filters.offset); }
    const rows = db.prepare(query).all(...params);
    return rows.map(r => ({
      ...r,
      images: db.prepare('SELECT * FROM material_images WHERE material_id = ? ORDER BY sort_order ASC').all(r.id),
    }));
  },

  create: (data) => {
    const db = getDB();
    const id = uuidv4();
    const cols = [
      'id','name','category','description','short_description',
      'origin_acquisition','use_processing','use_indoor_outdoor','use_limitations','similar_material_ids',
      'tech_thicknesses','tech_dimensions','tech_density','tech_flammability','tech_acoustics','tech_thermal_insulation',
      'sust_climate_description','gwp_total_value','gwp_total_unit','recyclate_content','circularity','human_health','processing_sustainability',
      'principles_sufficiency','principles_consistency','principles_efficiency',
      'env_links','appendix','unit',
      'gwp_value','gwp_unit','gwp_source',
      'is_reusable','is_transferable','is_giftable','created_by',
      ...NEW_FIELDS,
    ];
    const vals = [
      id, data.name,
      data.category||null, data.description||null, data.short_description||null,
      data.origin_acquisition||null, data.use_processing||null, data.use_indoor_outdoor||null, data.use_limitations||null, data.similar_material_ids||null,
      data.tech_thicknesses||null, data.tech_dimensions||null, data.tech_density||null, data.tech_flammability||null, data.tech_acoustics||null, data.tech_thermal_insulation||null,
      data.sust_climate_description||null, data.gwp_total_value??null, data.gwp_total_unit||null, data.recyclate_content??null,
      data.circularity||null, data.human_health||null, data.processing_sustainability||null,
      data.principles_sufficiency||null, data.principles_consistency||null, data.principles_efficiency||null,
      data.env_links||null, data.appendix||null, data.unit||'kg',
      data.gwp_value||0, data.gwp_unit||'kg CO2e', data.gwp_source||null,
      data.is_reusable?1:0, data.is_transferable?1:0, data.is_giftable?1:0, data.created_by,
      // new fields
      data.tech_compressive_strength||null, data.tech_tensile_strength||null,
      data.recycling_percentage??null, data.voc_values||null,
      data.origin_source||null, data.previous_use||null,
      data.use_indoor!==undefined?(data.use_indoor?1:0):1,
      data.use_outdoor?1:0,
      data.use_where||null, data.use_not_suitable||null,
      data.cert_epd?1:0, data.cert_cradle_to_cradle?1:0, data.cert_fsc_pefc?1:0,
      data.latitude??null, data.longitude??null, data.location_name||null, data.address||null,
    ];
    const ph = cols.map(()=>'?').join(', ');
    db.prepare(`INSERT INTO materials (${cols.join(', ')}) VALUES (${ph})`).run(...vals);
    return Material.findById(id);
  },

  update: (id, updates) => {
    const db = getDB();
    const allowed = [
      'name','category','description','short_description',
      'origin_acquisition','use_processing','use_indoor_outdoor','use_limitations','similar_material_ids',
      'tech_thicknesses','tech_dimensions','tech_density','tech_flammability','tech_acoustics','tech_thermal_insulation',
      'sust_climate_description','gwp_total_value','gwp_total_unit','recyclate_content','circularity','human_health','processing_sustainability',
      'principles_sufficiency','principles_consistency','principles_efficiency',
      'env_links','appendix','unit','gwp_value','gwp_unit','gwp_source',
      'is_reusable','is_transferable','is_giftable',
      ...NEW_FIELDS,
    ];
    const fields = [], values = [];
    for (const f of allowed) {
      if (updates[f] === undefined) continue;
      fields.push(`${f} = ?`);
      const raw = updates[f];
      values.push(BOOL_FIELDS.has(f) ? (raw?1:0) : (raw === '' ? null : raw));
    }
    if (fields.length === 0) return Material.findById(id);
    values.push(id);
    db.prepare(`UPDATE materials SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return Material.findById(id);
  },

  delete: (id) => {
    const db = getDB();
    return db.prepare('DELETE FROM materials WHERE id = ?').run(id).changes > 0;
  },

  getCategories: () => {
    const db = getDB();
    return db.prepare('SELECT DISTINCT category FROM materials WHERE category IS NOT NULL').all().map(r=>r.category);
  },

  count: (filters = {}) => {
    const db = getDB();
    let q = 'SELECT COUNT(*) as count FROM materials WHERE 1=1';
    const p = [];
    if (filters.category) { q += ' AND category = ?'; p.push(filters.category); }
    if (filters.created_by) { q += ' AND created_by = ?'; p.push(filters.created_by); }
    return db.prepare(q).get(...p).count;
  },

  // Images
  addImage: (materialId, imageData, sortOrder=0, stepIndex=null, stepCaption=null) => {
    const db = getDB();
    const id = uuidv4();
    db.prepare(`INSERT INTO material_images (id, material_id, filename, original_name, mime_type, file_size, file_path, sort_order, step_index, step_caption) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, materialId, imageData.filename, imageData.originalname, imageData.mimetype, imageData.size, normPath(imageData.path), sortOrder, stepIndex, stepCaption);
    return db.prepare('SELECT * FROM material_images WHERE id = ?').get(id);
  },

  getImages: (materialId) => {
    const db = getDB();
    return db.prepare('SELECT * FROM material_images WHERE material_id = ? ORDER BY sort_order ASC').all(materialId);
  },

  deleteImage: (imageId) => {
    const db = getDB();
    return db.prepare('DELETE FROM material_images WHERE id = ?').run(imageId).changes > 0;
  },

  // Files
  addFile: (materialId, fileData, label=null) => {
    const db = getDB();
    const id = uuidv4();
    db.prepare(`INSERT INTO material_files (id, material_id, filename, original_name, mime_type, file_size, file_path, file_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, materialId, fileData.filename, fileData.originalname, fileData.mimetype, fileData.size, normPath(fileData.path), label);
    return db.prepare('SELECT * FROM material_files WHERE id = ?').get(id);
  },

  getFiles: (materialId) => {
    const db = getDB();
    return db.prepare('SELECT * FROM material_files WHERE material_id = ? ORDER BY created_at ASC').all(materialId);
  },

  deleteFile: (fileId) => {
    const db = getDB();
    return db.prepare('DELETE FROM material_files WHERE id = ?').run(fileId).changes > 0;
  },

  // Actor associations
  getActors: (materialId) => {
    const db = getDB();
    return db.prepare(`
      SELECT a.id, a.name, a.type, a.location_name
      FROM material_actors ma JOIN actors a ON ma.actor_id = a.id
      WHERE ma.material_id = ?
      ORDER BY a.name ASC
    `).all(materialId);
  },

  setActors: (materialId, actorIds) => {
    const db = getDB();
    db.prepare('DELETE FROM material_actors WHERE material_id = ?').run(materialId);
    const insert = db.prepare('INSERT OR IGNORE INTO material_actors (material_id, actor_id) VALUES (?, ?)');
    const tx = db.transaction((ids) => { for (const aid of ids) insert.run(materialId, aid); });
    tx(actorIds || []);
  },
};

export default Material;
