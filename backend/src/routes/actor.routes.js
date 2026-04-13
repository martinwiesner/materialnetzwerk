import { Router } from 'express';
import multer from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join, extname, resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import protect from '../middleware/auth.middleware.js';
import {
  getActors, getActor, createActor, updateActor, deleteActor,
  uploadActorImage, deleteActorImage,
  addActorLink, removeActorLink,
} from '../controllers/actor.controller.js';

const uploadDir = resolve(process.env.UPLOAD_PATH || './uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = join(uploadDir, 'actors', req.params.id || 'general');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images allowed'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

const router = Router();

router.get('/', getActors);
router.get('/:id', getActor);
router.post('/', protect, createActor);
router.put('/:id', protect, updateActor);
router.delete('/:id', protect, deleteActor);
router.post('/:id/images', protect, upload.array('images', 5), uploadActorImage);
router.delete('/:id/images/:imageId', protect, deleteActorImage);
router.post('/:id/links', protect, addActorLink);
router.delete('/:id/links/:linkId', protect, removeActorLink);

export default router;
