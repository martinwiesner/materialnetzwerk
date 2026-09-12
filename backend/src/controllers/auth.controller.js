/**
 * Auth Controller
 * Handles user authentication (register, login)
 */

import User from '../models/user.model.js';
import generateToken from '../utils/generateToken.js';

/**
 * Register a new user
 * @param {Object} req
 * @param {Object} res
 */
export const register = async (req, res) => {
  const { email, password, first_name, last_name } = req.body;
  
  try {
    // Check if user already exists
    const userExists = User.findByEmail(email);
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create new user
    const user = await User.create({ email, password, first_name, last_name });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: !!user.is_admin,
      },
      token: generateToken(user.id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

/**
 * Login user
 * @param {Object} req
 * @param {Object} res
 */
export const login = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Find user by email
    const user = User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await User.matchPassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: !!user.is_admin,
      },
      token: generateToken(user.id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

/**
 * Get current user profile
 * @param {Object} req
 * @param {Object} res
 */
export const getMe = (req, res) => {
  // req.user.is_admin comes straight from SQLite as an integer (0/1), not a real
  // boolean — normalise it here since this is what populates the frontend auth
  // store's `user.is_admin`, which flows into strict-boolean-typed contexts
  // (e.g. React Query's `enabled` option) further downstream.
  res.json({ ...req.user, is_admin: !!req.user.is_admin });
};

/**
 * Update current user profile
 * @param {Object} req
 * @param {Object} res
 */
export const updateMe = (req, res) => {
  const { first_name, last_name, email } = req.body;
  
  try {
    const updated = User.update(req.user.id, { first_name, last_name, email });
    const user = User.findByIdSecure(updated.id);
    res.json({ ...user, is_admin: !!user.is_admin });
  } catch (error) {
    res.status(500).json({ message: 'Update failed', error: error.message });
  }
};
