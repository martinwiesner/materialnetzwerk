/**
 * Server Entry Point
 * Material Library API
 */

import app from './app.js';
import connectDB from './config/db.js';
import { loadEnv } from './config/env.js';
import { initPush } from './services/push.service.js';

// Load environment variables once (supports change.env / .env)
loadEnv();

const PORT = process.env.PORT || 8081;

connectDB().then(() => {
  initPush();
  app.listen(PORT, () => {
    console.log(`🚀 Material Library API running on port ${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
  });
});
