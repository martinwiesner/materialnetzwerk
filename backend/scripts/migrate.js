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

// ── users: migrate to Zitadel-based auth ──────────────────────────────────
// Add zitadel_sub column (identity from Zitadel JWT sub claim)
tryAlter('ALTER TABLE users ADD COLUMN zitadel_sub TEXT');
// Make email nullable (Zitadel provides it, but it is not required for identity)
// SQLite cannot DROP NOT NULL constraints; the new schema handles new DBs correctly.
// Existing rows keep their email values.

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

db.close();
console.log('✅ Migrations complete!');
