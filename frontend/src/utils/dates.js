/**
 * Date utilities for the RZZ Materialdatenbank.
 *
 * SQLite stores CURRENT_TIMESTAMP as "YYYY-MM-DD HH:MM:SS" in UTC without a
 * timezone marker. JavaScript's Date constructor is inconsistent about such
 * strings: V8/Chrome treats them as *local time*, Safari treats them as UTC.
 * The result: timestamps appear 2 h (CEST) too early in Chrome on German devices.
 *
 * parseDbDate() normalises any SQLite/ISO string to a proper UTC Date object
 * by appending 'T' and 'Z' when needed.
 */

/**
 * Parse a database timestamp string as UTC.
 * Accepts:
 *   "2026-05-04 09:34:14"        → treats as UTC (SQLite CURRENT_TIMESTAMP)
 *   "2026-05-04T09:34:14Z"       → already ISO UTC, no change
 *   "2026-05-04T09:34:14+02:00"  → keeps explicit offset
 * Returns a Date object, or null if the input is falsy/invalid.
 */
export function parseDbDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  // Already has timezone info → let Date handle it natively
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s);
  }
  // SQLite space-separated: "2026-05-04 09:34:14" → "2026-05-04T09:34:14Z"
  return new Date(s.replace(' ', 'T') + 'Z');
}

/**
 * Format a DB timestamp for display using German locale.
 * Falls back to '' on invalid input.
 */
export function formatDate(str, options) {
  const d = parseDbDate(str);
  if (!d || isNaN(d)) return '';
  return d.toLocaleDateString('de-DE', options);
}

export function formatDateTime(str, options) {
  const d = parseDbDate(str);
  if (!d || isNaN(d)) return '';
  return d.toLocaleString('de-DE', options);
}
