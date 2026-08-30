/**
 * RZZ Materialdatenbank — API Smoke Tests
 *
 * Runs against a live backend (default http://localhost:8081).
 * Creates real test data, verifies behaviour, then cleans up.
 *
 * Usage:
 *   node scripts/test-api.js
 *   BASE_URL=https://your-server.de node scripts/test-api.js
 *
 * Requires Node 18+ (native fetch).
 */

// Load .env from backend root (same as the server does)
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = join(__dirname, '../.env');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...rest] = line.split('=');
    if (k && !k.startsWith('#') && rest.length) {
      const key = k.trim();
      if (!process.env[key]) process.env[key] = rest.join('=').trim();
    }
  }
} catch { /* no .env — rely on actual env vars */ }

const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');

// ── colours ────────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold:  '\x1b[1m',
  green: '\x1b[32m',
  red:   '\x1b[31m',
  yellow:'\x1b[33m',
  cyan:  '\x1b[36m',
  gray:  '\x1b[90m',
};
const pass  = `${c.green}✓${c.reset}`;
const fail  = `${c.red}✗${c.reset}`;
const skip  = `${c.yellow}–${c.reset}`;
const hr    = `${c.gray}${'─'.repeat(60)}${c.reset}`;

// ── test runner ────────────────────────────────────────────────────────────────
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

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────
async function req(method, path, body, token, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual', // don't follow redirects — treat 3xx as a response
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json, headers: res.headers };
}
const get    = (path, token)        => req('GET',    path, null,  token);
const getApi = (path, token)        => req('GET',    path, null,  token, { Accept: 'application/json' });
const post   = (path, body, token)  => req('POST',   path, body,  token);
const put    = (path, body, token)  => req('PUT',    path, body,  token);
const del    = (path, token)        => req('DELETE', path, null,  token);

// ── shared state (filled during tests) ────────────────────────────────────────
const ctx = {
  token:        null,
  adminToken:   null,
  userId:       null,
  materialId:   null,
  rzzId:        null,
  inventoryId:  null,
  projectId:    null,
  legacyProjectId: null,
  favoriteId:   null,
  tokenB:       null,
  userIdB:      null,
  privateProjectId: null,
  publicProjectId: null,
  privateMaterialId: null,
};

// Unique suffix so parallel runs don't collide
const SUFFIX = Date.now().toString(36);
const TEST_EMAIL    = `test_${SUFFIX}@rzz-test.invalid`;
const TEST_PASSWORD = `TestPass!${SUFFIX}`;
// Prefer FIXED_ADMIN_* (guaranteed to exist), fall back to ADMIN_EMAIL/ADMIN_PASS
const ADMIN_EMAIL = process.env.ADMIN_EMAIL_TEST
  || process.env.FIXED_ADMIN_EMAIL
  || process.env.ADMIN_EMAIL
  || '';
const ADMIN_PASS  = process.env.ADMIN_PASS_TEST
  || process.env.FIXED_ADMIN_PASSWORD
  || process.env.ADMIN_PASS
  || '';

