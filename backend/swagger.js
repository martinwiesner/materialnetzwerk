/**
 * Swagger Auto-generation Script
 * Run with: npm run swagger
 */

import swaggerAutogen from 'swagger-autogen';
import dotenv from 'dotenv';

// Keep swagger generation working in local dev without requiring .env naming.
// Prefer change.env when present.
import { existsSync } from 'fs';
import path from 'path';
const cwd = process.cwd();
const changeEnv = path.resolve(cwd, 'change.env');
const dotEnv = path.resolve(cwd, '.env');
dotenv.config({ path: existsSync(changeEnv) ? changeEnv : dotEnv });

const doc = {
  info: {
    title: 'Material Library API',
    description: `
## Material Library Backend API

A comprehensive API for managing materials, projects, products, components, and inventories 
with environmental impact tracking (Global Warming Potential - GWP).

### Features
- **Material Database**: Create and manage materials with metadata and GWP values
- **Project Management**: Organize projects with products and components
- **Inventory Management**: Track material inventories with geolocation
- **Material Transfer**: Transfer or gift materials between users
- **User Relationships**: Connect with other users for material sharing

### Authentication
All endpoints except registration and login require a valid JWT token.
Include the token in the Authorization header: \`Bearer <token>\`
    `,
    version: '1.0.0',
    contact: {
      name: 'Material Library Support'
    }
  },
  servers: [
    {
      url: 'http://localhost:8081',
      description: 'Local Development'
    }
  ],
  consumes: ['application/json'],
  produces: ['application/json'],
  tags: [
    { name: 'Authentication', description: 'User registration and login' },
    { name: 'Materials', description: 'Material database management' },
    { name: 'Projects', description: 'Project management with image uploads' },
    { name: 'Products', description: 'Products within projects' },
    { name: 'Components', description: 'Components within products' },
    { name: 'Inventory', description: 'Material inventory and transfers' },
    { name: 'Relationships', description: 'User-to-user relationships for material sharing' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      Material: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          category: { type: 'string' },
          description: { type: 'string' },
          unit: { type: 'string', default: 'kg' },
          gwp_value: { type: 'number', description: 'Global Warming Potential per unit' },
          gwp_unit: { type: 'string', default: 'kg CO2e' },
          gwp_source: { type: 'string' },
          is_reusable: { type: 'boolean' },
          is_transferable: { type: 'boolean' },
          is_giftable: { type: 'boolean' },
          created_by: { type: 'string', format: 'uuid' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['active', 'archived', 'completed'] },
          owner_id: { type: 'string', format: 'uuid' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      ProjectImage: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          project_id: { type: 'string', format: 'uuid' },
          filename: { type: 'string' },
          original_name: { type: 'string' },
          mime_type: { type: 'string' },
          file_size: { type: 'integer' },
          file_path: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          project_id: { type: 'string', format: 'uuid' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      Component: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          product_id: { type: 'string', format: 'uuid' },
          quantity: { type: 'number' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      Inventory: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          material_id: { type: 'string', format: 'uuid' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          location_name: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          address: { type: 'string' },
          is_available: { type: 'boolean' },
          available_for_transfer: { type: 'boolean' },
          available_for_gift: { type: 'boolean' },
          notes: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      Transfer: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          from_user_id: { type: 'string', format: 'uuid' },
          to_user_id: { type: 'string', format: 'uuid' },
          material_id: { type: 'string', format: 'uuid' },
          inventory_id: { type: 'string', format: 'uuid' },
          quantity: { type: 'number' },
          transfer_type: { type: 'string', enum: ['transfer', 'gift'] },
          status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'completed'] },
          message: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          completed_at: { type: 'string', format: 'date-time' }
        }
      },
      UserRelationship: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          requester_id: { type: 'string', format: 'uuid' },
          receiver_id: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['pending', 'accepted', 'rejected'] },
          relationship_type: { type: 'string', enum: ['sharing', 'transfer'] },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      }
    }
  }
};

const outputFile = './swagger-output.json';
const endpointsFiles = ['./src/app.js'];

swaggerAutogen({ openapi: '3.0.0' })(outputFile, endpointsFiles, doc)
  .then(() => {
    console.log('✅ Swagger documentation generated successfully!');
    console.log(`📄 Output: ${outputFile}`);
  })
  .catch((err) => {
    console.error('❌ Error generating Swagger documentation:', err);
  });
