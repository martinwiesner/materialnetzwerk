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

  downloadPdf: async (id, filename) => {
    const response = await api.get(`/materials/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `material-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
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

  updateMeta: async (id, imageId, data) => {
    const { default: api } = await import('./api');
    const response = await api.patch(`/materials/${id}/images/${imageId}`, data);
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

export const parseEpdPdf = async (pdfFile) => {
  const formData = new FormData();
  formData.append('pdf', pdfFile);
  const response = await api.post('/materials/parse-epd', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const parseDocumentForMaterial = async (file, mode = 'material') => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/materials/parse-doc?mode=${mode}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const analyzeImages = async (files, mode = 'material') => {
  const formData = new FormData();
  formData.append('mode', mode);
  for (const f of files) formData.append('images', f);
  const response = await api.post('/ai/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const materialActorService = {
  getActors: async (materialId) => {
    const response = await api.get(`/materials/${materialId}/actors`);
    return response.data;
  },

  setActors: async (materialId, actorIds) => {
    const response = await api.put(`/materials/${materialId}/actors`, { actor_ids: actorIds });
    return response.data;
  },
};
