/**
 * Database Migration Script
 * Adds new columns to existing tables without breaking existing data.
 * Safe to run multiple times (uses try/catch for each ALTER).
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DB_PATH || './data/material_library.db';
const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

function tryAlter(sql) {
  try { db.exec(sql); } catch (_) { /* column already exists */ }
}

console.log('Running migrations...');

// ── inventory new columns ──────────────────────────────────────────────────
tryAlter('ALTER TABLE inventory ADD COLUMN min_order_quantity REAL');
tryAlter('ALTER TABLE inventory ADD COLUMN available_from_date TEXT');
tryAlter('ALTER TABLE inventory ADD COLUMN is_immediately_available BOOLEAN DEFAULT 1');
tryAlter('ALTER TABLE inventory ADD COLUMN is_regularly_available BOOLEAN DEFAULT 0');
tryAlter('ALTER TABLE inventory ADD COLUMN regular_availability_period TEXT');
tryAlter('ALTER TABLE inventory ADD COLUMN regular_availability_type TEXT');
tryAlter('ALTER TABLE inventory ADD COLUMN is_mobile BOOLEAN DEFAULT 0');
tryAlter('ALTER TABLE inventory ADD COLUMN contact_user_id TEXT');
tryAlter('ALTER TABLE inventory ADD COLUMN value_type TEXT');
tryAlter('ALTER TABLE inventory ADD COLUMN price REAL');
tryAlter('ALTER TABLE inventory ADD COLUMN price_unit TEXT');
tryAlter('ALTER TABLE inventory ADD COLUMN is_negotiable BOOLEAN DEFAULT 0');
tryAlter('ALTER TABLE inventory ADD COLUMN transaction_options TEXT');
tryAlter('ALTER TABLE inventory ADD COLUMN logistics_options TEXT');
tryAlter('ALTER TABLE inventory ADD COLUMN transport_costs TEXT');
tryAlter('ALTER TABLE inventory ADD COLUMN condition TEXT');

// ── inventory_images table ─────────────────────────────────────────────────
db.exec(`CREATE TABLE IF NOT EXISTS inventory_images (
    id TEXT PRIMARY KEY,
    inventory_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    file_path TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    step_index INTEGER,
    step_caption TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
)`);

// ── inventory_files table ──────────────────────────────────────────────────
db.exec(`CREATE TABLE IF NOT EXISTS inventory_files (
    id TEXT PRIMARY KEY,
    inventory_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    file_path TEXT NOT NULL,
    file_label TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
)`);

// ── materials new columns ──────────────────────────────────────────────────
tryAlter('ALTER TABLE materials ADD COLUMN tech_compressive_strength TEXT');
tryAlter('ALTER TABLE materials ADD COLUMN tech_tensile_strength TEXT');
tryAlter('ALTER TABLE materials ADD COLUMN recycling_percentage REAL');
tryAlter('ALTER TABLE materials ADD COLUMN voc_values TEXT');
tryAlter('ALTER TABLE materials ADD COLUMN origin_source TEXT');
tryAlter('ALTER TABLE materials ADD COLUMN previous_use TEXT');
tryAlter('ALTER TABLE materials ADD COLUMN use_indoor BOOLEAN DEFAULT 1');
tryAlter('ALTER TABLE materials ADD COLUMN use_outdoor BOOLEAN DEFAULT 0');
tryAlter('ALTER TABLE materials ADD COLUMN use_where TEXT');
tryAlter('ALTER TABLE materials ADD COLUMN use_not_suitable TEXT');
tryAlter('ALTER TABLE materials ADD COLUMN cert_epd BOOLEAN DEFAULT 0');
tryAlter('ALTER TABLE materials ADD COLUMN cert_cradle_to_cradle BOOLEAN DEFAULT 0');
tryAlter('ALTER TABLE materials ADD COLUMN cert_fsc_pefc BOOLEAN DEFAULT 0');

