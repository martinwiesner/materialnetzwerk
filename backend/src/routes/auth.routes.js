/**
 * Auth Routes
 * User profile endpoints — authentication is handled by Zitadel (OIDC)
 */

import express from 'express';
import { getMe, updateMe } from '../controllers/auth.controller.js';
import protect from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/me', protect,
  /*
    #swagger.tags = ['Authentication']
    #swagger.summary = 'Get current user'
    #swagger.description = 'Get the currently authenticated user profile (token issued by Zitadel)'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = {
      description: 'User profile',
      content: {
        "application/json": {
          schema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              zitadel_sub: { type: 'string' },
              email: { type: 'string' },
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              is_admin: { type: 'boolean' },
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
