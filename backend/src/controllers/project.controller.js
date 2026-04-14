/**
 * Project Controller
 * Handles project CRUD operations and image uploads
 */

import Project from '../models/project.model.js';
import { getDB } from '../config/db.js';
import { unlinkSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Convert web path /uploads/... to filesystem path
function webPathToFs(webPath = '') {
  if (!webPath) return null;
  // webPath is like /uploads/projects/abc.jpg
  // uploads dir is at backend root (two levels up from src/controllers)
  const uploadsRoot = resolve(__dirname, '../../uploads');
  const rel = webPath.replace(/^\/uploads\//, '');
  return resolve(uploadsRoot, rel);
}

const isAdmin = (user) => user?.is_admin === 1 || user?.is_admin === true;

/**
 * Get projects
 * IMPORTANT: This endpoint is intentionally public.
 */
export const getProjects = (req, res) => {
  try {
    const { status, search, my_projects, is_available } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (search) filters.search = search;
    if (is_available === 'true') filters.is_available = true;

    if (my_projects === 'true') {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required for my_projects filter' });
      }
      const projects = Project.findByUser(req.user.id, filters);
      return res.json(projects);
    }

    const projects = Project.findAll(filters);
    return res.json(projects);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch projects', error: error.message });
  }
};

export const getPublicProjects = (req, res) => {
  try {
    const { status, search, limit } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (search) filters.search = search;
    if (limit) filters.limit = parseInt(limit);
    const projects = Project.findAll(filters);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch public projects', error: error.message });
  }
};

export const getProjectById = (req, res) => {
  try {
    const project = Project.findByIdWithDetails(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch project', error: error.message });
  }
};

export const createProject = (req, res) => {
  try {
    const { materials, ...projectFields } = req.body;
    const projectData = { ...projectFields, owner_id: req.user.id };
    const project = Project.create(projectData);

    if (materials && Array.isArray(materials)) {
      for (const mat of materials) {
        if (mat.material_id) {
          Project.addMaterial(project.id, mat.material_id, mat.quantity || 1, mat.unit || null);
        }
      }
    }

    res.status(201).json(Project.findByIdWithDetails(project.id));
  } catch (error) {
    res.status(500).json({ message: 'Failed to create project', error: error.message });
  }
};

export const updateProject = (req, res) => {
  try {
    const project = Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner_id !== req.user.id && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized to update this project' });
    }

    const { materials, ...projectFields } = req.body;
    Project.update(req.params.id, projectFields);

    if (materials && Array.isArray(materials)) {
      const currentMaterials = Project.findByIdWithDetails(req.params.id).materials || [];
      const newMaterialIds = materials.map(m => m.material_id).filter(Boolean);

      for (const mat of currentMaterials) {
        if (!newMaterialIds.includes(mat.material_id)) {
          Project.removeMaterial(req.params.id, mat.material_id);
        }
      }
      for (const mat of materials) {
        if (mat.material_id) {
          Project.addMaterial(req.params.id, mat.material_id, mat.quantity || 1, mat.unit || null);
        }
      }
    }

    res.json(Project.findByIdWithDetails(req.params.id));
  } catch (error) {
    res.status(500).json({ message: 'Failed to update project', error: error.message });
  }
};

export const deleteProject = (req, res) => {
  try {
    const project = Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner_id !== req.user.id && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized to delete this project' });
    }

    // Delete associated images from filesystem
    const images = Project.getImages(req.params.id);
    for (const image of images) {
      const fsPath = webPathToFs(image.file_path);
      if (fsPath && existsSync(fsPath)) {
        try { unlinkSync(fsPath); } catch { /* ignore */ }
      }
    }

    // Delete associated files from filesystem
    const files = Project.getFiles(req.params.id);
    for (const file of files) {
      const fsPath = webPathToFs(file.file_path);
      if (fsPath && existsSync(fsPath)) {
        try { unlinkSync(fsPath); } catch { /* ignore */ }
      }
    }

    Project.delete(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete project', error: error.message });
  }
};

export const uploadImages = (req, res) => {
  try {
    const project = Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner_id !== req.user.id && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized to upload to this project' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const sortStart = parseInt(req.body.sort_start || '0', 10);
    const stepIndex = req.body.step_index !== undefined ? parseInt(req.body.step_index, 10) : null;
    const stepCaption = req.body.step_caption || null;

    const images = [];
    req.files.forEach((file, i) => {
      const image = Project.addImage(project.id, file, sortStart + i, stepIndex, stepCaption);
      images.push(image);
    });

    res.status(201).json(images);
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload images', error: error.message });
  }
};

export const getImages = (req, res) => {
  try {
    const project = Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const requesterId = req.user?.id;
    const owner = requesterId && project.owner_id === requesterId;
    if (!owner && !project.is_public && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized to view images for this project' });
    }

    res.json(Project.getImages(req.params.id));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch images', error: error.message });
  }
};

/**
 * Update a single image: set as cover (sort_order=0) or assign step
 */
export const updateImage = (req, res) => {
  try {
    const project = Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner_id !== req.user.id && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { is_cover, step_index, step_caption } = req.body;

    if (is_cover) {
      // Shift all images up by 1, then set this one to 0
      Project.setCoverImage(req.params.id, req.params.imageId);
    } else {
      Project.updateImageMeta(req.params.imageId, { step_index, step_caption });
    }

    res.json(Project.getImages(req.params.id));
  } catch (error) {
    res.status(500).json({ message: 'Failed to update image', error: error.message });
  }
};

export const deleteImage = (req, res) => {
  try {
    const project = Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner_id !== req.user.id && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized to delete from this project' });
    }

    // Also delete from filesystem
    const db = getDB();
    const img = db.prepare('SELECT * FROM project_images WHERE id = ?').get(req.params.imageId);
    if (img?.file_path) {
      const fsPath = webPathToFs(img.file_path);
      if (fsPath && existsSync(fsPath)) {
        try { unlinkSync(fsPath); } catch { /* ignore */ }
      }
    }

    Project.deleteImage(req.params.imageId);
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete image', error: error.message });
  }
};