// ── material_images table ──────────────────────────────────────────────────
db.exec(`CREATE TABLE IF NOT EXISTS material_images (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    file_path TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    step_index INTEGER,
    step_caption TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
)`);

// ── material_files table ───────────────────────────────────────────────────
db.exec(`CREATE TABLE IF NOT EXISTS material_files (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    file_path TEXT NOT NULL,
    file_label TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
)`);

// ── projects new columns ───────────────────────────────────────────────────
tryAlter('ALTER TABLE projects ADD COLUMN time_effort TEXT');
tryAlter('ALTER TABLE projects ADD COLUMN tools TEXT');
tryAlter('ALTER TABLE projects ADD COLUMN steps TEXT');

// ── project_files table ────────────────────────────────────────────────────
db.exec(`CREATE TABLE IF NOT EXISTS project_files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    file_path TEXT NOT NULL,
    file_label TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
)`);

// ── project_images: add sort_order + step cols if missing ──────────────────
tryAlter('ALTER TABLE project_images ADD COLUMN sort_order INTEGER DEFAULT 0');
tryAlter('ALTER TABLE project_images ADD COLUMN step_index INTEGER');
tryAlter('ALTER TABLE project_images ADD COLUMN step_caption TEXT');

// ── Expand origin_source: drop old CHECK constraint ───────────────────────────
// SQLite can't ALTER constraints; must recreate table.
try {
  const meta = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='materials'").get();
  if (meta && meta.sql.includes("CHECK(origin_source IN")) {
    console.log('Migrating: removing origin_source CHECK constraint...');
    db.pragma('foreign_keys = OFF');
    db.exec(`
      ALTER TABLE materials RENAME TO materials_old_ck;

      CREATE TABLE materials (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        description TEXT,
        short_description TEXT,
        origin_acquisition TEXT,
        use_processing TEXT,
        use_indoor_outdoor TEXT,
        use_limitations TEXT,
        similar_material_ids TEXT,
        tech_thicknesses TEXT,
        tech_dimensions TEXT,
        tech_density TEXT,
        tech_flammability TEXT,
        tech_acoustics TEXT,
        tech_thermal_insulation TEXT,
        tech_compressive_strength TEXT,
        tech_tensile_strength TEXT,
        sust_climate_description TEXT,
        gwp_total_value REAL,
        gwp_total_unit TEXT,
        recyclate_content REAL,
        recycling_percentage REAL,
        voc_values TEXT,
        circularity TEXT,
        human_health TEXT,
        processing_sustainability TEXT,
        principles_sufficiency TEXT,
        principles_consistency TEXT,
        principles_efficiency TEXT,
        env_links TEXT,
        appendix TEXT,
        unit TEXT DEFAULT 'kg',
        origin_source TEXT,
        previous_use TEXT,
        use_indoor BOOLEAN DEFAULT 1,
        use_outdoor BOOLEAN DEFAULT 0,
        use_where TEXT,
        use_not_suitable TEXT,
        cert_epd BOOLEAN DEFAULT 0,
        cert_cradle_to_cradle BOOLEAN DEFAULT 0,
        cert_fsc_pefc BOOLEAN DEFAULT 0,
        gwp_value REAL DEFAULT 0,
        gwp_unit TEXT DEFAULT 'kg CO2e',
        gwp_source TEXT,
        is_reusable BOOLEAN DEFAULT 0,
        is_transferable BOOLEAN DEFAULT 0,
        is_giftable BOOLEAN DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        latitude REAL,
        longitude REAL,
        location_name TEXT,
        address TEXT,
        material_id TEXT,
        passport_type TEXT DEFAULT 'construction',
        passport_data TEXT DEFAULT '{}',
        declared_unit TEXT,
        gwp_fossil REAL,
        gwp_biogenic REAL,
        adp_fossil REAL,
        adp_elements REAL,
        lifecycle_scope TEXT,
        water_consumption REAL,
        gwp_luluc REAL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      );

      INSERT INTO materials SELECT
        id, name, category, description, short_description,
        origin_acquisition, use_processing, use_indoor_outdoor, use_limitations, similar_material_ids,
        tech_thicknesses, tech_dimensions, tech_density, tech_flammability, tech_acoustics,
        tech_thermal_insulation, tech_compressive_strength, tech_tensile_strength,
        sust_climate_description, gwp_total_value, gwp_total_unit, recyclate_content,
        recycling_percentage, voc_values, circularity, human_health, processing_sustainability,
        principles_sufficiency, principles_consistency, principles_efficiency,
        env_links, appendix, unit, origin_source, previous_use,
        use_indoor, use_outdoor, use_where, use_not_suitable,
        cert_epd, cert_cradle_to_cradle, cert_fsc_pefc,
        gwp_value, gwp_unit, gwp_source,
        is_reusable, is_transferable, is_giftable, created_by, created_at, updated_at,
        latitude, longitude, location_name, address,
        material_id, passport_type, passport_data,
        declared_unit, gwp_fossil, gwp_biogenic, adp_fossil, adp_elements,
        lifecycle_scope, water_consumption, gwp_luluc
      FROM materials_old_ck;

      DROP TABLE materials_old_ck;

      CREATE INDEX IF NOT EXISTS idx_materials_created_by ON materials(created_by);
      CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mat_material_id ON materials(material_id) WHERE material_id IS NOT NULL;
    `);
    db.pragma('foreign_keys = ON');
    console.log('✅ origin_source constraint removed');
  }
} catch (e) {
  console.error('origin_source migration error:', e.message);
}

