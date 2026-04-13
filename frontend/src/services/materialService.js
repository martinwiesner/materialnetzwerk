import api from './api';

export const materialService = {
  getAll: async (params = {}) => {
    const response = await api.get('/materials', { params });
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/materials/categories');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/materials/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/materials', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/materials/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/materials/${id}`);
    return response.data;
  },
};
// appended

export const materialImageService = {
  upload: async (id, files, options = {}) => {
    const { default: api } = await import('./api');
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    if (options.sort_start !== undefined) formData.append('sort_start', options.sort_start);
    if (options.step_index !== undefined) formData.append('step_index', options.step_index);
    if (options.step_caption) formData.append('step_caption', options.step_caption);
    const response = await api.post(`/materials/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  delete: async (id, imageId) => {
    const { default: api } = await import('./api');
    const response = await api.delete(`/materials/${id}/images/${imageId}`);
    return response.data;
  },

  uploadFiles: async (id, files, label = null) => {
    const { default: api } = await import('./api');
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    if (label) formData.append('label', label);
    const response = await api.post(`/materials/${id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteFile: async (id, fileId) => {
    const { default: api } = await import('./api');
    const response = await api.delete(`/materials/${id}/files/${fileId}`);
    return response.data;
  },
};
