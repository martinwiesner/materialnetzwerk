-- Material Library Database Schema
-- SQLite Database

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- USER RELATIONSHIPS TABLE
-- For material sharing/transfer between users
-- ============================================
CREATE TABLE IF NOT EXISTS user_relationships (
    id TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
    relationship_type TEXT DEFAULT 'sharing' CHECK(relationship_type IN ('sharing', 'transfer')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(requester_id, receiver_id)
);

-- ============================================
-- MATERIALS TABLE
-- Core material database with metadata and GWP
-- ============================================
CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    short_description TEXT,

    -- Extended material details
    origin_acquisition TEXT,
    use_processing TEXT,
    use_indoor_outdoor TEXT,
    use_limitations TEXT,
    similar_material_ids TEXT,

    -- Technical data
    tech_thicknesses TEXT,
    tech_dimensions TEXT,
    tech_density TEXT,
    tech_flammability TEXT,
    tech_acoustics TEXT,
    tech_thermal_insulation TEXT,
    tech_compressive_strength TEXT,
    tech_tensile_strength TEXT,

    -- Sustainability
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
    
    -- Origin
    origin_source TEXT CHECK(origin_source IN ('primary','secondary_rückbau','secondary_überschuss','secondary_restposten') OR origin_source IS NULL),
    previous_use TEXT,

    -- Application limits
    use_indoor BOOLEAN DEFAULT 1,
    use_outdoor BOOLEAN DEFAULT 0,
    use_where TEXT,
    use_not_suitable TEXT,

    -- Certifications
    cert_epd BOOLEAN DEFAULT 0,
    cert_cradle_to_cradle BOOLEAN DEFAULT 0,
    cert_fsc_pefc BOOLEAN DEFAULT 0,
    
    -- Environmental Data
    gwp_value REAL DEFAULT 0,
    gwp_unit TEXT DEFAULT 'kg CO2e',
    gwp_source TEXT,
    
    -- Reusability flags
    is_reusable BOOLEAN DEFAULT 0,
    is_transferable BOOLEAN DEFAULT 0,
    is_giftable BOOLEAN DEFAULT 0,
    
    -- Ownership
    created_by TEXT NOT NULL,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- MATERIAL IMAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS material_images (
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
);

-- ============================================
-- MATERIAL FILES TABLE (manufacturing/technical files)
-- ============================================
CREATE TABLE IF NOT EXISTS material_files (
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
);

-- ============================================
-- PROJECTS TABLE
-- Blog-like articles showcasing material usage
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    content TEXT,              -- Main article content (markdown/HTML)

    -- Sustainability principles (JSON text)
    circular_principles TEXT,
    principles_sufficiency TEXT,
    principles_consistency TEXT,
    principles_efficiency TEXT,
    general_sustainability_principles TEXT,

    -- Optional geolocation (for map view)
    location_name TEXT,
    latitude REAL,
    longitude REAL,
    address TEXT,

    -- Project execution info
    time_effort TEXT,
    tools TEXT,
    steps TEXT,                -- JSON array of {title, text, image_id}

    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'completed', 'archived')),
    is_public BOOLEAN DEFAULT 0,
    owner_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- PROJECT FILES TABLE (manufacturing/technical files: DXF, STEP, STL, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS project_files (
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
);

-- ============================================
-- PROJECT IMAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS project_images (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    file_path TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    step_index INTEGER,
    step_caption TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ============================================
-- PROJECT MATERIALS TABLE (Junction)
-- Direct link between projects and materials
-- ============================================
CREATE TABLE IF NOT EXISTS project_materials (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    material_id TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    UNIQUE(project_id, material_id)
);

-- ============================================
-- INVENTORY TABLE
-- User material inventories with geolocation
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    material_id TEXT NOT NULL,
    quantity REAL DEFAULT 0,
    unit TEXT,
    
    -- Geolocation
    location_name TEXT,
    latitude REAL,
    longitude REAL,
    address TEXT,
    
    -- Availability flags
    is_available BOOLEAN DEFAULT 1,
    availability_mode TEXT DEFAULT 'negotiable',
    external_url TEXT,
    season_from TEXT,
    season_to TEXT,
    swap_possible BOOLEAN DEFAULT 0,
    swap_against TEXT,
    available_for_transfer BOOLEAN DEFAULT 0,
    available_for_gift BOOLEAN DEFAULT 0,
    notes TEXT,

    -- New fields: Logistics & Conditions
    min_order_quantity REAL,
    available_from_date TEXT,
    is_immediately_available BOOLEAN DEFAULT 1,
    is_regularly_available BOOLEAN DEFAULT 0,
    regular_availability_period TEXT,
    regular_availability_type TEXT CHECK(regular_availability_type IN ('yearly','monthly') OR regular_availability_type IS NULL),
    is_mobile BOOLEAN DEFAULT 0,
    contact_user_id TEXT,

    -- Pricing / Gegenwert
    value_type TEXT CHECK(value_type IN ('swap','free','loan','negotiable','fixed') OR value_type IS NULL),
    price REAL,
    price_unit TEXT,
    is_negotiable BOOLEAN DEFAULT 0,

    -- Transaction options (JSON array)
    transaction_options TEXT,
    -- Logistics options (JSON array)
    logistics_options TEXT,
    transport_costs TEXT,

    -- Condition
    condition TEXT CHECK(condition IN ('new','used','damaged','tested') OR condition IS NULL),
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

-- ============================================
-- INVENTORY IMAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_images (
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
);

-- ============================================
-- INVENTORY FILES TABLE (manufacturing/technical files)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_files (
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
);

-- ============================================
-- MATERIAL TRANSFERS TABLE
-- Records of material transfers/gifts between users
-- ============================================
CREATE TABLE IF NOT EXISTS material_transfers (
    id TEXT PRIMARY KEY,
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    material_id TEXT NOT NULL,
    inventory_id TEXT,
    quantity REAL NOT NULL,
    transfer_type TEXT NOT NULL CHECK(transfer_type IN ('transfer', 'gift')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'completed')),
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
);

-- ============================================
-- MESSAGES TABLE
-- User-to-user messaging about materials/inventory
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    inventory_id TEXT,
    subject TEXT,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_materials_created_by ON materials(created_by);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_material ON inventory(material_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_user ON material_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_user ON material_transfers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_user_relationships_requester ON user_relationships(requester_id);
CREATE INDEX IF NOT EXISTS idx_user_relationships_receiver ON user_relationships(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);

-- ============================================
-- TRIGGERS for updated_at
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_materials_timestamp 
AFTER UPDATE ON materials
BEGIN
    UPDATE materials SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_projects_timestamp 
AFTER UPDATE ON projects
BEGIN
    UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_inventory_timestamp 
AFTER UPDATE ON inventory
BEGIN
    UPDATE inventory SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_relationships_timestamp 
AFTER UPDATE ON user_relationships
BEGIN
    UPDATE user_relationships SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
