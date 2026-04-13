/**
 * User Relationship Controller
 * Handles user-to-user relationships for material sharing
 */

import UserRelationship from '../models/userRelationship.model.js';
import User from '../models/user.model.js';

/**
 * Get user's relationships
 * @param {Object} req
 * @param {Object} res
 */
export const getRelationships = (req, res) => {
  try {
    const { status, relationship_type } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (relationship_type) filters.relationship_type = relationship_type;

    const relationships = UserRelationship.findByUser(req.user.id, filters);
    res.json(relationships);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch relationships', error: error.message });
  }
};

/**
 * Get pending relationship requests
 * @param {Object} req
 * @param {Object} res
 */
export const getPendingRequests = (req, res) => {
  try {
    const requests = UserRelationship.findPendingRequests(req.user.id);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch pending requests', error: error.message });
  }
};

/**
 * Get user's contacts (accepted relationships)
 * @param {Object} req
 * @param {Object} res
 */
export const getContacts = (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    const contacts = UserRelationship.getContacts(req.user.id);
    // Prevent intermediary caches from serving other users' contacts
    res.set('Cache-Control', 'no-store');
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch contacts', error: error.message });
  }
};

/**
 * Create relationship request
 * @param {Object} req
 * @param {Object} res
 */
export const createRelationship = (req, res) => {
  try {
    const { receiver_email, relationship_type, userId } = req.body;

    let receiver;
    
    // Support creating relationship by userId if provided
    if (userId) {
      receiver = User.findById(userId);
    } else if (receiver_email) {
      // Find receiver by email
      receiver = User.findByEmail(receiver_email);
    }
    
    if (!receiver) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Can't create relationship with self
    if (receiver.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot create relationship with yourself' });
    }

    const relationship = UserRelationship.create({
      requester_id: req.user.id,
      receiver_id: receiver.id,
      relationship_type: relationship_type || 'sharing'
    });

    res.status(201).json(relationship);
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to create relationship', error: error.message });
  }
};

/**
 * Accept relationship request
 * @param {Object} req
 * @param {Object} res
 */
export const acceptRelationship = (req, res) => {
  try {
    const relationship = UserRelationship.findById(req.params.id);
    
    if (!relationship) {
      return res.status(404).json({ message: 'Relationship not found' });
    }

    // Only receiver can accept
    if (relationship.receiver_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to accept this request' });
    }

    if (relationship.status !== 'pending') {
      return res.status(400).json({ message: 'This request has already been processed' });
    }

    const updated = UserRelationship.updateStatus(req.params.id, 'accepted');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to accept relationship', error: error.message });
  }
};

/**
 * Reject relationship request
 * @param {Object} req
 * @param {Object} res
 */
export const rejectRelationship = (req, res) => {
  try {
    const relationship = UserRelationship.findById(req.params.id);
    
    if (!relationship) {
      return res.status(404).json({ message: 'Relationship not found' });
    }

    // Only receiver can reject
    if (relationship.receiver_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to reject this request' });
    }

    if (relationship.status !== 'pending') {
      return res.status(400).json({ message: 'This request has already been processed' });
    }

    const updated = UserRelationship.updateStatus(req.params.id, 'rejected');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject relationship', error: error.message });
  }
};

/**
 * Delete relationship
 * @param {Object} req
 * @param {Object} res
 */
export const deleteRelationship = (req, res) => {
  try {
    const relationship = UserRelationship.findById(req.params.id);
    
    if (!relationship) {
      return res.status(404).json({ message: 'Relationship not found' });
    }

    // Either party can delete
    if (relationship.requester_id !== req.user.id && relationship.receiver_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this relationship' });
    }

    UserRelationship.delete(req.params.id);
    res.json({ message: 'Relationship deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete relationship', error: error.message });
  }
};

/**
 * Search users by email
 * @param {Object} req
 * @param {Object} res
 */
export const searchUsers = (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ message: 'Email query parameter is required' });
    }

    // Use partial search instead of exact email match
    const users = User.search(email);
    
    // Filter out current user from results
    const filteredUsers = users.filter(user => user.id !== req.user.id);

    res.json(filteredUsers);
  } catch (error) {
    res.status(500).json({ message: 'Failed to search users', error: error.message });
  }
};
