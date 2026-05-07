/**
 * Authentication Middleware
 * Validates Zitadel-issued JWT tokens via JWKS
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';
import User from '../models/user.model.js';

// Lazy-initialized so env vars are read after loadEnv() runs in server.js.
// (Module-level imports are resolved before the server.js body executes.)
let _jwks = null;
let _issuer = null;

function getJwks() {
  if (!_jwks) {
    const domain = process.env.ZITADEL_DOMAIN;
    if (!domain) throw new Error('ZITADEL_DOMAIN is not set');
    _issuer = `https://${domain}`;
    _jwks = createRemoteJWKSet(new URL(`https://${domain}/oauth/v2/keys`));
  }
  return { jwks: _jwks, issuer: _issuer };
}

async function verifyToken(token) {
  const { jwks, issuer } = getJwks();
  const { payload } = await jwtVerify(token, jwks, { issuer });
  return payload;
}

const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const claims = await verifyToken(token);
    const user = User.findOrCreateBySub(claims);

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Optional auth: if a valid bearer token is present, attach req.user.
// If no token is present (or token invalid), continue as anonymous.
export const optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();

  try {
    const claims = await verifyToken(token);
    const user = User.findOrCreateBySub(claims);
    if (user) req.user = user;
  } catch {
    // ignore invalid token for public reads
  }

  return next();
};

export default protect;
