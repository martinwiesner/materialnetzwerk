import api from './api';

export const settingsService = {
  getAll: () => api.get('/settings').then((r) => r.data),
  update: (key, value) => api.put(`/settings/${key}`, { value }).then((r) => r.data),
};
