import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export function useInactivityLogout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(logout, INACTIVITY_TIMEOUT);
  }, [logout]);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    // Handle visibility change (tab hidden for too long)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Check if session is still valid when tab becomes visible
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) {
            window.location.href = '/';
          } else {
            resetTimer();
          }
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Store last activity timestamp for cross-tab detection
    const storeActivity = () => {
      try {
        localStorage.setItem('lastActivity', Date.now().toString());
      } catch {}
    };
    const activityInterval = setInterval(storeActivity, 60000);
    storeActivity();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(activityInterval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);
}
