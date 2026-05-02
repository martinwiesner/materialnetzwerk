import { Router } from 'express';
import protect, { optionalAuth } from '../middleware/auth.middleware.js';
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  getFavoriteStatus,
} from '../controllers/favorite.controller.js';

const router = Router();

router.get('/', protect, getFavorites);
router.post('/', protect, addFavorite);
router.delete('/:entity_type/:entity_id', protect, removeFavorite);
router.get('/status/:entity_type/:entity_id', optionalAuth, getFavoriteStatus);

export default router;
