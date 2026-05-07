/**
 * Material Routes
 * Material CRUD endpoints with Swagger documentation
 */

import express from 'express';
import {
  getMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getCategories,
  uploadMaterialImages,
  getMaterialImages,
  deleteMaterialImage,
  uploadMaterialFilesCtrl,
  getMaterialFiles,
  deleteMaterialFile,
  getMaterialActors,
  setMaterialActors,
} from '../controllers/material.controller.js';
import protect, { optionalAuth } from '../middleware/auth.middleware.js';
import { uploadMaterialImages as multerMatImages, uploadMaterialFiles as multerMatFiles } from '../middleware/upload.middleware.js';

const router = express.Router();

router.get('/', optionalAuth,
  /*
    #swagger.tags = ['Materials']
    #swagger.summary = 'Get all materials'
    #swagger.description = 'Retrieve all materials with optional filtering'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['category'] = {
      in: 'query',
      description: 'Filter by category',
      type: 'string'
    }
    #swagger.parameters['search'] = {
      in: 'query',
      description: 'Search in name and description',
      type: 'string'
    }
    #swagger.parameters['my_materials'] = {
      in: 'query',
      description: 'Only show materials created by current user',
      type: 'boolean'
    }
    #swagger.parameters['limit'] = {
      in: 'query',
      description: 'Limit number of results',
      type: 'integer'
    }
    #swagger.parameters['offset'] = {
      in: 'query',
      description: 'Offset for pagination',
      type: 'integer'
    }
    #swagger.responses[200] = {
      description: 'List of materials',
      content: {
        "application/json": {
          schema: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: '#/components/schemas/Material' }
              },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' }
            }
          }
        }
      }
    }
  */
  (req, res) => getMaterials(req, res)
);

router.get('/categories', optionalAuth,
  /*
    #swagger.tags = ['Materials']
    #swagger.summary = 'Get material categories'
    #swagger.description = 'Get list of predefined material categories'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = {
      description: 'List of categories',
      content: {
        "application/json": {
          schema: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  */
  (req, res) => getCategories(req, res)
);

router.get('/:id', optionalAuth,
  /*
    #swagger.tags = ['Materials']
    #swagger.summary = 'Get material by ID'
    #swagger.description = 'Retrieve a specific material by its ID'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Material ID',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = {
      description: 'Material details',
      content: {
        "application/json": {
          schema: { $ref: '#/components/schemas/Material' }
        }
      }
    }
    #swagger.responses[404] = { description: 'Material not found' }
  */
  (req, res) => getMaterialById(req, res)
);

router.post('/', protect,
  /*
    #swagger.tags = ['Materials']
    #swagger.summary = 'Create a new material'
    #swagger.description = 'Create a new material with metadata and GWP values'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', example: 'Recycled Steel' },
              category: { type: 'string', example: 'Metals' },
              description: { type: 'string', example: 'High-quality recycled steel' },
              unit: { type: 'string', example: 'kg', default: 'kg' },
              gwp_value: { type: 'number', example: 1.46, description: 'Global Warming Potential per unit' },
              gwp_unit: { type: 'string', example: 'kg CO2e', default: 'kg CO2e' },
              gwp_source: { type: 'string', example: 'EPD Database' },
              is_reusable: { type: 'boolean', default: false },
              is_transferable: { type: 'boolean', default: false },
              is_giftable: { type: 'boolean', default: false }
            }
          }
        }
      }
    }
    #swagger.responses[201] = {
      description: 'Material created successfully',
      content: {
        "application/json": {
          schema: { $ref: '#/components/schemas/Material' }
        }
      }
    }
  */
  (req, res) => createMaterial(req, res)
);

router.put('/:id', protect,
  /*
    #swagger.tags = ['Materials']
    #swagger.summary = 'Update material'
    #swagger.description = 'Update an existing material (owner only)'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Material ID',
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
              name: { type: 'string' },
              category: { type: 'string' },
              description: { type: 'string' },
              unit: { type: 'string' },
              gwp_value: { type: 'number' },
              gwp_unit: { type: 'string' },
              gwp_source: { type: 'string' },
              is_reusable: { type: 'boolean' },
              is_transferable: { type: 'boolean' },
              is_giftable: { type: 'boolean' }
            }
          }
        }
      }
    }
    #swagger.responses[200] = { description: 'Material updated successfully' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Material not found' }
  */
  (req, res) => updateMaterial(req, res)
);

router.delete('/:id', protect,
  /*
    #swagger.tags = ['Materials']
    #swagger.summary = 'Delete material'
    #swagger.description = 'Delete a material (owner only)'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Material ID',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = { description: 'Material deleted successfully' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Material not found' }
  */
  (req, res) => deleteMaterial(req, res)
);

export default router;

// Image routes
router.post('/:id/images', protect, multerMatImages.array('images', 10), (req, res) => uploadMaterialImages(req, res));
router.get('/:id/images', optionalAuth, (req, res) => getMaterialImages(req, res));
router.delete('/:id/images/:imageId', protect, (req, res) => deleteMaterialImage(req, res));

// File routes (manufacturing/technical data)
router.post('/:id/files', protect, multerMatFiles.array('files', 10), (req, res) => uploadMaterialFilesCtrl(req, res));
router.get('/:id/files', optionalAuth, (req, res) => getMaterialFiles(req, res));
router.delete('/:id/files/:fileId', protect, (req, res) => deleteMaterialFile(req, res));

// Actor association routes
router.get('/:id/actors', optionalAuth, (req, res) => getMaterialActors(req, res));
router.put('/:id/actors', protect, (req, res) => setMaterialActors(req, res));
