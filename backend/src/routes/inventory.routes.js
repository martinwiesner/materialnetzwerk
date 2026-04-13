/**
 * Inventory Routes
 * Inventory management and transfer endpoints with Swagger documentation
 */

import express from 'express';
import {
  getInventory,
  getAvailableInventory,
  getInventoryById,
  createInventory,
  updateInventory,
  deleteInventory,
  transferMaterial,
  giftMaterial,
  getTransfers,
  acceptTransfer,
  uploadInventoryImages,
  getInventoryImages,
  deleteInventoryImage,
  uploadInventoryFiles,
  getInventoryFiles,
  deleteInventoryFile,
} from '../controllers/inventory.controller.js';
import protect, { optionalAuth } from '../middleware/auth.middleware.js';
import { uploadInventoryImages as multerInvImages, uploadInventoryFiles as multerInvFiles } from '../middleware/upload.middleware.js';

const router = express.Router();

router.get('/', protect,
  /*
    #swagger.tags = ['Inventory']
    #swagger.summary = 'Get user inventory'
    #swagger.description = 'Retrieve all inventory entries for the current user'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['material_id'] = {
      in: 'query',
      description: 'Filter by material ID',
      type: 'string'
    }
    #swagger.parameters['is_available'] = {
      in: 'query',
      description: 'Filter by availability',
      type: 'boolean'
    }
    #swagger.parameters['available_for_transfer'] = {
      in: 'query',
      description: 'Filter by transfer availability',
      type: 'boolean'
    }
    #swagger.parameters['available_for_gift'] = {
      in: 'query',
      description: 'Filter by gift availability',
      type: 'boolean'
    }
    #swagger.responses[200] = {
      description: 'List of inventory entries',
      content: {
        "application/json": {
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/Inventory' }
          }
        }
      }
    }
  */
  (req, res) => getInventory(req, res)
);

router.get('/available', optionalAuth,
  /*
    #swagger.tags = ['Inventory']
    #swagger.summary = 'Get available inventory from other users'
    #swagger.description = 'Retrieve inventory available for transfer or gift from other users'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['transfer_only'] = {
      in: 'query',
      description: 'Only show items available for transfer',
      type: 'boolean'
    }
    #swagger.parameters['gift_only'] = {
      in: 'query',
      description: 'Only show items available as gifts',
      type: 'boolean'
    }
    #swagger.parameters['category'] = {
      in: 'query',
      description: 'Filter by material category',
      type: 'string'
    }
    #swagger.responses[200] = {
      description: 'List of available inventory from other users'
    }
  */
  (req, res) => getAvailableInventory(req, res)
);

router.get('/transfers', protect,
  /*
    #swagger.tags = ['Inventory']
    #swagger.summary = 'Get user transfers'
    #swagger.description = 'Retrieve all material transfers (incoming and outgoing)'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['type'] = {
      in: 'query',
      description: 'Filter by transfer direction (incoming, outgoing, all)',
      type: 'string',
      enum: ['incoming', 'outgoing', 'all']
    }
    #swagger.responses[200] = {
      description: 'List of material transfers'
    }
  */
  (req, res) => getTransfers(req, res)
);

router.get('/:id', protect,
  /*
    #swagger.tags = ['Inventory']
    #swagger.summary = 'Get inventory entry by ID'
    #swagger.description = 'Retrieve a specific inventory entry'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Inventory ID',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = {
      description: 'Inventory entry details'
    }
    #swagger.responses[404] = { description: 'Inventory entry not found' }
  */
  (req, res) => getInventoryById(req, res)
);

router.post('/', protect,
  /*
    #swagger.tags = ['Inventory']
    #swagger.summary = 'Create inventory entry'
    #swagger.description = 'Add a material to user inventory with quantity and location'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            required: ['material_id', 'quantity'],
            properties: {
              material_id: { type: 'string' },
              quantity: { type: 'number', example: 100 },
              unit: { type: 'string', example: 'kg' },
              location_name: { type: 'string', example: 'Main Warehouse' },
              latitude: { type: 'number', example: 52.52 },
              longitude: { type: 'number', example: 13.405 },
              address: { type: 'string', example: 'Berlin, Germany' },
              is_available: { type: 'boolean', default: true },
              available_for_transfer: { type: 'boolean', default: false },
              available_for_gift: { type: 'boolean', default: false },
              notes: { type: 'string' }
            }
          }
        }
      }
    }
    #swagger.responses[201] = {
      description: 'Inventory entry created successfully'
    }
    #swagger.responses[404] = { description: 'Material not found' }
  */
  (req, res) => createInventory(req, res)
);

