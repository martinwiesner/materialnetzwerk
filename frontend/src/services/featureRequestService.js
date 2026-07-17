import api from './api';

export const featureRequestService = {
  create: (data) => api.post('/feature-requests', data).then(r => r.data),
};