// ──────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bold}RZZ Materialdatenbank — API Smoke Tests${c.reset}`);
  console.log(`${c.gray}Target: ${BASE}${c.reset}\n`);

  // ── 1. Infrastructure ──────────────────────────────────────────────────────
  console.log(`${c.cyan}${c.bold}1. Infrastructure${c.reset}`);
  await test('Health check returns ok', async () => {
    const r = await get('/health');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.status === 'ok', `Expected {status:"ok"}, got ${JSON.stringify(r.body)}`);
  });

  await test('Root endpoint returns API name', async () => {
    const r = await get('/');
    assert(r.status === 200);
    assert(r.body?.name, 'Missing name field');
  });

  // ── 2. Authentication ──────────────────────────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}2. Authentication${c.reset}`);

  await test('Register new user', async () => {
    const r = await post('/api/auth/register', {
      name: `Test User ${SUFFIX}`,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.token, 'Missing token');
    ctx.token  = r.body.token;
    ctx.userId = r.body.user?.id;
  });

  await test('Login returns token', async () => {
    const r = await post('/api/auth/login', { email: TEST_EMAIL, password: TEST_PASSWORD });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.token, 'Missing token in login response');
    ctx.token = r.body.token; // refresh
  });

  await test('GET /api/auth/me returns user', async () => {
    const r = await get('/api/auth/me', ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.email === TEST_EMAIL, 'email mismatch');
  });

  await test('Login with wrong password returns 401', async () => {
    const r = await post('/api/auth/login', { email: TEST_EMAIL, password: 'WrongPass999' });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('GET /api/auth/me without token returns 401', async () => {
    const r = await get('/api/auth/me');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('Register second user (for sharing/visibility tests)', async () => {
    const r = await post('/api/auth/register', {
      name: `Test User B ${SUFFIX}`,
      email: `test_b_${SUFFIX}@rzz-test.invalid`,
      password: TEST_PASSWORD,
    });
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    ctx.tokenB  = r.body.token;
    ctx.userIdB = r.body.user?.id;
  });

  // Admin login (optional — skip gracefully if no credentials)
  if (ADMIN_EMAIL && ADMIN_PASS) {
    await test('Admin login works', async () => {
      const r = await post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      ctx.adminToken = r.body.token;
    });
  } else {
    console.log(`  ${skip}  Admin login (set ADMIN_EMAIL + ADMIN_PASS to enable)`);
    skipped++;
  }

  // ── 3. Platform Settings ───────────────────────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}3. Platform Settings${c.reset}`);

  await test('GET /api/settings returns all keys (public)', async () => {
    const r = await get('/api/settings');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const required = ['platform_intro', 'guidelines_materials_yes', 'guidelines_materials_no'];
    for (const key of required) {
      assert(key in r.body, `Missing key: ${key}`);
    }
  });

  await test('PUT /api/settings without auth returns 401', async () => {
    const r = await put('/api/settings/platform_intro', { value: 'x' });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('PUT /api/settings as non-admin returns 403', async () => {
    const r = await put('/api/settings/platform_intro', { value: 'x' }, ctx.token);
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  if (ctx.adminToken) {
    await test('PUT /api/settings as admin updates value', async () => {
      const newVal = `Test intro ${SUFFIX}`;
      const r = await put('/api/settings/platform_intro', { value: newVal }, ctx.adminToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.body?.ok === true);
      // verify it reads back
      const r2 = await get('/api/settings');
      assert(r2.body.platform_intro === newVal, 'Value did not persist');
    });
  } else {
    console.log(`  ${skip}  PUT /api/settings as admin (needs ADMIN credentials)`);
    skipped++;
  }

  // ── 4. Materials ───────────────────────────────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}4. Materialien${c.reset}`);

  await test('GET /api/materials returns list (public)', async () => {
    const r = await get('/api/materials');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body) || Array.isArray(r.body?.data) || typeof r.body === 'object',
      'Expected array or paginated object');
  });

  await test('POST /api/materials creates material', async () => {
    const r = await post('/api/materials', {
      name: `Testmaterial ${SUFFIX}`,
      category: 'Holz',
      description: 'Automatisch erstelltes Testmaterial',
      status: 'draft',
      // Explicit: Material.create() defaults visibility to 'private' when omitted.
      // Later tests fetch this material anonymously, so it must be public on
      // purpose here — the dedicated private-material tests below cover the
      // private + sharing paths separately.
      visibility: 'public',
    }, ctx.token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.id, 'Missing id');
    ctx.materialId = r.body.id;
    ctx.rzzId      = r.body.rzz_id || r.body.material_id;
  });

  await test('GET /api/materials/:id returns material', async () => {
    const r = await get(`/api/materials/${ctx.materialId}`);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.id === ctx.materialId, 'id mismatch');
    assert(r.body?.name?.includes(SUFFIX), 'name mismatch');
  });

  await test('PUT /api/materials/:id updates material', async () => {
    const r = await put(`/api/materials/${ctx.materialId}`,
      { description: 'Aktualisierte Beschreibung' }, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.description === 'Aktualisierte Beschreibung', 'description not updated');
  });

  await test('PUT /api/materials/:id without auth returns 401', async () => {
    const r = await put(`/api/materials/${ctx.materialId}`, { description: 'x' });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  // ── 4b. Material visibility + edit-sharing ─────────────────────────────────
  // Mirrors 7d (projects) — canViewMaterial/canEditMaterial + /api/shares/material
  // already existed before today; this only re-verifies they still hold up.
  console.log(`\n${c.cyan}${c.bold}4b. Material-Sichtbarkeit & Freigaben${c.reset}`);

  await test('POST /api/materials creates a private material', async () => {
    const r = await post('/api/materials', {
      name: `Privates Testmaterial ${SUFFIX}`,
      visibility: 'private',
    }, ctx.token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    ctx.privateMaterialId = r.body.id;
  });

  await test('GET private material as anonymous returns 403', async () => {
    const r = await get(`/api/materials/${ctx.privateMaterialId}`);
    assert(r.status === 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('GET private material as unrelated user B returns 403', async () => {
    const r = await get(`/api/materials/${ctx.privateMaterialId}`, ctx.tokenB);
    assert(r.status === 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('GET private material as owner returns 200', async () => {
    const r = await get(`/api/materials/${ctx.privateMaterialId}`, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('POST /api/shares/material/:id shares with user B as view-only', async () => {
    const r = await post(`/api/shares/material/${ctx.privateMaterialId}`,
      { email: `test_b_${SUFFIX}@rzz-test.invalid`, access_level: 'view' }, ctx.token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('GET private material as view-shared user B now returns 200', async () => {
    const r = await get(`/api/materials/${ctx.privateMaterialId}`, ctx.tokenB);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('PUT private material as view-only user B returns 403 (view != edit)', async () => {
    const r = await put(`/api/materials/${ctx.privateMaterialId}`, { description: 'Sollte nicht klappen' }, ctx.tokenB);
    assert(r.status === 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('POST /api/shares/material/:id upgrades user B to edit access', async () => {
    const r = await post(`/api/shares/material/${ctx.privateMaterialId}`,
      { email: `test_b_${SUFFIX}@rzz-test.invalid`, access_level: 'edit' }, ctx.token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('PUT private material as edit-shared user B now returns 200', async () => {
    const r = await put(`/api/materials/${ctx.privateMaterialId}`, { description: 'Von User B bearbeitet' }, ctx.tokenB);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.description === 'Von User B bearbeitet', 'Edit did not persist');
  });

  await test('DELETE private material as edit-shared user B still returns 403 (edit != delete)', async () => {
    const r = await del(`/api/materials/${ctx.privateMaterialId}`, ctx.tokenB);
    assert(r.status === 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('DELETE /api/shares/material/:id/:userId revokes the share', async () => {
    const r = await del(`/api/shares/material/${ctx.privateMaterialId}/${ctx.userIdB}`, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('GET private material as user B after revoke returns 403 again', async () => {
    const r = await get(`/api/materials/${ctx.privateMaterialId}`, ctx.tokenB);
    assert(r.status === 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  // ── 5. RZZ-ID Resolver ────────────────────────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}5. RZZ-ID Resolver${c.reset}`);

  if (ctx.rzzId) {
    await test(`GET /api/id/${ctx.rzzId} returns JSON redirect`, async () => {
      const r = await getApi(`/api/id/${ctx.rzzId}`);
      assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
      assert(r.body?.redirect, 'Missing redirect field');
      assert(r.body.redirect.includes(ctx.materialId), 'redirect does not contain material id');
    });
  } else {
    console.log(`  ${skip}  RZZ-ID resolver (no rzz_id returned from material create)`);
    skipped++;
  }

  await test('GET /api/id/RZZ-INVALID-000 returns 404', async () => {
    const r = await get('/api/id/RZZ-INVALID-000');
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  // ── 6. Inventory ──────────────────────────────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}6. Inventar${c.reset}`);

  await test('POST /api/inventory creates entry', async () => {
    const r = await post('/api/inventory', {
      material_id:   ctx.materialId,
      status:        'available',
      quantity:      10,
      unit:          'm²',
      location_name: 'Testlager',
      address:       'Musterstraße 1, 06712 Zeitz',
    }, ctx.token);
    assert([200, 201].includes(r.status), `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.id, 'Missing id');
    ctx.inventoryId = r.body.id;
  });

  await test('GET /api/inventory/:id returns entry', async () => {
    const r = await get(`/api/inventory/${ctx.inventoryId}`);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.id === ctx.inventoryId, 'id mismatch');
  });

  await test('PUT /api/inventory/:id updates quantity', async () => {
    const r = await put(`/api/inventory/${ctx.inventoryId}`, { quantity: 5 }, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.quantity === 5, `Expected quantity 5, got ${r.body?.quantity}`);
  });

  // ── 7. Projects ───────────────────────────────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}7. Projekte${c.reset}`);

  await test('POST /api/projects creates project', async () => {
    const r = await post('/api/projects', {
      name: `Testprojekt ${SUFFIX}`,
      description: 'Automatisch erstelltes Testprojekt',
      status: 'draft',
      // Explicit: Project.create() defaults visibility to 'private' when omitted.
      // Later tests in this section fetch this project anonymously, so it must
      // be public on purpose — not relying on the (now-fixed) visibility bug.
      visibility: 'public',
      is_public: true,
    }, ctx.token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.id, 'Missing id');
    ctx.projectId = r.body.id;
  });

  await test('GET /api/projects/public returns list (no auth needed)', async () => {
    const r = await get('/api/projects/public');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body) || typeof r.body === 'object', 'Expected array or object');
  });

  await test('GET /api/projects/:id returns project', async () => {
    const r = await get(`/api/projects/${ctx.projectId}`);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.id === ctx.projectId, 'id mismatch');
  });

  // ── 7b. Project Contributors ──────────────────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}7b. Projektbeteiligte${c.reset}`);

  await test('Project without contributors has none set', async () => {
    const r = await get(`/api/projects/${ctx.projectId}`);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(!r.body?.contributors, `Expected no contributors, got ${r.body?.contributors}`);
  });

  const oneContributor = [{ first_name: 'Ada', last_name: 'Lovelace', organization: 'Test Org', role: 'Developer' }];
  await test('PUT /api/projects/:id adds one contributor', async () => {
    const r = await put(`/api/projects/${ctx.projectId}`, { contributors: oneContributor }, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    const stored = typeof r.body?.contributors === 'string' ? JSON.parse(r.body.contributors) : r.body?.contributors;
    assert(stored?.length === 1, `Expected 1 contributor, got ${JSON.stringify(stored)}`);
    assert(stored[0].first_name === 'Ada', 'first_name mismatch');
  });

  const twoContributors = [
    ...oneContributor,
    { first_name: 'Grace', last_name: 'Hopper', organization: '', role: 'Researcher' },
  ];
  await test('PUT /api/projects/:id adds a second contributor', async () => {
    const r = await put(`/api/projects/${ctx.projectId}`, { contributors: twoContributors }, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    const stored = typeof r.body?.contributors === 'string' ? JSON.parse(r.body.contributors) : r.body?.contributors;
    assert(stored?.length === 2, `Expected 2 contributors, got ${JSON.stringify(stored)}`);
  });

  await test('PUT /api/projects/:id edits a contributor', async () => {
    const edited = twoContributors.map(x => x.first_name === 'Grace' ? { ...x, role: 'Documentation' } : x);
    const r = await put(`/api/projects/${ctx.projectId}`, { contributors: edited }, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    const stored = typeof r.body?.contributors === 'string' ? JSON.parse(r.body.contributors) : r.body?.contributors;
    const grace = stored?.find(x => x.first_name === 'Grace');
    assert(grace?.role === 'Documentation', `Expected role 'Documentation', got ${grace?.role}`);
  });

  await test('PUT /api/projects/:id removes a contributor', async () => {
    const r = await put(`/api/projects/${ctx.projectId}`, { contributors: oneContributor }, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    const stored = typeof r.body?.contributors === 'string' ? JSON.parse(r.body.contributors) : r.body?.contributors;
    assert(stored?.length === 1, `Expected 1 contributor after removal, got ${JSON.stringify(stored)}`);
  });

  // ── 7c. Per-component licensing ───────────────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}7c. Lizenzierung (Hardware/Software/Documentation)${c.reset}`);

  await test('New project has no license set in any category', async () => {
    const r = await get(`/api/projects/${ctx.projectId}`);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(!r.body?.hardware_license && !r.body?.software_license && !r.body?.documentation_license,
      `Expected all license fields empty, got ${JSON.stringify({ hw: r.body?.hardware_license, sw: r.body?.software_license, doc: r.body?.documentation_license })}`);
  });

  await test('PUT sets only hardware_license', async () => {
    const r = await put(`/api/projects/${ctx.projectId}`, { hardware_license: 'CERN-OHL-S-2.0' }, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.hardware_license === 'CERN-OHL-S-2.0', `Got ${r.body?.hardware_license}`);
    assert(!r.body?.software_license && !r.body?.documentation_license, 'Other license fields should stay empty');
  });

  await test('PUT sets only software_license (independent of hardware_license)', async () => {
    const r = await put(`/api/projects/${ctx.projectId}`, { hardware_license: '', software_license: 'Apache-2.0' }, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.software_license === 'Apache-2.0', `Got ${r.body?.software_license}`);
  });

  await test('PUT sets only documentation_license', async () => {
    const r = await put(`/api/projects/${ctx.projectId}`, { software_license: '', documentation_license: 'CC-BY-4.0' }, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.documentation_license === 'CC-BY-4.0', `Got ${r.body?.documentation_license}`);
  });

  await test('PUT sets different hardware_license and software_license simultaneously', async () => {
    const r = await put(`/api/projects/${ctx.projectId}`, {
      hardware_license: 'CERN-OHL-W-2.0', software_license: 'GPL-3.0-only',
    }, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.hardware_license === 'CERN-OHL-W-2.0', `Got ${r.body?.hardware_license}`);
    assert(r.body?.software_license === 'GPL-3.0-only', `Got ${r.body?.software_license}`);
  });

  await test('PUT sets all three license categories at once', async () => {
    const r = await put(`/api/projects/${ctx.projectId}`, {
      hardware_license: 'CERN-OHL-P-2.0',
      software_license: 'MIT',
      documentation_license: 'CC-BY-SA-4.0',
    }, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.hardware_license === 'CERN-OHL-P-2.0', `Got ${r.body?.hardware_license}`);
    assert(r.body?.software_license === 'MIT', `Got ${r.body?.software_license}`);
    assert(r.body?.documentation_license === 'CC-BY-SA-4.0', `Got ${r.body?.documentation_license}`);
  });

  await test('POST /api/projects still accepts the legacy license field (backward compat)', async () => {
    const r = await post('/api/projects', {
      name: `Legacytest ${SUFFIX}`,
      license: 'MIT',
    }, ctx.token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.license === 'MIT', `Expected legacy license 'MIT', got ${r.body?.license}`);
    ctx.legacyProjectId = r.body.id;
    // Note: the DB-level backfill migration that splits legacy `license` values into
    // hardware_license/software_license/documentation_license runs once at server
    // startup (backfillProjectLicenses in db.js), not per-request — it was verified
    // separately against a real SQLite DB, not re-tested here since this script only
    // exercises the HTTP API.
  });

  // ── 7d. Project visibility + edit-sharing ──────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}7d. Projekt-Sichtbarkeit & Freigaben${c.reset}`);

  await test('POST /api/projects creates a private project', async () => {
    const r = await post('/api/projects', {
      name: `Privates Testprojekt ${SUFFIX}`,
      visibility: 'private',
    }, ctx.token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    ctx.privateProjectId = r.body.id;
  });

  await test('GET private project as anonymous returns 403', async () => {
    const r = await get(`/api/projects/${ctx.privateProjectId}`);
    assert(r.status === 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('GET private project as unrelated user B returns 403', async () => {
    const r = await get(`/api/projects/${ctx.privateProjectId}`, ctx.tokenB);
    assert(r.status === 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('GET private project as owner returns 200', async () => {
    const r = await get(`/api/projects/${ctx.privateProjectId}`, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.id === ctx.privateProjectId, 'id mismatch');
  });

  await test('POST /api/shares/project/:id shares with user B as view-only', async () => {
    const r = await post(`/api/shares/project/${ctx.privateProjectId}`,
      { email: `test_b_${SUFFIX}@rzz-test.invalid`, access_level: 'view' }, ctx.token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.access_level === 'view', `Expected access_level 'view', got ${r.body?.access_level}`);
  });

  await test('GET private project as view-shared user B now returns 200', async () => {
    const r = await get(`/api/projects/${ctx.privateProjectId}`, ctx.tokenB);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('PUT private project as view-only user B returns 403 (view != edit)', async () => {
    const r = await put(`/api/projects/${ctx.privateProjectId}`, { description: 'Sollte nicht klappen' }, ctx.tokenB);
    assert(r.status === 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('POST /api/shares/project/:id upgrades user B to edit access', async () => {
    const r = await post(`/api/shares/project/${ctx.privateProjectId}`,
      { email: `test_b_${SUFFIX}@rzz-test.invalid`, access_level: 'edit' }, ctx.token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.access_level === 'edit', `Expected access_level 'edit', got ${r.body?.access_level}`);
  });

  await test('PUT private project as edit-shared user B now returns 200', async () => {
    const r = await put(`/api/projects/${ctx.privateProjectId}`, { description: 'Von User B bearbeitet' }, ctx.tokenB);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.description === 'Von User B bearbeitet', 'Edit did not persist');
  });

  await test('DELETE private project as edit-shared user B still returns 403 (edit != delete)', async () => {
    const r = await del(`/api/projects/${ctx.privateProjectId}`, ctx.tokenB);
    assert(r.status === 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('DELETE /api/shares/project/:id/:userId revokes the share', async () => {
    const r = await del(`/api/shares/project/${ctx.privateProjectId}/${ctx.userIdB}`, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('GET private project as user B after revoke returns 403 again', async () => {
    const r = await get(`/api/projects/${ctx.privateProjectId}`, ctx.tokenB);
    assert(r.status === 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('GET public project as anonymous still returns 200 (no regression)', async () => {
    const created = await post('/api/projects', {
      name: `Öffentliches Testprojekt ${SUFFIX}`,
      visibility: 'public',
      is_public: true,
    }, ctx.token);
    assert(created.status === 201, `Setup failed: expected 201, got ${created.status}`);
    ctx.publicProjectId = created.body.id;
    const r = await get(`/api/projects/${ctx.publicProjectId}`);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  // ── 8. Favorites ──────────────────────────────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}8. Merkliste${c.reset}`);

  await test('POST /api/favorites adds material to favorites', async () => {
    const r = await post('/api/favorites', {
      entity_type: 'material',
      entity_id: ctx.materialId,
    }, ctx.token);
    assert([200, 201].includes(r.status), `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('GET /api/favorites/status returns isFavorited=true', async () => {
    const r = await get(`/api/favorites/status/material/${ctx.materialId}`, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const flagged = r.body?.isFavorited === true || r.body?.favorited === true;
    assert(flagged, `Expected isFavorited:true, got ${JSON.stringify(r.body)}`);
  });

  await test('DELETE /api/favorites removes material from favorites', async () => {
    const r = await del(`/api/favorites/material/${ctx.materialId}`, ctx.token);
    assert([200, 204].includes(r.status), `Expected 200/204, got ${r.status}`);
  });

  await test('GET /api/favorites/status after remove returns isFavorited=false', async () => {
    const r = await get(`/api/favorites/status/material/${ctx.materialId}`, ctx.token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const unflagged = r.body?.isFavorited === false || r.body?.favorited === false;
    assert(unflagged, `Expected isFavorited:false, got ${JSON.stringify(r.body)}`);
  });

  // ── 9. Material Requests ──────────────────────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}9. Materialanfragen${c.reset}`);

  await test('POST /api/requests creates request for inventory', async () => {
    const r = await post('/api/requests', {
      inventory_id: ctx.inventoryId,
      quantity: 2,
      unit: 'm²',
      message: 'Testrequest vom automatischen Testskript',
    }, ctx.token);
    // Owner can't request their own material → 400 or 403 is also acceptable
    assert([201, 400, 403].includes(r.status),
      `Expected 201/400/403, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  // ── 10. Actors ────────────────────────────────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}10. Akteure${c.reset}`);

  await test('GET /api/actors returns list (public)', async () => {
    const r = await get('/api/actors');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // ── 11. Cleanup ───────────────────────────────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}11. Aufräumen${c.reset}`);

  if (ctx.inventoryId) {
    await test('DELETE /api/inventory/:id removes entry', async () => {
      const r = await del(`/api/inventory/${ctx.inventoryId}`, ctx.token);
      assert([200, 204].includes(r.status), `Expected 200/204, got ${r.status}`);
    });
  }

  if (ctx.projectId) {
    await test('DELETE /api/projects/:id removes project', async () => {
      const r = await del(`/api/projects/${ctx.projectId}`, ctx.token);
      assert([200, 204].includes(r.status), `Expected 200/204, got ${r.status}`);
    });
  }

  if (ctx.legacyProjectId) {
    await test('DELETE /api/projects/:id removes legacy-license test project', async () => {
      const r = await del(`/api/projects/${ctx.legacyProjectId}`, ctx.token);
      assert([200, 204].includes(r.status), `Expected 200/204, got ${r.status}`);
    });
  }

  if (ctx.privateProjectId) {
    await test('DELETE /api/projects/:id removes private test project', async () => {
      const r = await del(`/api/projects/${ctx.privateProjectId}`, ctx.token);
      assert([200, 204].includes(r.status), `Expected 200/204, got ${r.status}`);
    });
  }

  if (ctx.publicProjectId) {
    await test('DELETE /api/projects/:id removes public test project', async () => {
      const r = await del(`/api/projects/${ctx.publicProjectId}`, ctx.token);
      assert([200, 204].includes(r.status), `Expected 200/204, got ${r.status}`);
    });
  }

  if (ctx.materialId) {
    await test('DELETE /api/materials/:id removes material', async () => {
      const r = await del(`/api/materials/${ctx.materialId}`, ctx.token);
      assert([200, 204].includes(r.status), `Expected 200/204, got ${r.status}`);
    });
  }

  if (ctx.privateMaterialId) {
    await test('DELETE /api/materials/:id removes private test material', async () => {
      const r = await del(`/api/materials/${ctx.privateMaterialId}`, ctx.token);
      assert([200, 204].includes(r.status), `Expected 200/204, got ${r.status}`);
    });
  }

  // Note: no account-deletion endpoint exists — test user stays in DB as orphaned data.
  // If this becomes a problem, add DELETE /api/auth/me to auth.routes.js.
  if (ctx.token) {
    console.log(`  ${skip}  Test account cleanup (no DELETE /api/auth/me endpoint)`);
    skipped++;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${hr}`);
  const total = passed + failed + skipped;
  const statusColor = failed > 0 ? c.red : c.green;
  console.log(
    `${c.bold}${statusColor}` +
    `${passed}/${total} passed` +
    `${failed > 0 ? `  ${failed} failed` : ''}` +
    `${skipped > 0 ? `  ${c.yellow}${skipped} skipped${statusColor}` : ''}` +
    c.reset
  );

  if (errors.length > 0) {
    console.log(`\n${c.red}${c.bold}Failed tests:${c.reset}`);
    for (const e of errors) {
      console.log(`  ${fail}  ${e.name}`);
      console.log(`       ${c.gray}${e.message}${c.reset}`);
    }
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`\n${c.red}Fatal error: ${e.message}${c.reset}`);
  console.error(e.stack);
  process.exit(2);
});
