// Build version baked into the React bundle at build time.
// MUST match (or be older than) the backend APP_BUILD_VERSION in server.py.
// Bump this for every release so cached APK WebViews force-refresh.
export const APP_BUILD_VERSION = '2026.02.25.2';

const STORAGE_KEY = 'matka11_last_version_check';
const RELOAD_FLAG = 'matka11_version_reloaded';
const CHECK_INTERVAL_MS = 60 * 1000; // re-check at most every 60s

/**
 * Detect mismatch between bundled APP_BUILD_VERSION and live /api/version.
 * On every cold app boot, ALWAYS fires (no throttle) — crucial for cached APK WebView
 * to immediately re-fetch new bundle. Throttle only applies to subsequent re-checks
 * triggered by window focus events.
 */
export async function checkVersionAndMaybeReload(opts = {}) {
  const { force = false, isBoot = false } = opts;
  try {
    // Prevent infinite reload loop: if we just reloaded, skip for 30s.
    const reloadedAt = parseInt(sessionStorage.getItem(RELOAD_FLAG) || '0', 10);
    if (reloadedAt && Date.now() - reloadedAt < 30 * 1000) return;

    // Boot checks + force checks bypass the throttle entirely.
    // Only window-focus re-checks respect the 60s throttle (to avoid hammering /api/version).
    if (!force && !isBoot) {
      const lastCheck = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      if (lastCheck && Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
    }
    localStorage.setItem(STORAGE_KEY, String(Date.now()));

    const apiUrl = process.env.REACT_APP_BACKEND_URL;
    if (!apiUrl) return;

    // fetch with no-store so the WebView itself can't cache this probe
    const resp = await fetch(`${apiUrl}/api/version?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!resp.ok) return;
    const data = await resp.json().catch(() => null);
    const live = data?.version;
    if (!live || live === APP_BUILD_VERSION) return;

    // Mismatch — newer build live. Clear all caches, then hard-reload with cache-bust.
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (_) {}
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (_) {}

    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
    // Cache-bust query so any intermediary cache (Cloudflare, nginx) serves fresh HTML.
    const url = new URL(window.location.href);
    url.searchParams.set('_v', live);
    window.location.replace(url.toString());
  } catch (_) {
    // swallow — never break the app because of a version probe failure
  }
}
