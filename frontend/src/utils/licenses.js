// Central license definitions for project licensing (hardware / software / documentation).
// Values are SPDX identifiers wherever one exists — always stored/sent as `value`,
// only the `label` is shown in the UI.

export const LICENSE_CATEGORIES = ['hardware', 'software', 'documentation'];

export const LICENSE_OPTIONS = [
  // ── Hardware ──────────────────────────────────────────────────────────────
  { value: 'CERN-OHL-S-2.0', label: 'CERN OHL v2 – Strongly Reciprocal', category: 'hardware' },
  { value: 'CERN-OHL-W-2.0', label: 'CERN OHL v2 – Weakly Reciprocal', category: 'hardware' },
  { value: 'CERN-OHL-P-2.0', label: 'CERN OHL v2 – Permissive', category: 'hardware' },

  // ── Software ──────────────────────────────────────────────────────────────
  { value: 'MIT', label: 'MIT License', category: 'software' },
  { value: 'Apache-2.0', label: 'Apache License 2.0', category: 'software' },
  { value: 'GPL-3.0-only', label: 'GNU GPL v3.0', category: 'software' },
  { value: 'GPL-3.0-or-later', label: 'GNU GPL v3.0 (or later)', category: 'software' },
  { value: 'GPL-2.0-only', label: 'GNU GPL v2.0', category: 'software' },
  { value: 'GPL-2.0-or-later', label: 'GNU GPL v2.0 (or later)', category: 'software' },

  // ── Documentation ─────────────────────────────────────────────────────────
  { value: 'CC-BY-4.0', label: 'CC BY 4.0 – Namensnennung', category: 'documentation' },
  { value: 'CC-BY-SA-4.0', label: 'CC BY-SA 4.0 – Namensnennung + Weitergabe', category: 'documentation' },
  { value: 'CC-BY-NC-4.0', label: 'CC BY-NC 4.0 – Nicht kommerziell', category: 'documentation' },
  { value: 'CC-BY-NC-SA-4.0', label: 'CC BY-NC-SA 4.0 – Nicht kommerziell + Weitergabe', category: 'documentation' },
  { value: 'CC0-1.0', label: 'CC0 1.0 – Gemeinfrei', category: 'documentation' },

  // ── Kategorieübergreifend ────────────────────────────────────────────────
  { value: 'All-Rights-Reserved', label: 'Alle Rechte vorbehalten', category: null },
  { value: 'Other', label: 'Andere / Sonstige Lizenz', category: null },
];

export function licenseOptionsFor(category) {
  return LICENSE_OPTIONS.filter(o => o.category === category || o.category === null);
}

export function getLicenseLabel(value) {
  if (!value) return null;
  return LICENSE_OPTIONS.find(o => o.value === value)?.label || value;
}
