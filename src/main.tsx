import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/app.css';

/**
 * Keep an installed PWA up to date.
 *
 * iOS suspends a home-screen app rather than closing it, so `load` may not fire
 * again for weeks — and the default load-time registration is the only thing
 * that checks for a new build. A device can therefore sit on a months-old
 * version forever. Re-check every time the app comes back to the foreground,
 * and reload once the new worker takes over.
 */
const hadController = !!navigator.serviceWorker?.controller;
let reloading = false;
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  // ignore the very first claim on a fresh install — nothing to swap out yet
  if (!hadController || reloading) return;
  reloading = true;
  location.reload();
});

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const check = () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    setInterval(check, 60 * 60 * 1000);
    check();
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