router.put('/:id', protect,
  /*
    #swagger.tags = ['Inventory']
    #swagger.summary = 'Update inventory entry'
    #swagger.description = 'Update an existing inventory entry (owner only)'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Inventory ID',
      required: true,
      type: 'string'
    }
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            properties: {
              quantity: { type: 'number' },
              unit: { type: 'string' },
              location_name: { type: 'string' },
              latitude: { type: 'number' },
              longitude: { type: 'number' },
              address: { type: 'string' },
              is_available: { type: 'boolean' },
              available_for_transfer: { type: 'boolean' },
              available_for_gift: { type: 'boolean' },
              notes: { type: 'string' }
            }
          }
        }
      }
    }
    #swagger.responses[200] = { description: 'Inventory entry updated successfully' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Inventory entry not found' }
  */
  (req, res) => updateInventory(req, res)
);

router.delete('/:id', protect,
  /*
    #swagger.tags = ['Inventory']
    #swagger.summary = 'Delete inventory entry'
    #swagger.description = 'Delete an inventory entry (owner only)'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Inventory ID',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = { description: 'Inventory entry deleted successfully' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Inventory entry not found' }
  */
  (req, res) => deleteInventory(req, res)
);

router.post('/:id/transfer', protect,
  /*
    #swagger.tags = ['Inventory']
    #swagger.summary = 'Transfer materials'
    #swagger.description = 'Create a material transfer request to another user'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Inventory ID',
      required: true,
      type: 'string'
    }
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            required: ['to_user_id', 'quantity'],
            properties: {
              to_user_id: { type: 'string', description: 'Recipient user ID' },
              quantity: { type: 'number', example: 10 },
              message: { type: 'string', example: 'Transfer for Project X' }
            }
          }
        }
      }
    }
    #swagger.responses[201] = { description: 'Transfer request created' }
    #swagger.responses[400] = { description: 'Insufficient inventory or not available for transfer' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Inventory or target user not found' }
  */
  (req, res) => transferMaterial(req, res)
);

router.post('/:id/gift', protect,
  /*
    #swagger.tags = ['Inventory']
    #swagger.summary = 'Gift materials'
    #swagger.description = 'Create a material gift to another user'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Inventory ID',
      required: true,
      type: 'string'
    }
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            required: ['to_user_id', 'quantity'],
            properties: {
              to_user_id: { type: 'string', description: 'Recipient user ID' },
              quantity: { type: 'number', example: 5 },
              message: { type: 'string', example: 'Gift for your project' }
            }
          }
        }
      }
    }
    #swagger.responses[201] = { description: 'Gift created' }
    #swagger.responses[400] = { description: 'Insufficient inventory or not available for gifting' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Inventory or target user not found' }
  */
  (req, res) => giftMaterial(req, res)
);

router.post('/transfers/:transferId/accept', protect,
  /*
    #swagger.tags = ['Inventory']
    #swagger.summary = 'Accept transfer'
    #swagger.description = 'Accept a pending material transfer'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['transferId'] = {
      in: 'path',
      description: 'Transfer ID',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = { description: 'Transfer accepted and completed' }
    #swagger.responses[400] = { description: 'Transfer already processed' }
    #swagger.responses[404] = { description: 'Transfer not found' }
  */
  (req, res) => acceptTransfer(req, res)
);

export default router;

// Image routes
router.post('/:id/images', protect, multerInvImages.array('images', 10), (req, res) => uploadInventoryImages(req, res));
router.get('/:id/images', optionalAuth, (req, res) => getInventoryImages(req, res));
router.delete('/:id/images/:imageId', protect, (req, res) => deleteInventoryImage(req, res));

// File routes (manufacturing/technical data)
router.post('/:id/files', protect, multerInvFiles.array('files', 10), (req, res) => uploadInventoryFiles(req, res));
router.get('/:id/files', optionalAuth, (req, res) => getInventoryFiles(req, res));
router.delete('/:id/files/:fileId', protect, (req, res) => deleteInventoryFile(req, res));
