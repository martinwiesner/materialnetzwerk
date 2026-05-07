import api from './api';

export const actorService = {
  getAll: async (params = {}) => {
    const response = await api.get('/actors', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/actors/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/actors', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/actors/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/actors/${id}`);
    return response.data;
  },

  uploadImages: async (id, files) => {
    const formData = new FormData();
    files.forEach(f => formData.append('images', f));
    const response = await api.post(`/actors/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteImage: async (id, imageId) => {
    const response = await api.delete(`/actors/${id}/images/${imageId}`);
    return response.data;
  },

  addLink: async (actorId, entityType, entityId) => {
    const response = await api.post(`/actors/${actorId}/links`, { entity_type: entityType, entity_id: entityId });
    return response.data;
  },

  removeLink: async (actorId, linkId) => {
    const response = await api.delete(`/actors/${actorId}/links/${linkId}`);
    return response.data;
  },
};
