import api from './api';

export const inventoryService = {
  getAll: async (params = {}) => {
    const response = await api.get('/inventory', { params });
    return response.data;
  },

  getAvailable: async (params = {}) => {
    const response = await api.get('/inventory/available', { params });
    return response.data;
  },

  getTransfers: async () => {
    const response = await api.get('/inventory/transfers');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/inventory/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/inventory', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/inventory/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/inventory/${id}`);
    return response.data;
  },

  transfer: async (id, data) => {
    const response = await api.post(`/inventory/${id}/transfer`, data);
    return response.data;
  },

  gift: async (id, data) => {
    const response = await api.post(`/inventory/${id}/gift`, data);
    return response.data;
  },

  acceptTransfer: async (transferId) => {
    const response = await api.post(`/inventory/transfers/${transferId}/accept`);
    return response.data;
  },

  uploadImages: async (id, files, options = {}) => {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    if (options.sort_start !== undefined) formData.append('sort_start', options.sort_start);
    if (options.step_index !== undefined) formData.append('step_index', options.step_index);
    if (options.step_caption) formData.append('step_caption', options.step_caption);
    const response = await api.post(`/inventory/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteImage: async (id, imageId) => {
    const response = await api.delete(`/inventory/${id}/images/${imageId}`);
    return response.data;
  },

  uploadFiles: async (id, files, label = null) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    if (label) formData.append('label', label);
    const response = await api.post(`/inventory/${id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteFile: async (id, fileId) => {
    const response = await api.delete(`/inventory/${id}/files/${fileId}`);
    return response.data;
  },
};
