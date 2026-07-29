import { useEffect, useState } from 'react';
import { toISO } from './engine/scheduler';

/**
 * The app's current date, kept fresh.
 *
 * An installed iOS PWA is suspended rather than closed: tapping the home-screen
 * icon resumes yesterday's JavaScript context, so a date computed once at load
 * would stay stuck on whatever day the app was first opened — same day, same
 * questions, forever. Re-check whenever the app comes back to the foreground
 * (and on a slow tick, to catch a midnight rollover while it sits open).
 * setState with an unchanged value is a no-op, so quiet days cost no renders.
 */
export function useTodayISO(dateOverride: string | null): string {
  const [realToday, setRealToday] = useState(() => toISO(new Date()));

  useEffect(() => {
    const check = () => {
      const now = toISO(new Date());
      setRealToday(prev => (prev === now ? prev : now));
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    const tick = setInterval(check, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', check);
      clearInterval(tick);
    };
  }, []);

  return dateOverride ?? realToday;
}
