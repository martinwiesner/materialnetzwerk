// Forwards feature requests to OpenProject as work packages.
// Config priority: platform_settings DB (set via admin panel) → env vars.

import { getDB } from '../config/db.js';

function getConfig() {
  // Try DB first (admin-panel settings take precedence over env vars)
  try {
    const db = getDB();
    const rows = db.prepare(
      "SELECT key, value FROM platform_settings WHERE key IN ('openproject_url','openproject_api_key','openproject_project_id','openproject_type_id')"
    ).all();
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
    if (s.openproject_api_key) {
      return {
        url:       s.openproject_url        || process.env.OPENPROJECT_URL,
        apiKey:    s.openproject_api_key,
        projectId: s.openproject_project_id || process.env.OPENPROJECT_PROJECT_ID,
        typeId:    s.openproject_type_id    || process.env.OPENPROJECT_TYPE_ID,
      };
    }
  } catch { /* DB might not be ready yet — fall through to env */ }

  // Fall back to env vars
  return {
    url:       process.env.OPENPROJECT_URL,
    apiKey:    process.env.OPENPROJECT_API_KEY,
    projectId: process.env.OPENPROJECT_PROJECT_ID,
    typeId:    process.env.OPENPROJECT_TYPE_ID,
  };
}

export const isOpenProjectConfigured = () => {
  const c = getConfig();
  return Boolean(c.url && c.apiKey && c.projectId && c.typeId);
};

// Returns the created work package's id, or throws on failure.
export const createFeatureRequestWorkPackage = async ({ subject, description }) => {
  const c = getConfig();
  if (!c.url || !c.apiKey || !c.projectId || !c.typeId) {
    throw new Error('OpenProject ist nicht konfiguriert.');
  }

  const baseUrl = c.url.replace(/\/+$/, '');
  const auth = Buffer.from(`apikey:${c.apiKey}`).toString('base64');

  const res = await fetch(`${baseUrl}/api/v3/projects/${c.projectId}/work_packages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      subject,
      description: { format: 'markdown', raw: description },
      _links: { type: { href: `/api/v3/types/${c.typeId}` } },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenProject API antwortete mit ${res.status}: ${body.slice(0, 300)}`);
  }

  return (await res.json()).id;
};
