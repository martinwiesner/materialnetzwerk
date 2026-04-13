/**
 * Authentication Middleware
 * JWT token verification
 */

import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

const protect = async (req, res, next) => {
  let token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = User.findByIdSecure(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Optional auth: if a valid bearer token is present, attach req.user.
// If no token is present (or token invalid), continue as anonymous.
export const optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = User.findByIdSecure(decoded.id);
    if (user) req.user = user;
  } catch {
    // ignore invalid token for public reads
  }

  return next();
};

export default protect;
