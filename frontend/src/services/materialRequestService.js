import api from './api';

export const materialRequestService = {
  create: (data) => api.post('/requests', data).then(r => r.data),
  getMyRequests: () => api.get('/requests/my').then(r => r.data),
  getIncoming: () => api.get('/requests/incoming').then(r => r.data),
  getByInventory: (inventoryId) => api.get(`/requests/inventory/${inventoryId}`).then(r => r.data),
  updateStatus: (id, status, owner_note) => api.patch(`/requests/${id}/status`, { status, owner_note }).then(r => r.data),
  delete: (id) => api.delete(`/requests/${id}`).then(r => r.data),
};
