/**
 * Push Notification Service
 * Manages VAPID config, subscription storage, and sending push messages.
 */

import webpush from 'web-push';
import { getDB } from '../config/db.js';

// ── VAPID setup ───────────────────────────────────────────────────────────────

export function initPush() {
  const publicKey  = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject    = process.env.VAPID_SUBJECT || 'mailto:kontakt@rzz.de';

  if (!publicKey || !privateKey) {
    console.warn('⚠️  VAPID keys not set — push notifications disabled.');
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  ensurePushTable();
  console.log('🔔 Push notifications enabled.');
}

// ── DB table ──────────────────────────────────────────────────────────────────

function ensurePushTable() {
  const db = getDB();
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      endpoint    TEXT NOT NULL UNIQUE,
      p256dh      TEXT NOT NULL,
      auth        TEXT NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

// ── Subscription CRUD ─────────────────────────────────────────────────────────

export function saveSubscription(userId, subscription) {
  const db = getDB();
  const { endpoint, keys } = subscription;
  db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth
  `).run(userId, endpoint, keys.p256dh, keys.auth);
}

export function removeSubscription(endpoint) {
  const db = getDB();
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}

function getSubscriptionsForUser(userId) {
  const db = getDB();
  return db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
}

// ── Send ──────────────────────────────────────────────────────────────────────

export async function sendPushToUser(userId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return;

  const subs = getSubscriptionsForUser(userId);
  const payloadStr = JSON.stringify(payload);

  for (const sub of subs) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    try {
      await webpush.sendNotification(subscription, payloadStr);
    } catch (err) {
      // 410 Gone = subscription expired, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        removeSubscription(sub.endpoint);
      } else {
        console.error('Push send error:', err.message);
      }
    }
  }
}
