import api from './api';

export const favoriteService = {
  getAll: () => api.get('/favorites').then((r) => r.data),
  add: (entityType, entityId) =>
    api.post('/favorites', { entity_type: entityType, entity_id: entityId }).then((r) => r.data),
  remove: (entityType, entityId) =>
    api.delete(`/favorites/${entityType}/${entityId}`).then((r) => r.data),
  getStatus: (entityType, entityId) =>
    api.get(`/favorites/status/${entityType}/${entityId}`).then((r) => r.data),
};
