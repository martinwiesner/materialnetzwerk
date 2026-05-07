/**
 * Promote an existing user to admin.
 *
 * The user must have logged in at least once via Zitadel so that a local
 * database row already exists.
 *
 * Usage:
 *   node scripts/create-admin.js <email>
 *   node scripts/create-admin.js admin@example.com
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend root
config({ path: resolve(__dirname, '../CHANGE.env') });
config({ path: resolve(__dirname, '../.env') });

// Import DB after env is loaded
const { getDB } = await import('../src/config/db.js');

const [,, email] = process.argv;

if (!email) {
  console.error('Usage: node scripts/create-admin.js <email>');
  process.exit(1);
}

const db = getDB();

const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

if (!existing) {
  console.error(`✗ No user found with email "${email}".`);
  console.error('  The user must log in via Zitadel at least once before being promoted.');
  process.exit(1);
}

db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
console.log(`✓ User "${email}" has been promoted to admin.`);

process.exit(0);
