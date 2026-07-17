import express from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { createFeatureRequest } from '../controllers/featureRequest.controller.js';

const router = express.Router();

// Anonymous submissions are allowed, so rate-limit by IP to curb spam/abuse.
const featureRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Zu viele Anfragen. Bitte versuche es später erneut.' },
});

router.post('/', featureRequestLimiter, optionalAuth, createFeatureRequest);

export default router;
