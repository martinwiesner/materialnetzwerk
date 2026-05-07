/**
 * Message Routes
 * API routes for user-to-user messaging
 */

import { Router } from 'express';
import {
  getInbox,
  getSent,
  getUnreadCount,
  getMessage,
  sendMessage,
  markAsRead,
  markAllAsRead,
  deleteMessage,
  getConversation
} from '../controllers/message.controller.js';
import protect from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(protect);

// GET /api/messages/inbox - Get inbox messages
router.get('/inbox', getInbox);

// GET /api/messages/sent - Get sent messages
router.get('/sent', getSent);

// GET /api/messages/unread-count - Get unread message count
router.get('/unread-count', getUnreadCount);

// POST /api/messages/mark-all-read - Mark all as read
router.post('/mark-all-read', markAllAsRead);

// GET /api/messages/conversation/:userId - Get conversation with user
router.get('/conversation/:userId', getConversation);

// GET /api/messages/:id - Get single message
router.get('/:id', getMessage);

// POST /api/messages - Send a message
router.post('/', sendMessage);

// PUT /api/messages/:id/read - Mark message as read
router.put('/:id/read', markAsRead);

// DELETE /api/messages/:id - Delete message
router.delete('/:id', deleteMessage);

export default router;
