import api from './api';

export const projectService = {
  getAll: async (params = {}) => {
    const response = await api.get('/projects', { params });
    return response.data;
  },

  getPublic: async (params = {}) => {
    const response = await api.get('/projects/public', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/projects', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/projects/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/projects/${id}`);
    return response.data;
  },

  // ── Images ──────────────────────────────────────────────────────────────

  getImages: async (projectId) => {
    const response = await api.get(`/projects/${projectId}/images`);
    return response.data;
  },

  uploadImages: async (projectId, files, options = {}) => {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    if (options.sort_start !== undefined) formData.append('sort_start', options.sort_start);
    if (options.step_index !== undefined) formData.append('step_index', options.step_index);
    if (options.step_caption) formData.append('step_caption', options.step_caption);
    const response = await api.post(`/projects/${projectId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** Update image metadata: set as cover or assign step */
  updateImage: async (projectId, imageId, data) => {
    const response = await api.patch(`/projects/${projectId}/images/${imageId}`, data);
    return response.data;
  },

  deleteImage: async (projectId, imageId) => {
    const response = await api.delete(`/projects/${projectId}/images/${imageId}`);
    return response.data;
  },

  // ── Materials ────────────────────────────────────────────────────────────

  addMaterial: async (projectId, materialData) => {
    const response = await api.post(`/projects/${projectId}/materials`, materialData);
    return response.data;
  },

  removeMaterial: async (projectId, materialId) => {
    const response = await api.delete(`/projects/${projectId}/materials/${materialId}`);
    return response.data;
  },

  // ── Files ────────────────────────────────────────────────────────────────

  uploadFiles: async (projectId, files, label = null) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    if (label) formData.append('label', label);
    const response = await api.post(`/projects/${projectId}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteFile: async (projectId, fileId) => {
    const response = await api.delete(`/projects/${projectId}/files/${fileId}`);
    return response.data;
  },
};
