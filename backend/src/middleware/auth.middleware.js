/**
 * Authentication Middleware
 * Validates Zitadel-issued JWT tokens via JWKS
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';
import User from '../models/user.model.js';

const ZITADEL_DOMAIN = process.env.ZITADEL_DOMAIN;
const JWKS_URL = `https://${ZITADEL_DOMAIN}/oauth/v2/keys`;
const ISSUER = `https://${ZITADEL_DOMAIN}`;

const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

async function verifyToken(token) {
  const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER });
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
