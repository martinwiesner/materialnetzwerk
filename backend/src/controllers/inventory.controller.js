/**
 * Inventory Controller
 * Handles inventory CRUD and transfer operations
 */

import Inventory from '../models/inventory.model.js';
import Material from '../models/material.model.js';
import User from '../models/user.model.js';
import UserRelationship from '../models/userRelationship.model.js';

/**
 * Get user's inventory
 * @param {Object} req
 * @param {Object} res
 */
export const getInventory = (req, res) => {
  try {
    const { material_id, is_available, available_for_transfer, available_for_gift } = req.query;
    const filters = {};
    if (material_id) filters.material_id = material_id;
    if (is_available !== undefined) filters.is_available = is_available === 'true';
    if (available_for_transfer !== undefined) filters.available_for_transfer = available_for_transfer === 'true';
    if (available_for_gift !== undefined) filters.available_for_gift = available_for_gift === 'true';

    const inventory = Inventory.findByUser(req.user.id, filters);
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch inventory', error: error.message });
  }
};

/**
 * Get available inventory from other users
 * @param {Object} req
 * @param {Object} res
 */
export const getAvailableInventory = (req, res) => {
  try {
    const { transfer_only, gift_only, category, search } = req.query;
    const filters = {};
    if (transfer_only === 'true') filters.transfer_only = true;
    if (gift_only === 'true') filters.gift_only = true;
    if (category) filters.category = category;
    if (search) filters.search = search;

    const excludeUserId = req.user?.id || '';
    const inventory = Inventory.findAvailable(excludeUserId, filters);
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch available inventory', error: error.message });
  }
};

/**
 * Get inventory entry by ID
 * @param {Object} req
 * @param {Object} res
 */
export const getInventoryById = (req, res) => {
  try {
    const inventory = Inventory.findById(req.params.id);
    
    if (!inventory) {
      return res.status(404).json({ message: 'Inventory entry not found' });
    }

    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch inventory entry', error: error.message });
  }
};

/**
 * Create inventory entry
 * @param {Object} req
 * @param {Object} res
 */
export const createInventory = (req, res) => {
  try {
    const { material_id } = req.body;

    // Verify material exists
    const material = Material.findById(material_id);
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }

    const inventoryData = {
      ...req.body,
      user_id: req.user.id
    };

    const inventory = Inventory.create(inventoryData);
    res.status(201).json(inventory);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create inventory entry', error: error.message });
  }
};

/**
 * Update inventory entry
 * @param {Object} req
 * @param {Object} res
 */
export const updateInventory = (req, res) => {
  try {
    const inventory = Inventory.findById(req.params.id);
    
    if (!inventory) {
      return res.status(404).json({ message: 'Inventory entry not found' });
    }

    // Check ownership
    if (inventory.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this inventory entry' });
    }

    const updated = Inventory.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update inventory entry', error: error.message });
  }
};

/**
 * Delete inventory entry
 * @param {Object} req
 * @param {Object} res
 */
export const deleteInventory = (req, res) => {
  try {
    const inventory = Inventory.findById(req.params.id);
    
    if (!inventory) {
      return res.status(404).json({ message: 'Inventory entry not found' });
    }

    // Check ownership
    if (inventory.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this inventory entry' });
    }

    Inventory.delete(req.params.id);
    res.json({ message: 'Inventory entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete inventory entry', error: error.message });
  }
};

/**
 * Transfer materials to another user
 * @param {Object} req
 * @param {Object} res
 */
