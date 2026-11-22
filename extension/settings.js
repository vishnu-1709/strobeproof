// Shared settings (ES module; imported by sw.js, popup, welcome, and dynamically by content.js).
export const DEFAULTS = Object.freeze({
  enabled: true,
  mode: 'strict',      // 'strict' (WCAG 2.3.1) | 'comfort' (earlier, not a medical standard)
  onRisk: 'calm',      // 'calm' | 'hide'
  freezeGifs: false,
  allowlist: [],       // hostnames
  lock: false,         // caregiver lock: changes and "Show original" need a confirm step
});

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...(settings || {}) };
}

export async function setSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

/** match patterns for a hostname and its subdomains */
export function hostPatterns(host) {
  return [`*://${host}/*`, `*://*.${host}/*`];
}
