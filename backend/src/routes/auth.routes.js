/**
 * Auth Routes
 * Authentication endpoints with Swagger documentation
 */

import express from 'express';
import { register, login, getMe, updateMe } from '../controllers/auth.controller.js';
import protect from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/register',
  /*
    #swagger.tags = ['Authentication']
    #swagger.summary = 'Register a new user'
    #swagger.description = 'Create a new user account with email and password'
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: { type: 'string', format: 'email', example: 'user@example.com' },
              password: { type: 'string', minLength: 6, example: 'password123' },
              first_name: { type: 'string', example: 'John' },
              last_name: { type: 'string', example: 'Doe' }
            }
          }
        }
      }
    }
    #swagger.responses[201] = {
      description: 'User registered successfully',
      content: {
        "application/json": {
          schema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              token: { type: 'string' }
            }
          }
        }
      }
    }
    #swagger.responses[400] = { description: 'User already exists' }
  */
  (req, res) => register(req, res)
);

router.post('/login',
  /*
    #swagger.tags = ['Authentication']
    #swagger.summary = 'Login user'
    #swagger.description = 'Authenticate user and return JWT token'
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: { type: 'string', format: 'email', example: 'user@example.com' },
              password: { type: 'string', example: 'password123' }
            }
          }
        }
      }
    }
    #swagger.responses[200] = {
      description: 'Login successful',
      content: {
        "application/json": {
          schema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              token: { type: 'string' }
            }
          }
        }
      }
    }
    #swagger.responses[401] = { description: 'Invalid credentials' }
  */
  (req, res) => login(req, res)
);

router.get('/me', protect,
  /*
    #swagger.tags = ['Authentication']
    #swagger.summary = 'Get current user'
    #swagger.description = 'Get the currently authenticated user profile'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = {
      description: 'User profile',
      content: {
        "application/json": {
          schema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    }
    #swagger.responses[401] = { description: 'Unauthorized' }
  */
  (req, res) => getMe(req, res)
);

router.put('/me', protect,
  /*
    #swagger.tags = ['Authentication']
    #swagger.summary = 'Update current user'
    #swagger.description = 'Update the currently authenticated user profile'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            properties: {
              email: { type: 'string', format: 'email' },
              first_name: { type: 'string' },
              last_name: { type: 'string' }
            }
          }
        }
      }
    }
    #swagger.responses[200] = { description: 'Profile updated successfully' }
    #swagger.responses[401] = { description: 'Unauthorized' }
  */
  (req, res) => updateMe(req, res)
);

export default router;
