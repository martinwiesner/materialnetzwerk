/**
 * Database Configuration
 * SQLite database connection using better-sqlite3
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join, isAbsolute, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

/**
 * Get database connection (singleton pattern)
 */
export const getDB = () => {
  if (db) return db;
  
  const configured = process.env.DB_PATH || './data/material_library.db';
  // Make DB path stable even if the server is started from a different CWD.
  const dbPath = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  const dataDir = dirname(dbPath);
  
  // Create data directory if it doesn't exist
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  
  // Check if DB exists, if not initialize schema
  const dbExists = existsSync(dbPath);
  
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  console.log(`🗄️  Using SQLite DB at: ${dbPath}`);
  
  if (!dbExists) {
    console.log('Database not found. Initializing schema...');
    initializeSchema();
  }
  // Always run these — safe on both new and existing DBs
  ensureTables();                  // CREATE TABLE IF NOT EXISTS for all tables
  ensureMaterialCategories();
  ensureColumns();                 // ALTER TABLE ADD COLUMN IF NOT EXISTS
  ensureCategoryTranslations();   // Rename English → German category names
  ensureAdmin();                   // Promote ADMIN_EMAIL to superuser if set
  ensureFixedAdmins(); // Create/promote hardcoded admin accounts (fire-and-forget)
  ensureSeedData();
  
  return db;
};

/**
 * Initialize database schema
 */
const initializeSchema = () => {
  const schemaPath = join(__dirname, '../../scripts/schema.sql');
  
  if (existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    console.log('Database schema initialized successfully');
  } else {
    console.error('Schema file not found at:', schemaPath);
  }
};

/**
 * Ensure all tables exist — runs on EVERY startup (safe on existing DBs).
 * This is the only reliable way to add new tables to existing installations.
 */
