/**
 * Project Routes
 * Project CRUD and image upload endpoints with Swagger documentation
 */

import express from 'express';
import {
  getProjects,
  getPublicProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  uploadImages,
  getImages,
  updateImage,
  deleteImage,
  addMaterial,
  removeMaterial,
  uploadProjectFiles,
  getProjectFiles,
  deleteProjectFile,
  getProjectActors,
  setProjectActors,
} from '../controllers/project.controller.js';
import protect, { optionalAuth } from '../middleware/auth.middleware.js';
import upload, { uploadProjectFiles as multerProjFiles } from '../middleware/upload.middleware.js';

const router = express.Router();

router.get('/public', optionalAuth,
  /*
    #swagger.tags = ['Projects']
    #swagger.summary = 'Get public projects'
    #swagger.description = 'Retrieve all public projects from other users (marketplace)'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['search'] = {
      in: 'query',
      description: 'Search in name and description',
      type: 'string'
    }
    #swagger.responses[200] = {
      description: 'List of public projects',
      content: {
        "application/json": {
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/Project' }
          }
        }
      }
    }
  */
  (req, res) => getPublicProjects(req, res)
);

router.get('/', protect,
  /*
    #swagger.tags = ['Projects']
    #swagger.summary = 'Get user projects'
    #swagger.description = 'Retrieve all projects owned by the current user'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['status'] = {
      in: 'query',
      description: 'Filter by status (active, archived, completed)',
      type: 'string'
    }
    #swagger.parameters['search'] = {
      in: 'query',
      description: 'Search in name and description',
      type: 'string'
    }
    #swagger.responses[200] = {
      description: 'List of projects',
      content: {
        "application/json": {
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/Project' }
          }
        }
      }
    }
  */
  (req, res) => getProjects(req, res)
);

router.get('/:id', optionalAuth,
  /*
    #swagger.tags = ['Projects']
    #swagger.summary = 'Get project by ID'
    #swagger.description = 'Retrieve a project with its products, images, and materials'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Project ID',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = {
      description: 'Project details with products and images'
    }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Project not found' }
  */
  (req, res) => getProjectById(req, res)
);

router.post('/', protect,
  /*
    #swagger.tags = ['Projects']
    #swagger.summary = 'Create a new project'
    #swagger.description = 'Create a new project'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', example: 'Office Building Renovation' },
              description: { type: 'string', example: 'Sustainable renovation project' },
              status: { type: 'string', enum: ['active', 'archived', 'completed'], default: 'active' }
            }
          }
        }
      }
    }
    #swagger.responses[201] = {
      description: 'Project created successfully',
      content: {
        "application/json": {
          schema: { $ref: '#/components/schemas/Project' }
        }
      }
    }
  */
  (req, res) => createProject(req, res)
);

router.put('/:id', protect,
  /*
    #swagger.tags = ['Projects']
    #swagger.summary = 'Update project'
    #swagger.description = 'Update an existing project (owner only)'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Project ID',
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
              description: { type: 'string' },
              status: { type: 'string', enum: ['active', 'archived', 'completed'] }
            }
          }
        }
      }
    }
    #swagger.responses[200] = { description: 'Project updated successfully' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Project not found' }
  */
  (req, res) => updateProject(req, res)
);

router.delete('/:id', protect,
  /*
    #swagger.tags = ['Projects']
    #swagger.summary = 'Delete project'
    #swagger.description = 'Delete a project and its associated images (owner only)'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Project ID',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = { description: 'Project deleted successfully' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Project not found' }
  */
  (req, res) => deleteProject(req, res)
);

// Image routes
router.post('/:id/images', protect, upload.array('images', 10),
  /*
    #swagger.tags = ['Projects']
    #swagger.summary = 'Upload project images'
    #swagger.description = 'Upload one or more images to a project (max 10 files)'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Project ID',
      required: true,
      type: 'string'
    }
    #swagger.requestBody = {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: 'object',
            properties: {
              images: {
                type: 'array',
                items: {
                  type: 'string',
                  format: 'binary'
                }
              }
            }
          }
        }
      }
    }
    #swagger.responses[201] = { description: 'Images uploaded successfully' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Project not found' }
  */
  (req, res) => uploadImages(req, res)
);

router.get('/:id/images', optionalAuth,
  /*
    #swagger.tags = ['Projects']
    #swagger.summary = 'Get project images'
    #swagger.description = 'Retrieve all images for a project'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Project ID',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = {
      description: 'List of project images',
      content: {
        "application/json": {
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/ProjectImage' }
          }
        }
      }
    }
  */
  (req, res) => getImages(req, res)
);

router.patch('/:id/images/:imageId', protect, (req, res) => updateImage(req, res));

router.delete('/:id/images/:imageId', protect,
  /*
    #swagger.tags = ['Projects']
    #swagger.summary = 'Delete project image'
    #swagger.description = 'Delete an image from a project (owner only)'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Project ID',
      required: true,
      type: 'string'
    }
    #swagger.parameters['imageId'] = {
      in: 'path',
      description: 'Image ID',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = { description: 'Image deleted successfully' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Project not found' }
  */
  (req, res) => deleteImage(req, res)
);

// Material routes for project
router.post('/:id/materials', protect,
  /*
    #swagger.tags = ['Projects']
    #swagger.summary = 'Add material to project'
    #swagger.description = 'Associate a material with a project'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Project ID',
      required: true,
      type: 'string'
    }
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            required: ['material_id'],
            properties: {
              material_id: { type: 'string' },
              quantity: { type: 'number', default: 1 },
              unit: { type: 'string' }
            }
          }
        }
      }
    }
    #swagger.responses[201] = { description: 'Material added to project' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Project not found' }
  */
  (req, res) => addMaterial(req, res)
);

router.delete('/:id/materials/:materialId', protect,
  /*
    #swagger.tags = ['Projects']
    #swagger.summary = 'Remove material from project'
    #swagger.description = 'Remove a material association from a project'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'Project ID',
      required: true,
      type: 'string'
    }
    #swagger.parameters['materialId'] = {
      in: 'path',
      description: 'Material ID',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = { description: 'Material removed from project' }
    #swagger.responses[403] = { description: 'Not authorized' }
    #swagger.responses[404] = { description: 'Project not found' }
  */
  (req, res) => removeMaterial(req, res)
);

export default router;

// Manufacturing file routes (DXF, STEP, STL, etc.)
router.post('/:id/files', protect, multerProjFiles.array('files', 10), (req, res) => uploadProjectFiles(req, res));
router.get('/:id/files', optionalAuth, (req, res) => getProjectFiles(req, res));
router.delete('/:id/files/:fileId', protect, (req, res) => deleteProjectFile(req, res));

// Actor association routes
router.get('/:id/actors', optionalAuth, (req, res) => getProjectActors(req, res));
router.put('/:id/actors', protect, (req, res) => setProjectActors(req, res));
