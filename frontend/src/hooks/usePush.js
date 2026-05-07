import { useEffect, useState, useCallback } from 'react';
import { pushService } from '../services/pushService';
import { useToast } from '../store/toastStore';

export function usePush(isAuthenticated) {
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState('default');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  // Register SW once on mount
  useEffect(() => {
    if (!pushService.isSupported()) return;
    pushService.register().catch(() => {});
  }, []);

  // Check current state when auth changes
  useEffect(() => {
    if (!isAuthenticated || !pushService.isSupported()) return;
    setPermission(Notification.permission);
    pushService.isSubscribed().then(setSubscribed);
  }, [isAuthenticated]);

  const enable = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await pushService.subscribe();
      if (ok) {
        setSubscribed(true);
        setPermission('granted');
        toast.success('Push-Benachrichtigungen aktiviert.');
      } else if (Notification.permission === 'denied') {
        toast.error('Benachrichtigungen wurden blockiert. Bitte in den Browser-Einstellungen erlauben.');
      }
    } catch {
      toast.error('Push konnte nicht aktiviert werden.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const disable = useCallback(async () => {
    setLoading(true);
    try {
      await pushService.unsubscribe();
      setSubscribed(false);
      toast.info('Push-Benachrichtigungen deaktiviert.');
    } catch {
      toast.error('Deaktivieren fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { subscribed, permission, loading, enable, disable, supported: pushService.isSupported() };
}
