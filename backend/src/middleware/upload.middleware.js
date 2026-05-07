/**
 * File Upload Middleware
 * Multer configuration for image uploads and manufacturing file uploads
 */

import multer from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join, extname, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Absolute path: src/middleware/ → ../../uploads (project root)
const uploadDir = resolve(process.env.UPLOAD_PATH || join(__dirname, '../../uploads'));

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
ensureDir(uploadDir);

function makeStorage(entityType) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = join(uploadDir, entityType, req.params.id || 'general');
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${uuidv4()}${extname(file.originalname)}`);
    },
  });
}

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'), false);
};

const fileFilter = (req, file, cb) => {
  const allowedExt = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.svg', '.pdf',
    '.dxf', '.dwg',
    '.step', '.stp',
    '.stl', '.obj', '.3ds', '.igs', '.iges',
    '.zip', '.rar',
  ];
  const ext = extname(file.originalname).toLowerCase();
  if (allowedExt.includes(ext)) cb(null, true);
  else cb(new Error(`Unsupported file type: ${ext}`), false);
};

const upload = multer({
  storage: makeStorage('projects'),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

export const uploadMaterialImages = multer({
  storage: makeStorage('materials'),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

export const uploadMaterialFiles = multer({
  storage: makeStorage('material-files'),
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
});

export const uploadInventoryImages = multer({
  storage: makeStorage('inventory'),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

export const uploadInventoryFiles = multer({
  storage: makeStorage('inventory-files'),
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
});

export const uploadProjectFiles = multer({
  storage: makeStorage('project-files'),
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
});

export default upload;
