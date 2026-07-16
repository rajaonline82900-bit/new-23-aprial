// Build version baked into the React bundle at build time.
// MUST match (or be older than) the backend APP_BUILD_VERSION in server.py.
// Bump this for every release so cached APK WebViews force-refresh.
export const APP_BUILD_VERSION = '2026.02.25.4';

const STORAGE_KEY = 'matka11_last_version_check';
const RELOAD_FLAG = 'matka11_version_reloaded';
const RELOAD_ATTEMPTS_KEY = 'matka11_version_reload_attempts';
const CHECK_INTERVAL_MS = 60 * 1000; // re-check at most every 60s
const MAX_AUTO_RELOADS = 1;          // max 1 auto-reload per session — never loop

/**
 * Detect mismatch between bundled APP_BUILD_VERSION and live /api/version.
 *
 * Robust reload strategy:
 *   1. If we haven't reloaded yet this session AND versions differ → reload once (soft).
 *   2. If we've already tried reloading and still mismatched → the APK is bundling
 *      old JS locally, so reloading won't help. Set `window.__matka_needs_update`
 *      so a banner in the UI can show "New APK Available — please update" instead
 *      of hard-crashing into a reload loop.
 *   3. Auth tokens (`matka11_token` / `matka11_user_cache`) are NEVER touched here.
 */
export async function checkVersionAndMaybeReload(opts = {}) {
  const { force = false, isBoot = false } = opts;
  try {
    // Prevent infinite reload loop: if we just reloaded, skip for 30s.
    const reloadedAt = parseInt(sessionStorage.getItem(RELOAD_FLAG) || '0', 10);
    if (reloadedAt && Date.now() - reloadedAt < 30 * 1000) return;

    // Cap the total reload attempts per session (across boots).
    const attempts = parseInt(sessionStorage.getItem(RELOAD_ATTEMPTS_KEY) || '0', 10);

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
    let resp;
    try {
      resp = await fetch(`${apiUrl}/api/version?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
    } catch (_) {
      // Network / DNS error — never touch the app, just quietly return.
      return;
    }
    if (!resp.ok) return;
    const data = await resp.json().catch(() => null);
    const live = data?.version;
    if (!live || live === APP_BUILD_VERSION) {
      // Versions match — clear any stale "needs update" flag & attempts counter.
      try { sessionStorage.removeItem(RELOAD_ATTEMPTS_KEY); } catch (_) { /* ignore */ }
      window.__matka_needs_update = null;
      return;
    }

    // ─── Mismatch detected ───
    // If we've already burned our reload attempts this session, do NOT reload
    // again (would loop indefinitely if APK ships bundled old JS). Instead,
    // expose a global flag so a soft "New APK Available" banner can render.
    if (attempts >= MAX_AUTO_RELOADS) {
      window.__matka_needs_update = { bundled: APP_BUILD_VERSION, live };
      try {
        window.dispatchEvent(new CustomEvent('matka:update-available', { detail: { bundled: APP_BUILD_VERSION, live } }));
      } catch (_) { /* ignore */ }
      return;
    }

    // Clear only HTTP/asset caches — never touch localStorage (auth tokens).
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (_) { /* ignore */ }
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (_) { /* ignore */ }

    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
    sessionStorage.setItem(RELOAD_ATTEMPTS_KEY, String(attempts + 1));
    // Cache-bust query so any intermediary cache (Cloudflare, nginx) serves fresh HTML.
    const url = new URL(window.location.href);
    url.searchParams.set('_v', live);
    window.location.replace(url.toString());
  } catch (_) {
    // swallow — never break the app because of a version probe failure
  }
}
