import { useState, useCallback } from 'react';

const STORAGE_KEY = 'rzz_materialdatenbank_onboarded';

export function useOnboarding() {
  const [hasOnboarded, setHasOnboarded] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
    catch { return false; }
  });

  const [isActive, setIsActive] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== 'true'; }
    catch { return true; }
  });

  const [step, setStep] = useState(0);

  const complete = useCallback(() => {
    setIsActive(false);
    setHasOnboarded(true);
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
  }, []);

  const restart = useCallback(() => {
    setStep(0);
    setIsActive(true);
  }, []);

  return { isActive, step, setStep, complete, restart, hasOnboarded };
}
