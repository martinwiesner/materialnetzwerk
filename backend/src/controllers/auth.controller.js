/**
 * Auth Controller
 * User profile management (authentication handled by Zitadel)
 */

import User from '../models/user.model.js';

/**
 * Get current user profile
 * User is already resolved from the Zitadel JWT by auth.middleware.js
 */
export const getMe = (req, res) => {
  res.json(req.user);
};

/**
 * Update current user profile
 */
export const updateMe = (req, res) => {
  const { first_name, last_name, email } = req.body;

  try {
    const updated = User.update(req.user.id, { first_name, last_name, email });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Update failed', error: error.message });
  }
};
