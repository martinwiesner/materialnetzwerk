import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { readFileSync, existsSync, createWriteStream, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import logger from './utils/logger.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import materialRoutes from './routes/material.routes.js';
import projectRoutes from './routes/project.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import relationshipRoutes from './routes/relationship.routes.js';
import messageRoutes from './routes/message.routes.js';
import actorRoutes from './routes/actor.routes.js';
import pushRoutes from './routes/push.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve upload directory to absolute path (src/ → ../ → project root)
const UPLOAD_DIR = resolve(process.env.UPLOAD_PATH || join(__dirname, '../uploads'));
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Must be first — allows frontend dev server and production origin to access API + static files
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Allow any localhost origin and any configured FRONTEND_URL
  const allowed = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173',
    process.env.FRONTEND_URL,
  ].filter(Boolean);
  if (!origin || allowed.some(o => origin.startsWith(o)) || process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  // Allow images to be loaded cross-origin
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Logging Middleware
const logsDir = join(__dirname, '../logs');
if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
const accessLogStream = createWriteStream(join(logsDir, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files — absolute path, cross-origin allowed via header above
app.use('/uploads', express.static(UPLOAD_DIR));

// Routes
app.use('/api/auth',
  authRoutes
  // #swagger.tags = ['Authentication']
);

app.use('/api/materials',
  materialRoutes
  // #swagger.tags = ['Materials']
);

app.use('/api/projects',
  projectRoutes
  // #swagger.tags = ['Projects']
);

app.use('/api/inventory',
  inventoryRoutes
  // #swagger.tags = ['Inventory']
);

app.use('/api/relationships',
  relationshipRoutes
  // #swagger.tags = ['Relationships']
);

app.use('/api/messages',
  messageRoutes
  // #swagger.tags = ['Messages']
);

app.use('/api/actors', actorRoutes);
app.use('/api/push', pushRoutes);

// Swagger UI
const swaggerPath = join(__dirname, '../swagger-output.json');
if (existsSync(swaggerPath)) {
  const swaggerDocument = JSON.parse(readFileSync(swaggerPath, 'utf8'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} else {
  app.get('/api/docs', (req, res) => {
    res.json({ 
      message: 'Swagger documentation not generated yet. Run: npm run swagger',
      hint: 'After generating, restart the server to load the documentation.'
    });
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Material Library API',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/health'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

export default app;
