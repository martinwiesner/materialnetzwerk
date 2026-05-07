/**
 * Push Notification Routes
 */

import { Router } from 'express';
import protect from '../middleware/auth.middleware.js';
import { saveSubscription, removeSubscription } from '../services/push.service.js';

const router = Router();
router.use(protect);

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'Push not configured' });
  res.json({ publicKey: key });
});

// POST /api/push/subscribe
router.post('/subscribe', (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }
    saveSubscription(req.user.id, subscription);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/push/unsubscribe
router.delete('/unsubscribe', (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) removeSubscription(endpoint);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