// ── Recover orphaned _mig_fix_* tables from any previously interrupted run ───
try {
  db.pragma('foreign_keys = OFF');
  const orphaned = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '_mig_fix_%'`
  ).all();
  for (const { name } of orphaned) {
    const orig = name.slice('_mig_fix_'.length);
    const exists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(orig);
    if (!exists) {
      db.exec(`ALTER TABLE "${name}" RENAME TO "${orig}"`);
      console.log(`  Recovered orphaned table: ${name} → ${orig}`);
    } else {
      db.exec(`DROP TABLE "${name}"`);
      console.log(`  Dropped stale temp table: ${name}`);
    }
  }
  db.pragma('foreign_keys = ON');
} catch (e) {
  db.pragma('foreign_keys = ON');
  console.error('Orphan recovery error (non-fatal):', e.message);
}

// ── Fix stale FK refs left by origin_source migration (materials_old_ck) ─────
// Rebuild affected tables using pure better-sqlite3 (no sqlite3 CLI needed).
try {
  const stale = db.prepare(
    `SELECT name, sql FROM sqlite_master WHERE type='table' AND sql LIKE '%materials_old_ck%'`
  ).all();
  if (stale.length > 0) {
    console.log(`Fixing ${stale.length} table(s) with stale FK reference to materials_old_ck...`);
    db.pragma('foreign_keys = OFF');
    for (const { name, sql } of stale) {
      try {
        const indexes = db.prepare(
          `SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL`
        ).all(name);
        const tmpName = `_mig_fix_${name}`;
        const fixedCreate = sql
          .replace(/"materials_old_ck"/g, '"materials"')
          .replace(/\bmaterials_old_ck\b/g, 'materials');
        const cols = db.prepare(`PRAGMA table_info("${name}")`).all()
          .map(c => `"${c.name}"`).join(', ');
        db.exec(`ALTER TABLE "${name}" RENAME TO "${tmpName}"`);
        try {
          db.exec(fixedCreate);
          db.exec(`INSERT INTO "${name}" (${cols}) SELECT ${cols} FROM "${tmpName}"`);
          db.exec(`DROP TABLE "${tmpName}"`);
          for (const idx of indexes) {
            try { db.exec(idx.sql); } catch (_) { /* already exists */ }
          }
          console.log(`  ✓ Rebuilt: ${name}`);
        } catch (inner) {
          // Recreate failed — rename temp back so table is not lost
          db.exec(`ALTER TABLE "${tmpName}" RENAME TO "${name}"`);
          console.error(`  ✗ Rebuild failed for ${name} (restored): ${inner.message}`);
        }
      } catch (outer) {
        console.error(`  ✗ Could not process ${name}: ${outer.message}`);
      }
    }
    db.pragma('foreign_keys = ON');
    console.log('✅ FK fix pass complete');
  }
} catch (e) {
  db.pragma('foreign_keys = ON');
  console.error('FK fix error (non-fatal):', e.message);
}

// ── Fix stale FK refs pointing to _mig_fix_* tables (cascade from table rebuild) ──
// When a table is renamed to _mig_fix_X during rebuild, SQLite auto-rewrites all
// child-table FKs to point to _mig_fix_X. After the rebuild completes and _mig_fix_X
// is dropped, those child tables are left with broken FK references.
try {
  const staleFix = db.prepare(
    `SELECT name, sql FROM sqlite_master WHERE type='table' AND sql LIKE '%_mig_fix_%'`
  ).all();
  if (staleFix.length > 0) {
    console.log(`Fixing ${staleFix.length} table(s) with stale _mig_fix_ FK reference(s)...`);
    db.pragma('foreign_keys = OFF');
    for (const { name, sql } of staleFix) {
      try {
        const fixedCreate = sql.replace(/"_mig_fix_([^"]+)"/g, '"$1"')
                               .replace(/_mig_fix_(\w+)/g, '$1');
        const indexes = db.prepare(
          `SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL`
        ).all(name);
        const cols = db.prepare(`PRAGMA table_info("${name}")`).all()
          .map(c => `"${c.name}"`).join(', ');
        const tmpName = `_mig_fix_${name}`;
        db.exec(`ALTER TABLE "${name}" RENAME TO "${tmpName}"`);
        try {
          db.exec(fixedCreate);
          db.exec(`INSERT INTO "${name}" (${cols}) SELECT ${cols} FROM "${tmpName}"`);
          db.exec(`DROP TABLE "${tmpName}"`);
          for (const idx of indexes) {
            try { db.exec(idx.sql); } catch (_) { /* already exists */ }
          }
          console.log(`  ✓ Rebuilt (mig_fix ref): ${name}`);
        } catch (inner) {
          db.exec(`ALTER TABLE "${tmpName}" RENAME TO "${name}"`);
          console.error(`  ✗ Rebuild failed for ${name} (restored): ${inner.message}`);
        }
      } catch (outer) {
        console.error(`  ✗ Could not process ${name}: ${outer.message}`);
      }
    }
    db.pragma('foreign_keys = ON');
    console.log('✅ _mig_fix_ FK ref pass complete');
  }
} catch (e) {
  db.pragma('foreign_keys = ON');
  console.error('_mig_fix_ FK ref fix error (non-fatal):', e.message);
}

// ── inventory: swap_possible + external_url columns ──────────────────────────
tryAlter('ALTER TABLE inventory ADD COLUMN swap_possible BOOLEAN DEFAULT 0');
tryAlter('ALTER TABLE inventory ADD COLUMN available_for_gift BOOLEAN DEFAULT 0');
tryAlter('ALTER TABLE inventory ADD COLUMN external_url TEXT');

// ── projects: ensure all model columns exist (safe to re-run) ────────────────
tryAlter('ALTER TABLE projects ADD COLUMN "references" TEXT');
tryAlter('ALTER TABLE projects ADD COLUMN is_available BOOLEAN DEFAULT 0');
tryAlter('ALTER TABLE projects ADD COLUMN license TEXT');
tryAlter('ALTER TABLE projects ADD COLUMN material_id TEXT');
tryAlter('ALTER TABLE projects ADD COLUMN cad_share_url TEXT');

db.close();
console.log('✅ Migrations complete!');
