import api from './api';

export const relationshipService = {
  getAll: async () => {
    const response = await api.get('/relationships');
    return response.data;
  },

  getPending: async () => {
    const response = await api.get('/relationships/pending');
    return response.data;
  },

  getContacts: async () => {
    const response = await api.get('/relationships/contacts');
    return response.data;
  },

  search: async (query) => {
    const response = await api.get('/relationships/search', { params: { email: query } });
    return response.data;
  },

  create: async (userId) => {
    const response = await api.post('/relationships', { userId });
    return response.data;
  },

  accept: async (id) => {
    const response = await api.put(`/relationships/${id}/accept`);
    return response.data;
  },

  reject: async (id) => {
    const response = await api.put(`/relationships/${id}/reject`);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/relationships/${id}`);
    return response.data;
  },
};
