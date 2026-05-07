import api from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export const pushService = {
  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  async getPermission() {
    return Notification.permission; // 'default' | 'granted' | 'denied'
  },

  async register() {
    if (!this.isSupported()) return null;
    return navigator.serviceWorker.register('/sw.js');
  },

  async subscribe() {
    if (!this.isSupported()) return false;

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    // Get VAPID public key from backend
    const { data } = await api.get('/push/vapid-public-key');
    const applicationServerKey = urlBase64ToUint8Array(data.publicKey);

    // Register SW and subscribe
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // Send subscription to backend
    await api.post('/push/subscribe', { subscription });
    return true;
  },

  async unsubscribe() {
    if (!this.isSupported()) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await api.delete('/push/unsubscribe', { data: { endpoint: subscription.endpoint } });
      await subscription.unsubscribe();
    }
  },

  async isSubscribed() {
    if (!this.isSupported()) return false;
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      return Boolean(sub);
    } catch {
      return false;
    }
  },
};
