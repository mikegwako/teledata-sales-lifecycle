import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const SESSION_KEY = 'teledata_session_active';

export function useInactivityLogout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(async () => {
    sessionStorage.removeItem(SESSION_KEY);
    await supabase.auth.signOut();
    window.location.href = '/';
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(logout, INACTIVITY_TIMEOUT);
  }, [logout]);

  useEffect(() => {
    // On mount: check if this is a fresh tab (no sessionStorage marker)
    // sessionStorage is cleared when tab/browser is closed
    const wasActive = sessionStorage.getItem(SESSION_KEY);
    if (!wasActive) {
      // Fresh tab/browser open - check if there's a stale session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          // Session exists but tab was closed - sign out
          supabase.auth.signOut().then(() => {
            window.location.href = '/';
          });
          return;
        }
      });
    }
    // Mark session as active in this tab
    sessionStorage.setItem(SESSION_KEY, 'true');

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
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

    // Store last activity timestamp
    const storeActivity = () => {
      try {
        localStorage.setItem('lastActivity', Date.now().toString());
      } catch {}
    };
    const activityInterval = setInterval(storeActivity, 60000);
    storeActivity();

    // Before unload - clear session marker so fresh opens trigger logout
    const handleBeforeUnload = () => {
      // We intentionally do NOT clear sessionStorage here
      // sessionStorage auto-clears on tab close (browser behavior)
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(activityInterval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer, logout]);
}
