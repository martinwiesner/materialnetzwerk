/**
 * Database Initialization Script
 * Creates the SQLite database and runs the schema
 */

import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path
const DB_PATH = process.env.DB_PATH || './data/material_library.db';
const dataDir = dirname(DB_PATH);

// Create data directory if it doesn't exist
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
  console.log(`Created data directory: ${dataDir}`);
}

// Initialize database
const db = new Database(DB_PATH);
console.log(`Database initialized at: ${DB_PATH}`);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Read and execute schema
const schemaPath = join(__dirname, 'schema.sql');
const schema = readFileSync(schemaPath, 'utf8');

try {
  db.exec(schema);
  console.log('Database schema created successfully!');

  // ------------------------------------------------
  // Seed data (only if DB is empty)
  // ------------------------------------------------
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount === 0) {
    console.log('\nSeeding initial data...');

    // Default user for demo / local setup
    const seedUserId = uuidv4();
    const seedEmail = process.env.SEED_USER_EMAIL || 'demo@local';
    // For local dev, use a placeholder Zitadel sub.
    // In production, real users are created on first Zitadel login.
    const seedSub = process.env.SEED_USER_SUB || 'demo-local';

    db.prepare(`
      INSERT INTO users (id, zitadel_sub, email, first_name, last_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(seedUserId, seedSub, seedEmail, 'Demo', 'User');

    // Helper to create a material + inventory entry
    const insertMaterial = db.prepare(`
      INSERT INTO materials (
        id, name, category, description, unit,
        gwp_value, gwp_unit, gwp_source,
        is_reusable, is_transferable, is_giftable, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertInventory = db.prepare(`
      INSERT INTO inventory (
        id, user_id, material_id, quantity, unit,
        location_name, latitude, longitude, address,
        is_available, available_for_transfer, available_for_gift, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Approximate base coordinates (fallback)
    const LOC_ZEITZ = { lat: 51.0496, lon: 12.1369 };
    const LOC_DESSAU = { lat: 51.8337, lon: 12.2427 };

    // More precise seed coordinates (provided)
    const POS = {
      project_akustikabsorber: { lat: 51.053071, lon: 12.128662 },
      hempflax_offer: { lat: 51.053239, lon: 12.128933 },
      weizenspreu_los_offer: { lat: 51.053255, lon: 12.128503 },
      rundstaebe_offer: { lat: 51.053208, lon: 12.128984 },
      lehm_offer: { lat: 51.053217, lon: 12.128858 },
    };

    const addressZeitz = 'Geschwister-Scholl-Str. 16, 06712 Zeitz';
    const addressDessau = 'Seminarplatz 2a, 06844 Dessau-Roßlau';

    const materials = [
      {
        key: 'weizenspreu_los',
        name: 'Weizenspreu (los)',
        category: 'Agrarreststoff',
        description: 'Lose Weizenspreu, geeignet als Füllstoff/Leichtzuschlag.',
        unit: 'kg',
        gwp_value: -0.2,
        gwp_unit: 'kg CO2e',
        gwp_source: 'generic',
        inv_qty: 5,
        inv_unit: 'kg',
        loc_name: 'Zeitz Lager',
        lat: POS.weizenspreu_los_offer.lat,
        lon: POS.weizenspreu_los_offer.lon,
        address: addressZeitz,
        notes: 'ca. 5 kg',
      },
      {
        key: 'weizenspreu_platte',
        name: 'Weizenspreu (gepresste Platte)',
        category: 'Biobasierte Platte',
        description: 'Gepresste Platte aus Weizenspreu, potenziell als Absorber/Leichtbauplatte.',
        unit: 'Stück',
        gwp_value: 1.8,
        gwp_unit: 'kg CO2e',
        gwp_source: 'generic',
        inv_qty: 2,
        inv_unit: 'Stück',
        loc_name: 'Zeitz Lager',
        lat: LOC_ZEITZ.lat,
        lon: LOC_ZEITZ.lon,
        address: addressZeitz,
        notes: 'ca. 2 Platten',
      },
      {
        key: 'hempflax_thermo_hanf',
        name: 'HempFlax Thermo Hanf Premium Plus 1200 x 580 mm',
        category: 'Dämmstoff',
        description: 'Hanf-Dämmplatte (Thermo Hanf Premium Plus) im Format 1200 x 580 mm.',
        unit: 'Stück',
        gwp_value: 0.9,
        gwp_unit: 'kg CO2e',
        gwp_source: 'generic',
        inv_qty: 10,
        inv_unit: 'Stück',
        loc_name: 'Zeitz Lager',
        lat: POS.hempflax_offer.lat,
        lon: POS.hempflax_offer.lon,
        address: addressZeitz,
        notes: 'ca. 10 Stück',
      },
      {
        key: 'co2_beton_set',
        name: 'Set für CO2-reduzierten Beton',
        category: 'Bindemittel/Beton',
        description: 'Materialset für CO2-reduzierten Beton (Komponenten gemischt/abgestimmt).',
        unit: 'kg',
        gwp_value: 0.35,
        gwp_unit: 'kg CO2e',
        gwp_source: 'generic',
        inv_qty: 5,
        inv_unit: 'kg',
        loc_name: 'Materiallager',
        lat: LOC_ZEITZ.lat,
        lon: LOC_ZEITZ.lon,
        address: addressZeitz,
        notes: 'ca. 5 kg',
      },
      {
        key: 'rundstaebe_35mm',
        name: 'Rundstäbe Ø35 mm (2,8 m)',
        category: 'Holz/Verbund',
        description: 'Rundstäbe Durchmesser 35 mm, Länge 2,8 m. GWP ist pro kg angegeben.',
        unit: 'kg',
        gwp_value: -1.642,
        gwp_unit: 'kg CO2e',
        gwp_source: 'provided',
        inv_qty: 20,
        inv_unit: 'Stück',
        loc_name: 'Zeitz Lager',
        lat: POS.rundstaebe_offer.lat,
        lon: POS.rundstaebe_offer.lon,
        address: addressZeitz,
        notes: 'ca. 20 Stück, Länge 2,8 m',
      },
      {
        key: 'lehm_guss_set',
        name: 'Set für gegossenen Lehm (Lehm + Zement + Zusätze)',
        category: 'Lehm/Hybrid',
        description: 'Set aus Lehm, Zement und weiteren Zusätzen für gegossene Anwendungen.',
        unit: 'kg',
        gwp_value: 0.12,
        gwp_unit: 'kg CO2e',
        gwp_source: 'generic',
        inv_qty: 10,
        inv_unit: 'kg',
        loc_name: 'Zeitz Lager',
        lat: POS.lehm_offer.lat,
        lon: POS.lehm_offer.lon,
        address: addressZeitz,
        notes: 'ca. 10 kg',
      },
    ];

    const materialIds = {};
    for (const m of materials) {
      const matId = uuidv4();
      materialIds[m.key] = matId;
      insertMaterial.run(
        matId,
        m.name,
        m.category,
        m.description,
        m.unit,
        m.gwp_value,
        m.gwp_unit,
        m.gwp_source,
        1, // is_reusable
        1, // is_transferable
        1, // is_giftable
        seedUserId
      );

      // Create inventory entries so materials appear on the map
      const invId = uuidv4();
      insertInventory.run(
        invId,
        seedUserId,
        matId,
        m.inv_qty,
        m.inv_unit,
        m.loc_name,
        m.lat,
        m.lon,
        m.address,
        1,
        1,
        0,
        m.notes
      );
    }

    // Seed project: Akustikabsorber
    const projectId = uuidv4();
    db.prepare(`
      INSERT INTO projects (
        id, name, description, content,
        location_name, latitude, longitude, address,
        status, is_public, owner_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      'Akustikabsorber',
      'Akustikabsorber aus Hanf-Dämmplatte und Rundstäben. Der Gesamt-GWP wird automatisch aus den Materialmengen berechnet.',
      'Ein kompakter Akustikabsorber: 1x HempFlax Thermo Hanf Premium Plus (1200 x 580 mm) + 3,76 kg Rundstäbe (Ø35 mm, 2,8 m).',
      'Zeitz Projektstandort',
      POS.project_akustikabsorber.lat,
      POS.project_akustikabsorber.lon,
      addressZeitz,
      'active',
      0,
      seedUserId
    );

    // Link materials to the project
    db.prepare(`
      INSERT INTO project_materials (id, project_id, material_id, quantity, unit)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), projectId, materialIds.hempflax_thermo_hanf, 1, 'Stück');

    db.prepare(`
      INSERT INTO project_materials (id, project_id, material_id, quantity, unit)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), projectId, materialIds.rundstaebe_35mm, 3.76, 'kg');

    console.log('✅ Seed data inserted.');
    console.log(`   Demo login: ${seedEmail} / ${seedPassword}`);
  }
  
  // Verify tables
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();
  
  console.log('\nCreated tables:');
  tables.forEach(t => console.log(`  - ${t.name}`));
  
} catch (error) {
  console.error('Error creating schema:', error.message);
  process.exit(1);
} finally {
  db.close();
}

console.log('\n✅ Database initialization complete!');
