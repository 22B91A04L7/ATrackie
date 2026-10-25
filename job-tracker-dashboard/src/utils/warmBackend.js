import { API_URL } from '../config';

// One best-effort request per page/popup lifetime. Never delay user actions or retry writes.
let started = false;
export function warmBackend() {
  if (started) return;
  started = true;
  const controller = new AbortController();
  const stop = () => controller.abort();
  const timer = setTimeout(stop, 90000);
  window.addEventListener('pagehide', stop, { once: true });
  return fetch(`${API_URL}/api/health`, { signal: controller.signal, cache: 'no-store', credentials: 'omit' })
    .catch(() => {})
    .finally(() => {
      clearTimeout(timer);
      window.removeEventListener('pagehide', stop);
    });
}
