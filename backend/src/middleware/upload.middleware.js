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
  if (allowed.includes(file.mimetype)) return cb(null, true);
  const ext = extname(file.originalname).toLowerCase();
  const isHeic = ext === '.heic' || ext === '.heif' || file.mimetype === 'image/heic' || file.mimetype === 'image/heif';
  const err = new Error(isHeic
    ? 'HEIC/HEIF-Fotos werden nicht unterstützt. Bitte beim Teilen "In JPEG konvertieren" wählen (iPhone: Einstellungen → Kamera → Formate → "Meistkompatibel"), oder JPEG/PNG/GIF/WebP hochladen.'
    : 'Ungültiger Dateityp. Nur JPEG, PNG, GIF und WebP sind erlaubt.');
  err.status = 400;
  cb(err, false);
};

const fileFilter = (req, file, cb) => {
  const allowedExt = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.svg', '.pdf',
    '.dxf', '.dwg',
    '.step', '.stp',
    '.stl', '.obj', '.3ds', '.igs', '.iges',
    '.glb', '.gltf',
    '.zip', '.rar',
    '.xlsx', '.xls',
  ];
  const ext = extname(file.originalname).toLowerCase();
  if (allowedExt.includes(ext)) return cb(null, true);
  const err = new Error(`Nicht unterstützter Dateityp: ${ext}`);
  err.status = 400;
  cb(err, false);
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

const glbFilter = (req, file, cb) => {
  const ext = extname(file.originalname).toLowerCase();
  if (ext === '.glb' || ext === '.gltf') cb(null, true);
  else cb(new Error('Only GLB/GLTF files are allowed for CAD preview.'), false);
};

export const uploadCadPreview = multer({
  storage: makeStorage('project-cad'),
  fileFilter: glbFilter,
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
});

export default upload;
