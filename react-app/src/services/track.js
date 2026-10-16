// Google Analytics events (GA4 via public/ga.js). Never sends personal data: only the event name and small labels.
// Does nothing when analytics is not loaded (no measurement id, blocked by the browser, tests).
export function track(name, params = {}) {
  try { if (typeof window !== 'undefined' && window.gtag) window.gtag('event', name, params) } catch { /* no analytics */ }
}
