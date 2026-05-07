/**
 * Environment loader & validator
 *
 * Goals:
 * - Make local dev predictable (support change.env, .env)
 * - Avoid double-loading dotenv in multiple modules
 * - Fail fast when required vars are missing
 */

import dotenv from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';

let loaded = false;

export function loadEnv() {
  if (loaded) return;

  // Priority:
  // 1) ENV_FILE (explicit)
  // 2) change.env (your current workflow)
  // 3) .env
  const cwd = process.cwd();
  const explicit = process.env.ENV_FILE ? path.resolve(cwd, process.env.ENV_FILE) : null;
  const changeEnv = path.resolve(cwd, 'change.env');
  const dotEnv = path.resolve(cwd, '.env');

  const candidates = [explicit, changeEnv, dotEnv].filter(Boolean);
  const chosen = candidates.find((p) => existsSync(p));

  if (chosen) {
    dotenv.config({ path: chosen });
  } else {
    // Still allow env vars from the host process
    dotenv.config();
  }

  // Fail-fast for required Zitadel vars.
  const required = ['ZITADEL_DOMAIN'];
  for (const k of required) {
    if (!process.env[k] || !String(process.env[k]).trim()) {
      throw new Error(
        `Missing env var ${k}. Create a .env (or change.env) in the backend root. See .env.example.`
      );
    }
  }

  loaded = true;
}