export const transferMaterial = (req, res) => {
  try {
    const inventory = Inventory.findById(req.params.id);
    
    if (!inventory) {
      return res.status(404).json({ message: 'Inventory entry not found' });
    }

    // Check ownership
    if (inventory.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to transfer from this inventory' });
    }

    // Check if available for transfer
    if (!inventory.available_for_transfer) {
      return res.status(400).json({ message: 'This inventory is not available for transfer' });
    }

    const { to_user_id, quantity, message } = req.body;

    // Verify target user exists
    const targetUser = User.findByIdSecure(to_user_id);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    // Check quantity
    if (quantity > inventory.quantity) {
      return res.status(400).json({ message: 'Insufficient inventory quantity' });
    }

    const transfer = Inventory.transfer(req.params.id, to_user_id, quantity, 'transfer');
    res.status(201).json(transfer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create transfer', error: error.message });
  }
};

/**
 * Gift materials to another user
 * @param {Object} req
 * @param {Object} res
 */
export const giftMaterial = (req, res) => {
  try {
    const inventory = Inventory.findById(req.params.id);
    
    if (!inventory) {
      return res.status(404).json({ message: 'Inventory entry not found' });
    }

    // Check ownership
    if (inventory.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to gift from this inventory' });
    }

    // Check if available for gift
    if (!inventory.available_for_gift) {
      return res.status(400).json({ message: 'This inventory is not available for gifting' });
    }

    const { to_user_id, quantity, message } = req.body;

    // Verify target user exists
    const targetUser = User.findByIdSecure(to_user_id);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    // Check quantity
    if (quantity > inventory.quantity) {
      return res.status(400).json({ message: 'Insufficient inventory quantity' });
    }

    const transfer = Inventory.transfer(req.params.id, to_user_id, quantity, 'gift');
    res.status(201).json(transfer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create gift', error: error.message });
  }
};

/**
 * Get user's transfers (incoming and outgoing)
 * @param {Object} req
 * @param {Object} res
 */
export const getTransfers = (req, res) => {
  try {
    const { type } = req.query; // 'incoming', 'outgoing', or 'all'
    const transfers = Inventory.getTransfers(req.user.id, type || 'all');
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transfers', error: error.message });
  }
};

/**
 * Accept a transfer
 * @param {Object} req
 * @param {Object} res
 */
export const acceptTransfer = (req, res) => {
  try {
    const completed = Inventory.completeTransfer(req.params.transferId);
    res.json(completed);
  } catch (error) {
    res.status(500).json({ message: 'Failed to accept transfer', error: error.message });
  }
};

// ── Image endpoints ─────────────────────────────────────────────────────────

export const uploadInventoryImages = (req, res) => {
  try {
    const inventory = Inventory.findById(req.params.id);
    if (!inventory) return res.status(404).json({ message: 'Inventory entry not found' });
    if (inventory.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded' });

    const sortStart = parseInt(req.body.sort_start || '0', 10);
    const stepIndex = req.body.step_index !== undefined ? parseInt(req.body.step_index, 10) : null;
    const stepCaption = req.body.step_caption || null;

    const saved = req.files.map((file, i) => Inventory.addImage(req.params.id, file, sortStart + i, stepIndex, stepCaption));
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload images', error: error.message });
  }
};

export const getInventoryImages = (req, res) => {
  try {
    const images = Inventory.getImages(req.params.id);
    res.json(images);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch images', error: error.message });
  }
};

export const deleteInventoryImage = (req, res) => {
  try {
    const inventory = Inventory.findById(req.params.id);
    if (!inventory) return res.status(404).json({ message: 'Inventory entry not found' });
    if (inventory.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    Inventory.deleteImage(req.params.imageId);
    res.json({ message: 'Image deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete image', error: error.message });
  }
};

// ── File endpoints ──────────────────────────────────────────────────────────

export const uploadInventoryFiles = (req, res) => {
  try {
    const inventory = Inventory.findById(req.params.id);
    if (!inventory) return res.status(404).json({ message: 'Inventory entry not found' });
    if (inventory.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded' });
    const label = req.body.label || null;
    const saved = req.files.map(file => Inventory.addFile(req.params.id, file, label));
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload files', error: error.message });
  }
};

export const getInventoryFiles = (req, res) => {
  try {
    const files = Inventory.getFiles(req.params.id);
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch files', error: error.message });
  }
};

export const deleteInventoryFile = (req, res) => {
  try {
    const inventory = Inventory.findById(req.params.id);
    if (!inventory) return res.status(404).json({ message: 'Inventory entry not found' });
    if (inventory.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    Inventory.deleteFile(req.params.fileId);
    res.json({ message: 'File deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete file', error: error.message });
  }
};