export const addMaterial = (req, res) => {
  try {
    const project = Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.owner_id !== req.user.id && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const { material_id, quantity, unit } = req.body;
    res.status(201).json(Project.addMaterial(req.params.id, material_id, quantity, unit));
  } catch (error) {
    res.status(500).json({ message: 'Failed to add material', error: error.message });
  }
};

export const removeMaterial = (req, res) => {
  try {
    const project = Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.owner_id !== req.user.id && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    Project.removeMaterial(req.params.id, req.params.materialId);
    res.json({ message: 'Material removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove material', error: error.message });
  }
};

export const uploadProjectFiles = (req, res) => {
  try {
    const project = Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.owner_id !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Not authorized' });
    if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded' });
    const label = req.body.label || null;
    res.status(201).json(req.files.map(file => Project.addFile(req.params.id, file, label)));
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload files', error: error.message });
  }
};

export const getProjectFiles = (req, res) => {
  try {
    res.json(Project.getFiles(req.params.id));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch files', error: error.message });
  }
};

export const deleteProjectFile = (req, res) => {
  try {
    const project = Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.owner_id !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Not authorized' });
    Project.deleteFile(req.params.fileId);
    res.json({ message: 'File deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete file', error: error.message });
  }
};

export const getProjectActors = (req, res) => {
  try {
    const actors = Project.getActors(req.params.id);
    res.json(actors);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get actors', error: error.message });
  }
};

export const setProjectActors = (req, res) => {
  try {
    const project = Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.owner_id !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Not authorized' });
    const actorIds = Array.isArray(req.body.actor_ids) ? req.body.actor_ids : [];
    Project.setActors(req.params.id, actorIds);
    res.json({ actor_ids: actorIds });
  } catch (error) {
    res.status(500).json({ message: 'Failed to set actors', error: error.message });
  }
};
