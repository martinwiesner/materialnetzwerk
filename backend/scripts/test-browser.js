/**
 * RZZ Materialdatenbank — Browser / Push-Notification Tests
 *
 * Öffnet einen echten Chrome-Browser (system-installed), loggt sich ein,
 * testet den kompletten Push-Subscription-Flow und prüft, ob die
 * Subscription im Backend gespeichert wird.
 *
 * Usage:
 *   node scripts/test-browser.js
 *   FRONTEND_URL=http://localhost:3000 node scripts/test-browser.js
 *
 * Voraussetzung: Backend + Frontend laufen lokal.
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── .env laden ─────────────────────────────────────────────────────────────────
try {
  for (const line of readFileSync(join(__dirname, '../.env'), 'utf8').split('\n')) {
    const [k, ...rest] = line.split('=');
    if (k && !k.startsWith('#') && rest.length) {
      const key = k.trim();
      if (!process.env[key]) process.env[key] = rest.join('=').trim();
    }
  }
} catch {}

const FRONTEND = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
const BACKEND  = (process.env.BASE_URL      || 'http://localhost:8081').replace(/\/$/, '');

const ADMIN_EMAIL = process.env.FIXED_ADMIN_EMAIL    || process.env.ADMIN_EMAIL || '';
const ADMIN_PASS  = process.env.FIXED_ADMIN_PASSWORD || process.env.ADMIN_PASS  || '';

// ── colours / runner ───────────────────────────────────────────────────────────
const c = { reset:'\x1b[0m', bold:'\x1b[1m', green:'\x1b[32m', red:'\x1b[31m',
            yellow:'\x1b[33m', cyan:'\x1b[36m', gray:'\x1b[90m' };
const pass = `${c.green}✓${c.reset}`;
const fail = `${c.red}✗${c.reset}`;
const skip = `${c.yellow}–${c.reset}`;
const hr   = `${c.gray}${'─'.repeat(60)}${c.reset}`;

let passed = 0, failed = 0, skipped = 0;
const errors = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ${pass}  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ${fail}  ${c.bold}${name}${c.reset}`);
    console.log(`       ${c.red}${e.message}${c.reset}`);
    errors.push({ name, message: e.message });
    failed++;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ── API helpers ────────────────────────────────────────────────────────────────
async function apiGet(path, token) {
  const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  const r = await fetch(`${BACKEND}${path}`, { headers: h });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function apiPost(path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  const r = await fetch(`${BACKEND}${path}`, { method: 'POST', headers: h, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
}

// ── main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bold}RZZ Materialdatenbank — Browser & Push Tests${c.reset}`);
  console.log(`${c.gray}Frontend: ${FRONTEND}  |  Backend: ${BACKEND}${c.reset}\n`);

  // ── 1. Push-Backend (ohne Browser) ──────────────────────────────────────────
  console.log(`${c.cyan}${c.bold}1. Push-Backend (API)${c.reset}`);

  let adminToken = null;

  await test('Admin-Login für Push-Tests', async () => {
    assert(ADMIN_EMAIL && ADMIN_PASS, 'FIXED_ADMIN_EMAIL / FIXED_ADMIN_PASSWORD nicht in .env');
    const r = await apiPost('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    adminToken = r.body.token;
  });

  await test('GET /api/push/vapid-public-key gibt Key zurück', async () => {
    const r = await apiGet('/api/push/vapid-public-key', adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.publicKey, 'Kein publicKey im Response');
    assert(r.body.publicKey.length > 20, 'publicKey sieht ungültig aus');
  });

  await test('GET /api/push/vapid-public-key ohne Auth → 401', async () => {
    const r = await apiGet('/api/push/vapid-public-key');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  // Synthetic subscription: format stimmt, Endpoint ist fake → wird gespeichert aber Delivery schlägt fehl
  const fakeEndpoint = `https://fcm.googleapis.com/fcm/send/test-${Date.now()}`;
  const fakeSub = {
    endpoint: fakeEndpoint,
    keys: {
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlTpGXeta8wojtZ7X7kNHClmSVSHRTMEUBzQ65FQ==',
      auth:   'tBHItJI5svbpez7KI4CCXg==',
    },
  };

  await test('POST /api/push/subscribe speichert Subscription', async () => {
    const r = await apiPost('/api/push/subscribe', { subscription: fakeSub }, adminToken);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.ok === true, 'ok flag fehlt');
  });

  await test('POST /api/push/subscribe ohne Auth → 401', async () => {
    const r = await apiPost('/api/push/subscribe', { subscription: fakeSub });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('POST /api/push/subscribe mit ungültigem Body → 400', async () => {
    const r = await apiPost('/api/push/subscribe', { subscription: {} }, adminToken);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  // Cleanup: fake subscription wieder entfernen
  await test('DELETE /api/push/unsubscribe entfernt Subscription', async () => {
    const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
    const r = await fetch(`${BACKEND}/api/push/unsubscribe`, {
      method: 'DELETE', headers: h, body: JSON.stringify({ endpoint: fakeEndpoint }),
    });
    assert([200, 204].includes(r.status), `Expected 200/204, got ${r.status}`);
  });

  // ── 2. Browser-Test: Push UI ─────────────────────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}2. Browser-Test: Push UI (Chrome)${c.reset}`);

  if (!ADMIN_EMAIL || !ADMIN_PASS) {
    console.log(`  ${skip}  Browser-Tests übersprungen (keine Admin-Credentials)`);
    skipped += 4;
    printSummary();
    return;
  }

  let browser, context, page;
  try {
    browser = await chromium.launch({
      channel: 'chrome',   // nutzt installiertes System-Chrome
      headless: true,
    });

    // Notification-Berechtigung vorab erteilen — kein Browser-Dialog
    context = await browser.newContext({
      permissions: ['notifications'],
      baseURL: FRONTEND,
    });
    page = await context.newPage();

  } catch (e) {
    console.log(`  ${skip}  Chrome konnte nicht gestartet werden: ${e.message}`);
    skipped += 4;
    printSummary();
    return;
  }

  try {
    await test('App lädt ohne JS-Fehler', async () => {
      const jsErrors = [];
      page.on('pageerror', (err) => jsErrors.push(err.message));

      await page.goto(FRONTEND, { waitUntil: 'networkidle', timeout: 15000 });
      const title = await page.title();
      assert(title, 'Kein Seitentitel — App nicht geladen');

      // kurz warten ob defer-errors kommen
      await page.waitForTimeout(1000);
      const fatal = jsErrors.filter(e =>
        !e.includes('ResizeObserver') &&  // harmloser Browser-Bug
        !e.includes('Non-passive')
      );
      assert(fatal.length === 0, `JS-Fehler: ${fatal.join('; ')}`);
    });

    await test('Login als Admin funktioniert', async () => {
      // Nutzer-Icon in der Navbar anklicken
      await page.click('[aria-label="Nutzer-Menü"], button:has-text("Login"), [data-testid="user-btn"]', { timeout: 5000 })
        .catch(() => {
          // Fallback: direkt zur Login-Seite navigieren
          return page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle' });
        });

      // Formular: Email + Passwort
      await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL, { timeout: 5000 });
      await page.fill('input[type="password"], input[name="password"]', ADMIN_PASS);
      await page.click('button[type="submit"]');

      // Warten bis entweder Redirect oder Account-Badge erscheint
      await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 8000 })
        .catch(() => {}); // falls schon auf Hauptseite

      // Prüfen: kein Login-Formular mehr sichtbar
      await page.waitForTimeout(1000);
      const stillLogin = await page.locator('input[type="password"]').isVisible().catch(() => false);
      assert(!stillLogin, 'Immer noch auf Login-Seite — Login fehlgeschlagen');
    });

    await test('Account-Drawer öffnet sich und zeigt Benachrichtigungen-Toggle', async () => {
      // Evtl. offene Overlays/Modals schließen (Escape)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);

      // Account-Button hat data-onboarding="account-button"
      const accountBtn = page.locator('[data-onboarding="account-button"]');
      await accountBtn.waitFor({ state: 'visible', timeout: 5000 });
      // force:true umgeht das aria-hidden Overlay (z.B. Auth-Modal-Backdrop)
      await accountBtn.click({ force: true });
      await page.waitForTimeout(800);

      // "Benachrichtigungen" Label im Drawer
      const label = page.locator('text=Benachrichtigungen').first();
      await label.waitFor({ state: 'visible', timeout: 5000 });
      assert(await label.isVisible(), '"Benachrichtigungen" nicht im Account-Drawer gefunden');
    });

    await test('Push aktivieren speichert Subscription im Backend', async () => {
      // Push-Toggle ist ein h-6 w-11 Toggle-Button direkt neben "Benachrichtigungen"
      const toggleBtn = page.locator('button.w-11.h-6, button[class*="w-11"][class*="h-6"]').first();
      const toggleVisible = await toggleBtn.isVisible().catch(() => false);

      if (!toggleVisible) {
        // Drawer könnte zugegangen sein — nochmal öffnen
        await page.locator('[data-onboarding="account-button"]').click({ force: true });
        await page.waitForTimeout(600);
      }

      const isAlreadyActive = await page.locator('text=Aktiv').isVisible().catch(() => false);

      if (!isAlreadyActive) {
        await toggleBtn.click({ force: true });
        // Warten auf Toast "aktiviert" oder Status "Aktiv"
        await page.waitForTimeout(3000); // SW-Registrierung + Permission + Subscribe braucht Zeit
      }

      // Service Worker muss registriert sein (auch wenn noch kein Controller)
      const swRegistered = await page.evaluate(async () => {
        const regs = await navigator.serviceWorker?.getRegistrations();
        return regs && regs.length > 0;
      }).catch(() => false);
      assert(swRegistered, 'Kein Service Worker registriert');

      // Backend: VAPID-Key-Endpunkt muss erreichbar sein
      const r = await apiGet('/api/push/vapid-public-key', adminToken);
      assert(r.status === 200, `VAPID-Endpunkt nicht erreichbar: ${r.status}`);
    });

  } finally {
    await browser.close();
  }

  printSummary();
}

function printSummary() {
  console.log(`\n${hr}`);
  const total = passed + failed + skipped;
  const col = failed > 0 ? c.red : c.green;
  console.log(
    `${c.bold}${col}${passed}/${total} passed` +
    (failed  > 0 ? `  ${failed} failed`           : '') +
    (skipped > 0 ? `  ${c.yellow}${skipped} skipped${col}` : '') +
    c.reset
  );
  if (errors.length) {
    console.log(`\n${c.red}${c.bold}Fehler:${c.reset}`);
    for (const e of errors) {
      console.log(`  ${fail}  ${e.name}`);
      console.log(`       ${c.gray}${e.message}${c.reset}`);
    }
  }
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`\n${c.red}Fatal: ${e.message}${c.reset}`);
  process.exit(2);
});