const ensureTables = () => {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS material_images (
        id TEXT PRIMARY KEY, material_id TEXT NOT NULL, filename TEXT NOT NULL,
        original_name TEXT, mime_type TEXT, file_size INTEGER, file_path TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0, step_index INTEGER, step_caption TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS material_files (
        id TEXT PRIMARY KEY, material_id TEXT NOT NULL, filename TEXT NOT NULL,
        original_name TEXT, mime_type TEXT, file_size INTEGER, file_path TEXT NOT NULL,
        file_label TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS inventory_images (
        id TEXT PRIMARY KEY, inventory_id TEXT NOT NULL, filename TEXT NOT NULL,
        original_name TEXT, mime_type TEXT, file_size INTEGER, file_path TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0, step_index INTEGER, step_caption TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS inventory_files (
        id TEXT PRIMARY KEY, inventory_id TEXT NOT NULL, filename TEXT NOT NULL,
        original_name TEXT, mime_type TEXT, file_size INTEGER, file_path TEXT NOT NULL,
        file_label TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS project_images (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, filename TEXT NOT NULL,
        original_name TEXT, mime_type TEXT, file_size INTEGER, file_path TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0, step_index INTEGER, step_caption TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS project_files (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, filename TEXT NOT NULL,
        original_name TEXT, mime_type TEXT, file_size INTEGER, file_path TEXT NOT NULL,
        file_label TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS actors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT,
        tagline TEXT,
        description TEXT,
        website TEXT,
        email TEXT,
        phone TEXT,
        location_name TEXT,
        address TEXT,
        latitude REAL,
        longitude REAL,
        owner_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS actor_images (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT,
        mime_type TEXT,
        file_size INTEGER,
        file_path TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS actor_links (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE,
        UNIQUE(actor_id, entity_type, entity_id)
      );
      CREATE TABLE IF NOT EXISTS material_requests (
        id TEXT PRIMARY KEY,
        inventory_id TEXT NOT NULL,
        requester_id TEXT NOT NULL,
        quantity REAL,
        unit TEXT,
        message TEXT,
        status TEXT DEFAULT 'pending',
        owner_note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
        FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS material_actors (
        material_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (material_id, actor_id),
        FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS project_actors (
        project_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (project_id, actor_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
      );
    `);
    console.log('✓ All tables verified/created.');
  } catch (err) {
    console.error('ensureTables failed:', err.message);
  }
};

/**
 * Connect to database
 */
const connectDB = async () => {
  try {
    const database = getDB();
    
    // Test connection by running a simple query
    database.prepare('SELECT 1').get();
    
    console.log('SQLite database connected');
    return database;
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

/**
 * Close database connection
 */
export const closeDB = () => {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed');
  }
};

export default connectDB;

/**
 * Ensure material_categories table exists and is seeded
 */
const ensureMaterialCategories = () => {
  try {
    // Create table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS material_categories (
        name TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure all required categories exist (idempotent — adds missing ones)
    const allCategories = [
      'Metalle',
      'Holz',
      'Kunststoffe',
      'Glas',
      'Mineralische Baustoffe',
      'Textilien',
      'Keramik',
      'Verbundwerkstoffe',
      'Naturstein',
      'Landwirtschaftliche Reststoffe',
      'Sonstiges',
    ];
    const existing = new Set(
      db.prepare('SELECT name FROM material_categories').all().map(r => r.name)
    );
    const insert = db.prepare('INSERT INTO material_categories (name) VALUES (?)');
    for (const name of allCategories) {
      if (!existing.has(name)) insert.run(name);
    }
  } catch (err) {
    console.error('Failed ensuring material_categories:', err.message);
  }
};

/**
 * Ensure new columns exist (best-effort migrations for SQLite)
 */
const ensureColumns = () => {
  try {
    const addCol = (table, col, ddl) => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name);
      if (cols.includes(col)) return;
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    };

    // materials
    addCol('materials', 'short_description', 'short_description TEXT');
    addCol('materials', 'origin_acquisition', 'origin_acquisition TEXT');
    addCol('materials', 'use_processing', 'use_processing TEXT');
    addCol('materials', 'use_indoor_outdoor', 'use_indoor_outdoor TEXT');
    addCol('materials', 'use_limitations', 'use_limitations TEXT');
    addCol('materials', 'similar_material_ids', 'similar_material_ids TEXT');
    addCol('materials', 'tech_thicknesses', 'tech_thicknesses TEXT');
    addCol('materials', 'tech_dimensions', 'tech_dimensions TEXT');
    addCol('materials', 'tech_density', 'tech_density TEXT');
    addCol('materials', 'tech_flammability', 'tech_flammability TEXT');
    addCol('materials', 'tech_acoustics', 'tech_acoustics TEXT');
    addCol('materials', 'tech_thermal_insulation', 'tech_thermal_insulation TEXT');
    addCol('materials', 'sust_climate_description', 'sust_climate_description TEXT');
    addCol('materials', 'gwp_total_value', 'gwp_total_value REAL');
    addCol('materials', 'gwp_total_unit', 'gwp_total_unit TEXT');
    addCol('materials', 'gwp_value', 'gwp_value REAL DEFAULT 0');
    addCol('materials', 'gwp_unit', 'gwp_unit TEXT');
    addCol('materials', 'gwp_source', 'gwp_source TEXT');
    addCol('materials', 'recyclate_content', 'recyclate_content REAL');
    addCol('materials', 'circularity', 'circularity TEXT');
    addCol('materials', 'human_health', 'human_health TEXT');
    addCol('materials', 'processing_sustainability', 'processing_sustainability TEXT');
    addCol('materials', 'principles_sufficiency', 'principles_sufficiency TEXT');
    addCol('materials', 'principles_consistency', 'principles_consistency TEXT');
    addCol('materials', 'principles_efficiency', 'principles_efficiency TEXT');
    addCol('materials', 'env_links', 'env_links TEXT');
    addCol('materials', 'appendix', 'appendix TEXT');

    // projects
    addCol('projects', 'circular_principles', 'circular_principles TEXT');
    addCol('projects', 'principles_sufficiency', 'principles_sufficiency TEXT');
    addCol('projects', 'principles_consistency', 'principles_consistency TEXT');
    addCol('projects', 'principles_efficiency', 'principles_efficiency TEXT');
    addCol('projects', 'general_sustainability_principles', 'general_sustainability_principles TEXT');
    // project execution fields (added in upload feature iteration)
    addCol('projects', 'time_effort', 'time_effort TEXT');
    addCol('projects', 'tools', 'tools TEXT');
    addCol('projects', 'steps', 'steps TEXT');

    // *_images tables may have been created without these columns on old DBs
    addCol('material_images', 'sort_order', 'sort_order INTEGER DEFAULT 0');
    addCol('material_images', 'step_index', 'step_index INTEGER');
    addCol('material_images', 'step_caption', 'step_caption TEXT');
    addCol('inventory_images', 'sort_order', 'sort_order INTEGER DEFAULT 0');
    addCol('inventory_images', 'step_index', 'step_index INTEGER');
    addCol('inventory_images', 'step_caption', 'step_caption TEXT');
    addCol('project_images', 'sort_order', 'sort_order INTEGER DEFAULT 0');
    addCol('project_images', 'step_index', 'step_index INTEGER');
    addCol('project_images', 'step_caption', 'step_caption TEXT');

    // materials – new technical/origin/cert fields
    addCol('materials', 'tech_compressive_strength', 'tech_compressive_strength TEXT');
    addCol('materials', 'tech_tensile_strength', 'tech_tensile_strength TEXT');
    addCol('materials', 'recycling_percentage', 'recycling_percentage REAL');
    addCol('materials', 'voc_values', 'voc_values TEXT');
    addCol('materials', 'origin_source', 'origin_source TEXT');
    addCol('materials', 'previous_use', 'previous_use TEXT');
    addCol('materials', 'use_indoor', 'use_indoor BOOLEAN DEFAULT 0');
    addCol('materials', 'use_outdoor', 'use_outdoor BOOLEAN DEFAULT 0');
    addCol('materials', 'use_where', 'use_where TEXT');
    addCol('materials', 'use_not_suitable', 'use_not_suitable TEXT');
    addCol('materials', 'cert_epd', 'cert_epd BOOLEAN DEFAULT 0');
    addCol('materials', 'cert_cradle_to_cradle', 'cert_cradle_to_cradle BOOLEAN DEFAULT 0');
    addCol('materials', 'cert_fsc_pefc', 'cert_fsc_pefc BOOLEAN DEFAULT 0');

    // users
    addCol('users', 'is_admin', 'is_admin BOOLEAN DEFAULT 0');

    // inventory
    addCol('inventory', 'availability_mode', "availability_mode TEXT DEFAULT 'negotiable'");
    addCol('inventory', 'external_url', 'external_url TEXT');
    addCol('inventory', 'season_from', 'season_from TEXT');
    addCol('inventory', 'season_to', 'season_to TEXT');
    addCol('inventory', 'swap_possible', 'swap_possible BOOLEAN DEFAULT 0');
    addCol('inventory', 'swap_against', 'swap_against TEXT');
    // inventory – new fields from upload feature iteration
    addCol('inventory', 'min_order_quantity', 'min_order_quantity REAL');
    addCol('inventory', 'available_from_date', 'available_from_date TEXT');
    addCol('inventory', 'is_immediately_available', 'is_immediately_available BOOLEAN DEFAULT 0');
    addCol('inventory', 'is_regularly_available', 'is_regularly_available BOOLEAN DEFAULT 0');
    addCol('inventory', 'regular_availability_period', 'regular_availability_period TEXT');
    addCol('inventory', 'regular_availability_type', 'regular_availability_type TEXT');
    addCol('inventory', 'is_mobile', 'is_mobile BOOLEAN DEFAULT 0');
    addCol('inventory', 'contact_user_id', 'contact_user_id TEXT');
    addCol('inventory', 'value_type', "value_type TEXT DEFAULT 'negotiable'");
    addCol('inventory', 'price', 'price REAL');
    addCol('inventory', 'price_unit', 'price_unit TEXT');
    addCol('inventory', 'is_negotiable', 'is_negotiable BOOLEAN DEFAULT 1');
    addCol('inventory', 'transaction_options', 'transaction_options TEXT');
    addCol('inventory', 'logistics_options', 'logistics_options TEXT');
    addCol('inventory', 'transport_costs', 'transport_costs TEXT');
    addCol('inventory', 'condition', 'condition TEXT');

    // projects – availability flag
    addCol('projects', 'is_available', 'is_available BOOLEAN DEFAULT 0');
    // projects – references / bibliography
    addCol('projects', 'references', '"references" TEXT');
    // project_images – image credit
    addCol('project_images', 'credit', 'credit TEXT');

    // materials – location fields
    addCol('materials', 'latitude', 'latitude REAL');
    addCol('materials', 'longitude', 'longitude REAL');
    addCol('materials', 'location_name', 'location_name TEXT');
    addCol('materials', 'address', 'address TEXT');
  } catch (err) {
    console.error('Failed ensuring new columns:', err.message);
  }
};

/**
 * Translate legacy English category names to German (idempotent).
 */
const ensureCategoryTranslations = () => {
  const translations = {
    Metals: 'Metalle',
    Wood: 'Holz',
    Plastics: 'Kunststoffe',
    Glass: 'Glas',
    Concrete: 'Mineralische Baustoffe',
    Textiles: 'Textilien',
    Ceramics: 'Keramik',
    Composites: 'Verbundwerkstoffe',
    Stone: 'Naturstein',
    Other: 'Sonstiges',
  };
  try {
    for (const [en, de] of Object.entries(translations)) {
      // Update material rows first
      db.prepare('UPDATE materials SET category = ? WHERE category = ?').run(de, en);
      // Update material_categories table (rename primary key safely)
      const deExists = db.prepare('SELECT 1 FROM material_categories WHERE name = ?').get(de);
      if (!deExists) {
        db.prepare('UPDATE material_categories SET name = ? WHERE name = ?').run(de, en);
      } else {
        db.prepare('DELETE FROM material_categories WHERE name = ?').run(en);
      }
    }
  } catch (err) {
    console.error('ensureCategoryTranslations failed:', err.message);
  }
};

/**
 * Promote the user with ADMIN_EMAIL env var to superuser on every startup.
 * Safe to run repeatedly — only updates if the user exists and isn't already admin.
 */
const ensureAdmin = () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  try {
    const result = db.prepare(
      `UPDATE users SET is_admin = 1 WHERE email = ? AND (is_admin IS NULL OR is_admin = 0)`
    ).run(adminEmail);
    if (result.changes > 0) {
      console.log(`✓ Superuser granted to: ${adminEmail}`);
    }
  } catch (err) {
    console.error('ensureAdmin failed:', err.message);
  }
};

/**
 * Ensure fixed admin accounts exist and are promoted.
 * Runs on every startup — creates the user if missing, always sets is_admin = 1.
 */
const ensureFixedAdmins = async () => {
  const adminEmails = [
    process.env.FIXED_ADMIN_EMAIL || 'admin@rzz.de',
    'martin.wiesner@hs-anhalt.de',
  ];

  try {
    for (const email of adminEmails) {
      const existing = db.prepare('SELECT id, is_admin FROM users WHERE email = ?').get(email);
      if (existing && !existing.is_admin) {
        db.prepare(`UPDATE users SET is_admin = 1 WHERE email = ?`).run(email);
        console.log(`✓ Fixed admin promoted: ${email}`);
      }
      // If user does not exist yet, they must log in via Zitadel first.
    }
  } catch (err) {
    console.error('ensureFixedAdmins failed:', err.message);
  }
};

/**
 * Seed demo data if DB is empty.
 * This is intentionally NON-DESTRUCTIVE: it will never delete or overwrite
 * existing user/material/inventory data.
 */
const ensureSeedData = () => {
  try {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const shouldSeed =
      process.env.SEED_ON_START === 'true' ||
      (nodeEnv === 'development' && process.env.SEED_ON_START !== 'false');

    if (!shouldSeed) return;

    const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get()?.c || 0;
    const materialCount = db.prepare('SELECT COUNT(*) as c FROM materials').get()?.c || 0;
    const inventoryCount = db.prepare('SELECT COUNT(*) as c FROM inventory').get()?.c || 0;
    const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects').get()?.c || 0;
    const actorCount = db.prepare('SELECT COUNT(*) as c FROM actors').get()?.c || 0;

    // Seed actors independently (even if other data exists)
    if (actorCount === 0) {
      const seedActors = async () => {
        const { v4: uuidv4 } = await import('uuid');
        const sysUserId = db.prepare('SELECT id FROM users LIMIT 1').get()?.id;
        if (!sysUserId) return;
        const insertActor = db.prepare(`INSERT INTO actors (id, name, type, tagline, description, website, email, location_name, address, latitude, longitude, owner_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const actors = [
          {
            name: 'Krimzkramz Zeitz',
            type: 'Repair Café / Upcycling',
            tagline: 'Reparieren, tauschen, neu denken – mitten in Zeitz.',
            description: 'Krimzkramz ist ein offener Treffpunkt in Zeitz für alle, die Dinge lieber reparieren als wegwerfen. Wir bieten Repair Cafés, Upcycling-Workshops und eine kleine Materialbibliothek vor Ort.',
            website: 'https://krimzkramz.de',
            email: 'hallo@krimzkramz.de',
            location_name: 'Zeitz',
            address: 'Stiftstraße 12, 06712 Zeitz',
            latitude: 51.0497,
            longitude: 12.1366,
          },
          {
            name: 'Holzwerkstatt Weißenfels',
            type: 'Verarbeitender Betrieb',
            tagline: 'Handwerk mit Sekundärmaterialien – Holz ein zweites Leben geben.',
            description: 'Wir verarbeiten Altholz und Bauholzreste aus dem regionalen Rückbau zu neuen Möbeln und Strukturelementen. Kooperationen mit Planungsbüros und DIY-Projekten willkommen.',
            website: '',
            email: 'info@holzwerk-wsn.de',
            location_name: 'Weißenfels',
            address: 'Industriestraße 4, 06667 Weißenfels',
            latitude: 51.2005,
            longitude: 11.9670,
          },
          {
            name: 'FabLab Halle',
            type: 'Makerspace',
            tagline: 'Digitale Fabrikation, offene Werkzeuge, gemeinsames Machen.',
            description: 'Das FabLab Halle ist ein offener Makerspace mit Lasercutter, 3D-Drucker, CNC-Fräse und Elektronikwerkstatt. Wir arbeiten eng mit Materialanbieterinnen zusammen und testen neue nachhaltige Materialien.',
            website: 'https://fablab-halle.de',
            email: 'mail@fablab-halle.de',
            location_name: 'Halle (Saale)',
            address: 'Seebener Str. 1, 06114 Halle (Saale)',
            latitude: 51.4858,
            longitude: 11.9683,
          },
          {
            name: 'Urban Mining Mitteldeutschland',
            type: 'Urban Mining / Forschung',
            tagline: 'Materialien aus dem Bestand – Schätze im Rückbau entdecken.',
            description: 'Wir dokumentieren und vermitteln Materialien aus Rückbauprojekten im mitteldeutschen Raum. Unser Fokus liegt auf bauhistorisch wertvollen Materialien, Ziegeln, Naturstein und Altholz.',
            website: '',
            email: 'kontakt@urbanmining-md.de',
            location_name: 'Merseburg',
            address: 'Am Viadukt 3, 06217 Merseburg',
            latitude: 51.3571,
            longitude: 11.9940,
          },
          {
            name: 'Nähcafé Naumburg',
            type: 'Kreativwerkstatt',
            tagline: 'Textilien retten, Neues schaffen, gemeinsam nähen.',
            description: 'Im Nähcafé Naumburg treffen sich Menschen, die Textilien upcyceln, Kleidung reparieren und aus Stofffunden neue Stücke schaffen. Wir nehmen gespendete Stoffe und Reste an.',
            website: '',
            email: 'naehcafe.naumburg@gmail.com',
            location_name: 'Naumburg',
            address: 'Markt 7, 06618 Naumburg (Saale)',
            latitude: 51.1519,
            longitude: 11.8096,
          },
        ];
        for (const a of actors) {
          insertActor.run(uuidv4(), a.name, a.type, a.tagline, a.description, a.website, a.email, a.location_name, a.address, a.latitude, a.longitude, sysUserId);
        }
        console.log('🌱 Seeded actor data.');
      };
      seedActors().catch(e => console.error('Actor seed failed:', e.message));
    }

    // Only seed if the DB is basically empty
    if (userCount > 0 || materialCount > 0 || inventoryCount > 0 || projectCount > 0) {
      return;
    }

    // eslint-disable-next-line no-inner-declarations
    const seed = async () => {
      const { v4: uuidv4 } = await import('uuid');

      const demoUserId = uuidv4();
      const demoEmail = process.env.DEMO_EMAIL || 'demo@local';
      // Placeholder sub for local dev seeding — real users come from Zitadel.
      const demoSub = process.env.DEMO_SUB || 'demo-local';
      const demoFirstName = process.env.DEMO_FIRST_NAME || 'Demo';
      const demoLastName = process.env.DEMO_LAST_NAME || 'User';

      db.prepare(
        `INSERT INTO users (id, zitadel_sub, email, first_name, last_name)
         VALUES (?, ?, ?, ?, ?)`
      ).run(demoUserId, demoSub, demoEmail, demoFirstName, demoLastName);

      const insertMaterial = db.prepare(
        `INSERT INTO materials (
          id, name, category, description, unit,
          gwp_value, gwp_unit, gwp_source,
          is_reusable, is_transferable, is_giftable,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const materials = [
        {
          name: 'Akustikmatte (Recycling-Filz)',
          category: 'Textiles',
          description: 'Schallabsorbierende Matte aus Recyclingfasern, ideal für Innenausbau und Akustikpaneele.',
          unit: 'm²',
          gwp_value: 2.4,
          gwp_unit: 'kg CO2e',
          gwp_source: 'Herstellerangabe (Demo)',
          is_reusable: 1,
          is_transferable: 1,
          is_giftable: 0,
        },
        {
          name: 'Recyceltes Holz (Bauholz)',
          category: 'Wood',
          description: 'Aufbereitetes Bauholz aus Rückbau, trocken gelagert und sortiert.',
          unit: 'm³',
          gwp_value: 0.9,
          gwp_unit: 'kg CO2e',
          gwp_source: 'EPD (Demo)',
          is_reusable: 1,
          is_transferable: 1,
          is_giftable: 1,
        },
        {
          name: 'Recycling-Stahl',
          category: 'Metals',
          description: 'Sekundärstahl für Konstruktionen, regional verfügbar.',
          unit: 'kg',
          gwp_value: 1.46,
          gwp_unit: 'kg CO2e',
          gwp_source: 'EPD Database (Demo)',
          is_reusable: 0,
          is_transferable: 1,
          is_giftable: 0,
        },
      ];

      const materialIds = [];
      for (const m of materials) {
        const id = uuidv4();
        materialIds.push(id);
        insertMaterial.run(
          id,
          m.name,
          m.category,
          m.description,
          m.unit,
          m.gwp_value,
          m.gwp_unit,
          m.gwp_source,
          m.is_reusable,
          m.is_transferable,
          m.is_giftable,
          demoUserId
        );
      }

      const insertInventory = db.prepare(
        `INSERT INTO inventory (
          id, user_id, material_id, quantity, unit,
          location_name, latitude, longitude, address,
          is_available, available_for_transfer, available_for_gift, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const inv = [
        {
          material_id: materialIds[0],
          quantity: 120,
          unit: 'm²',
          location_name: 'Zeitz (Demo-Lager)',
          latitude: 51.049,
          longitude: 12.135,
          address: 'Zeitz, Sachsen-Anhalt',
          available_for_transfer: 1,
          available_for_gift: 0,
          notes: 'Abholung nach Absprache. Zuschnitt möglich.',
        },
        {
          material_id: materialIds[1],
          quantity: 2.5,
          unit: 'm³',
          location_name: 'Dessau (Demo)',
          latitude: 51.835,
          longitude: 12.243,
          address: 'Dessau-Roßlau, Sachsen-Anhalt',
          available_for_transfer: 1,
          available_for_gift: 1,
          notes: 'Gute Qualität, sichtbare Patina.',
        },
      ];

      for (const i of inv) {
        insertInventory.run(
          uuidv4(),
          demoUserId,
          i.material_id,
          i.quantity,
          i.unit,
          i.location_name,
          i.latitude,
          i.longitude,
          i.address,
          1,
          i.available_for_transfer,
          i.available_for_gift,
          i.notes
        );
      }

      const projectId = uuidv4();
      db.prepare(
        `INSERT INTO projects (
          id, name, description, content,
          location_name, latitude, longitude, address,
          status, is_public, owner_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        projectId,
        'Akustik-Upgrade im Raum der Möglichkeiten',
        'Ein Demo-Projekt zur Verbesserung der Raumakustik mit Recycling-Filz.',
        'Kurzbericht (Demo): Montage von Akustikmatten, Messung vorher/nachher, Dokumentation.',
        'Zeitz (Demo)',
        51.049,
        12.135,
        'Zeitz, Sachsen-Anhalt',
        'active',
        1,
        demoUserId
      );

      // Link one material to the project
      db.prepare(
        `INSERT INTO project_materials (id, project_id, material_id, quantity, unit)
         VALUES (?, ?, ?, ?, ?)`
      ).run(uuidv4(), projectId, materialIds[0], 40, 'm²');

      console.log(`🌱 Seeded demo data. Login: ${demoEmail} / ${demoPass}`);
    };

    // Fire-and-forget seeding; DB is already connected.
    seed().catch((e) => console.error('Seed failed:', e.message));
  } catch (err) {
    console.error('Failed seeding demo data:', err.message);
  }
};
