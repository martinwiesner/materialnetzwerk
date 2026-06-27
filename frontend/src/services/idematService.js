import api from './api';

export const idematService = {
  search: async (q, limit = 20) => {
    const res = await api.get('/idemat/search', { params: { q, limit } });
    return res.data;
  },

  getById: async (id) => {
    const res = await api.get(`/idemat/process/${encodeURIComponent(id)}`);
    return res.data;
  },
};
