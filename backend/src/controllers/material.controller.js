/**
 * Material Controller
 * Handles material CRUD operations
 */

import Material from '../models/material.model.js';
import MaterialCategory from '../models/materialCategory.model.js';

const isAdmin = (u) => u?.is_admin === 1 || u?.is_admin === true;

/**
 * Get all materials
 * @param {Object} req
 * @param {Object} res
 */
export const getMaterials = (req, res) => {
  try {
    const { category, search, limit, offset, my_materials } = req.query;
    
    const filters = {};
    if (category) filters.category = category;
    if (search) filters.search = search;
    const parsedLimit = Number.parseInt(limit, 10);
    const parsedOffset = Number.parseInt(offset, 10);
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) filters.limit = parsedLimit;
    if (Number.isFinite(parsedOffset) && parsedOffset >= 0) filters.offset = parsedOffset;
    if (my_materials === 'true') {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required for my_materials filter' });
      }
      filters.created_by = req.user.id;
    }

    const materials = Material.findAll(filters);
    // count() ignores limit/offset, but we pass only the relevant filters anyway
    const total = Material.count({
      category: filters.category,
      created_by: filters.created_by,
    });

    res.json({
      data: materials,
      total,
      limit: filters.limit || materials.length,
      offset: filters.offset || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch materials', error: error.message });
  }
};

/**
 * Get material by ID
 * @param {Object} req
 * @param {Object} res
 */
export const getMaterialById = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }

    res.json(material);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch material', error: error.message });
  }
};

/**
 * Create new material
 * @param {Object} req
 * @param {Object} res
 */
export const createMaterial = (req, res) => {
  try {
    const materialData = {
      ...req.body,
      created_by: req.user.id
    };

    // Enforce predefined categories
    if (!materialData.category || !MaterialCategory.exists(materialData.category)) {
      return res.status(400).json({ message: 'Invalid category. Please select a predefined category.' });
    }

    const material = Material.create(materialData);
    res.status(201).json(material);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create material', error: error.message });
  }
};

/**
 * Update material
 * @param {Object} req
 * @param {Object} res
 */
export const updateMaterial = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }

    // Check ownership
    if (material.created_by !== req.user.id && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized to update this material' });
    }

    // Validate category if attempting to change it
    if (Object.prototype.hasOwnProperty.call(req.body, 'category')) {
      const newCategory = req.body.category;
      const currentCategory = material.category;
      // Allow keeping legacy value unchanged; enforce for changes
      const isChanging = newCategory !== currentCategory;
      if (isChanging && (!newCategory || !MaterialCategory.exists(newCategory))) {
        return res.status(400).json({ message: 'Invalid category. Please select a predefined category.' });
      }
    }

    const updated = Material.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    console.error('[updateMaterial] ERROR:', error.message, '\nBody keys:', Object.keys(req.body || {}));
    res.status(500).json({ message: 'Failed to update material', error: error.message });
  }
};

/**
 * Delete material
 * @param {Object} req
 * @param {Object} res
 */
export const deleteMaterial = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }

    // Check ownership
    if (material.created_by !== req.user.id && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized to delete this material' });
    }

    Material.delete(req.params.id);
    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete material', error: error.message });
  }
};

/**
 * Get material categories
 * @param {Object} req
 * @param {Object} res
 */
export const getCategories = (req, res) => {
  try {
    const categories = MaterialCategory.getAll();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
};

// ── Image endpoints ─────────────────────────────────────────────────────────

export const uploadMaterialImages = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (material.created_by !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Not authorized' });
    if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded' });
    const sortStart = parseInt(req.body.sort_start || '0', 10);
    const stepIndex = req.body.step_index !== undefined ? parseInt(req.body.step_index, 10) : null;
    const stepCaption = req.body.step_caption || null;
    const saved = req.files.map((file, i) => Material.addImage(req.params.id, file, sortStart + i, stepIndex, stepCaption));
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload images', error: error.message });
  }
};

export const getMaterialImages = (req, res) => {
  try {
    res.json(Material.getImages(req.params.id));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch images', error: error.message });
  }
};

export const deleteMaterialImage = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (material.created_by !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Not authorized' });
    Material.deleteImage(req.params.imageId);
    res.json({ message: 'Image deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete image', error: error.message });
  }
};

// ── File endpoints ──────────────────────────────────────────────────────────

export const uploadMaterialFilesCtrl = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (material.created_by !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Not authorized' });
    if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded' });
    const label = req.body.label || null;
    const saved = req.files.map(file => Material.addFile(req.params.id, file, label));
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload files', error: error.message });
  }
};

export const getMaterialFiles = (req, res) => {
  try {
    res.json(Material.getFiles(req.params.id));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch files', error: error.message });
  }
};

export const deleteMaterialFile = (req, res) => {
  try {
    const material = Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (material.created_by !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Not authorized' });
    Material.deleteFile(req.params.fileId);
    res.json({ message: 'File deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete file', error: error.message });
  }
};
