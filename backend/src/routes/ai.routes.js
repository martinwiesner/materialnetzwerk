import express from 'express';
import multer from 'multer';
import { analyzeImages } from '../controllers/ai.controller.js';
import protect from '../middleware/auth.middleware.js';

const router = express.Router();

const upload = multer({
  dest: '/tmp/ai-uploads/',
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Nur Bilder erlaubt'), false);
  },
});

router.post('/analyze', protect, upload.array('images', 4), analyzeImages);

export default router;
