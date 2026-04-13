/**
 * Create or promote a user to admin (superuser).
 *
 * Usage:
 *   node scripts/create-admin.js <email> <password>
 *   node scripts/create-admin.js admin@example.com mySecret123
 *
 * If the user already exists, the password is ignored and the account is
 * promoted to admin.  If the user does not exist, it is created as admin.
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
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const [,, email, password] = process.argv;

if (!email) {
  console.error('Usage: node scripts/create-admin.js <email> [password]');
  process.exit(1);
}

const db = getDB();

const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

if (existing) {
  db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
  console.log(`✓ User "${email}" wurde zu Admin befördert.`);
} else {
  if (!password) {
    console.error('Neuer Benutzer: Bitte auch ein Passwort angeben.');
    process.exit(1);
  }
  const id = uuidv4();
  const hash = await bcrypt.hash(password, 10);
  db.prepare(
    `INSERT INTO users (id, email, password, first_name, last_name, is_admin)
     VALUES (?, ?, ?, 'Admin', 'User', 1)`
  ).run(id, email, hash);
  console.log(`✓ Admin-Benutzer erstellt: ${email}`);
}

process.exit(0);
