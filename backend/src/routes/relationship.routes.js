/**
 * Relationship Routes
 * User-to-user relationship endpoints with Swagger documentation
 */

import express from 'express';
import {
  getRelationships,
  getPendingRequests,
  getContacts,
  createRelationship,
  acceptRelationship,
  rejectRelationship,
  deleteRelationship,
  searchUsers
} from '../controllers/relationship.controller.js';
import protect from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', protect,
  /*
    #swagger.tags = ['Relationships']
    #swagger.summary = 'Get user relationships'
    #swagger.description = 'Retrieve all relationships for the current user'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['status'] = {
      in: 'query',
      description: 'Filter by status (pending, accepted, rejected)',
      type: 'string'
    }
    #swagger.parameters['relationship_type'] = {
      in: 'query',
      description: 'Filter by type (sharing, transfer)',
      type: 'string'
    }
    #swagger.responses[200] = {
      description: 'List of relationships'
    }
  */
  (req, res) => getRelationships(req, res)
);

router.get('/pending', protect,
  /*
    #swagger.tags = ['Relationships']
    #swagger.summary = 'Get pending requests'
    #swagger.description = 'Retrieve pending relationship requests (where user is receiver)'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = {
      description: 'List of pending relationship requests'
    }
  */
  (req, res) => getPendingRequests(req, res)
);

router.get('/contacts', protect,
  /*
    #swagger.tags = ['Relationships']
    #swagger.summary = 'Get contacts'
    #swagger.description = 'Retrieve accepted relationships (contacts for material sharing)'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = {
      description: 'List of contacts'
    }
  */
  (req, res) => getContacts(req, res)
);

router.get('/search', protect,
  /*
    #swagger.tags = ['Relationships']
    #swagger.summary = 'Search users'
    #swagger.description = 'Search for a user by email to create a relationship'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['email'] = {
      in: 'query',
      description: 'Email address to search',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = {
      description: 'User found',
      content: {
        "application/json": {
          schema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              first_name: { type: 'string' },
              last_name: { type: 'string' }
            }
          }
        }
      }
    }
    #swagger.responses[404] = { description: 'User not found' }
  */
  (req, res) => searchUsers(req, res)
);

router.post('/', protect,
  /*
    #swagger.tags = ['Relationships']
    #swagger.summary = 'Create relationship request'
    #swagger.description = 'Send a relationship request to another user by email'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            required: ['receiver_email'],
            properties: {
              receiver_email: { type: 'string', format: 'email', example: 'other@example.com' },
              relationship_type: { type: 'string', enum: ['sharing', 'transfer'], default: 'sharing' }
            }
          }
        }
      }
    }
    #swagger.responses[201] = { description: 'Relationship request created' }
    #swagger.responses[400] = { description: 'Relationship already exists or invalid request' }
    #swagger.responses[404] = { description: 'User not found' }
  */
  (req, res) => createRelationship(req, res)
);

router.put('/:id/accept', protect,
  /*
    #swagger.tags = ['Relationships']
    #swagger.summary = 'Accept relationship'
    #swagger.description = 'Accept a pending relationship request'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Relationship ID',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = { description: 'Relationship accepted' }
    #swagger.responses[400] = { description: 'Request already processed' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Relationship not found' }
  */
  (req, res) => acceptRelationship(req, res)
);

router.put('/:id/reject', protect,
  /*
    #swagger.tags = ['Relationships']
    #swagger.summary = 'Reject relationship'
    #swagger.description = 'Reject a pending relationship request'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Relationship ID',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = { description: 'Relationship rejected' }
    #swagger.responses[400] = { description: 'Request already processed' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Relationship not found' }
  */
  (req, res) => rejectRelationship(req, res)
);

router.delete('/:id', protect,
  /*
    #swagger.tags = ['Relationships']
    #swagger.summary = 'Delete relationship'
    #swagger.description = 'Delete a relationship (either party can delete)'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Relationship ID',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = { description: 'Relationship deleted' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Relationship not found' }
  */
  (req, res) => deleteRelationship(req, res)
);

export default router;
