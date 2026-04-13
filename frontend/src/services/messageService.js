import api from './api';

export const messageService = {
  getInbox: async () => {
    const response = await api.get('/messages/inbox');
    return response.data;
  },

  getSent: async () => {
    const response = await api.get('/messages/sent');
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/messages/unread-count');
    return response.data;
  },

  getMessage: async (id) => {
    const response = await api.get(`/messages/${id}`);
    return response.data;
  },

  getConversation: async (userId) => {
    const response = await api.get(`/messages/conversation/${userId}`);
    return response.data;
  },

  send: async (data) => {
    const response = await api.post('/messages', data);
    return response.data;
  },

  markAsRead: async (id) => {
    const response = await api.put(`/messages/${id}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.post('/messages/mark-all-read');
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/messages/${id}`);
    return response.data;
  },
};
