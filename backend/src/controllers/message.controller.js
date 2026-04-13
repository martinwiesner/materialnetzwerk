/**
 * Message Controller
 * Handles user-to-user messaging
 */

import Message from '../models/message.model.js';
import User from '../models/user.model.js';
import Inventory from '../models/inventory.model.js';
import { sendPushToUser } from '../services/push.service.js';
import { sendNewMessageEmail } from '../services/email.service.js';

/**
 * Get user's inbox messages
 * @param {Object} req
 * @param {Object} res
 */
export const getInbox = (req, res) => {
  try {
    const { unread_only, limit } = req.query;
    const filters = {};
    if (unread_only === 'true') filters.unread_only = true;
    if (limit) filters.limit = parseInt(limit);

    const messages = Message.findInbox(req.user.id, filters);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch inbox', error: error.message });
  }
};

/**
 * Get user's sent messages
 * @param {Object} req
 * @param {Object} res
 */
export const getSent = (req, res) => {
  try {
    const messages = Message.findSent(req.user.id);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sent messages', error: error.message });
  }
};

/**
 * Get unread message count
 * @param {Object} req
 * @param {Object} res
 */
export const getUnreadCount = (req, res) => {
  try {
    const count = Message.getUnreadCount(req.user.id);
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get unread count', error: error.message });
  }
};

/**
 * Get single message
 * @param {Object} req
 * @param {Object} res
 */
export const getMessage = (req, res) => {
  try {
    const message = Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only sender or receiver can view
    if (message.sender_id !== req.user.id && message.receiver_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Mark as read if receiver is viewing
    if (message.receiver_id === req.user.id && !message.is_read) {
      Message.markAsRead(message.id);
      message.is_read = 1;
    }

    res.json(message);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch message', error: error.message });
  }
};

/**
 * Send a message
 * @param {Object} req
 * @param {Object} res
 */
export const sendMessage = (req, res) => {
  try {
    const { receiver_id, inventory_id, subject, content } = req.body;

    if (!receiver_id || !content) {
      return res.status(400).json({ message: 'Receiver and content are required' });
    }

    // Verify receiver exists
    const receiver = User.findById(receiver_id);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Can't message yourself
    if (receiver_id === req.user.id) {
      return res.status(400).json({ message: 'Cannot send message to yourself' });
    }

    // Verify inventory if provided
    if (inventory_id) {
      const inventory = Inventory.findById(inventory_id);
      if (!inventory) {
        return res.status(404).json({ message: 'Inventory item not found' });
      }
    }

    const message = Message.create({
      sender_id: req.user.id,
      receiver_id,
      inventory_id,
      subject,
      content
    });

    // Fire-and-forget: push + email notification to receiver
    const sender = User.findById(req.user.id);
    const senderName = sender?.first_name
      ? `${sender.first_name} ${sender.last_name || ''}`.trim()
      : sender?.email?.split('@')[0] || 'Jemand';

    const receiverName = receiver?.first_name
      ? `${receiver.first_name} ${receiver.last_name || ''}`.trim()
      : receiver?.email?.split('@')[0] || 'Nutzer';

    sendPushToUser(receiver_id, {
      title: `Neue Nachricht von ${senderName}`,
      body: subject || content.slice(0, 80),
      url: '/messages',
    }).catch(() => {});

    sendNewMessageEmail({
      toEmail: receiver.email,
      toName: receiverName,
      senderName,
      subject,
      preview: content.slice(0, 100),
      appUrl: process.env.APP_URL || 'http://localhost:3000',
    }).catch(() => {});

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
};

/**
 * Mark message as read
 * @param {Object} req
 * @param {Object} res
 */
export const markAsRead = (req, res) => {
  try {
    const message = Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only receiver can mark as read
    if (message.receiver_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updated = Message.markAsRead(req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark message as read', error: error.message });
  }
};

/**
 * Mark all messages as read
 * @param {Object} req
 * @param {Object} res
 */
export const markAllAsRead = (req, res) => {
  try {
    const count = Message.markAllAsRead(req.user.id);
    res.json({ message: 'Messages marked as read', count });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark messages as read', error: error.message });
  }
};

/**
 * Get conversation with another user
 * @param {Object} req
 * @param {Object} res
 */
export const getConversation = (req, res) => {
  try {
    const { userId } = req.params;

    // Verify other user exists
    const otherUser = User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const messages = Message.findConversation(req.user.id, userId);
    
    // Mark unread messages in this conversation as read
    messages.forEach(message => {
      if (message.receiver_id === req.user.id && !message.is_read) {
        Message.markAsRead(message.id);
      }
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch conversation', error: error.message });
  }
};

/**
 * Delete message
 * @param {Object} req
 * @param {Object} res
 */
export const deleteMessage = (req, res) => {
  try {
    const message = Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only sender or receiver can delete
    if (message.sender_id !== req.user.id && message.receiver_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    Message.delete(req.params.id);
    res.json({ message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete message', error: error.message });
  }
};
