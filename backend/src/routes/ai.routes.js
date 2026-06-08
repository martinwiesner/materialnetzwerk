import express from 'express';
import multer from 'multer';
import { analyzeImages } from '../controllers/ai.controller.js';
import protect from '../middleware/auth.middleware.js';

const router = express.Router();

const upload = multer({
  dest: '/tmp/ai-uploads/',
  limits: { fileSize: 25 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    const ext = file.originalname.split('.').pop().toLowerCase();
    const allowedExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'];
    (allowed.includes(file.mimetype) || allowedExt.includes(ext)) ? cb(null, true) : cb(new Error('Nur Bilder erlaubt'), false);
  },
});

router.post('/analyze', protect, upload.array('images', 4), analyzeImages);

export default router;
