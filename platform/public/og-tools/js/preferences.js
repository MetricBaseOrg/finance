// User preferences persisted in localStorage.

const KEY = 'og-tools:prefs';

const DEFAULTS = {
  unitSystem: 'field', // 'field' | 'si'
  sigFigs: 4,          // 2..6
};

let cache = null;

function clampSigFigs(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULTS.sigFigs;
  return Math.min(6, Math.max(2, Math.round(n)));
}

function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    cache = { ...DEFAULTS };
  }
  cache.sigFigs = clampSigFigs(cache.sigFigs);
  cache.unitSystem = cache.unitSystem === 'si' ? 'si' : 'field';
  return cache;
}

export function getPrefs() {
  return { ...read() };
}

export function setPrefs(patch) {
  const next = { ...read(), ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, 'sigFigs')) {
    next.sigFigs = clampSigFigs(patch.sigFigs);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'unitSystem')) {
    next.unitSystem = patch.unitSystem === 'si' ? 'si' : 'field';
  }
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* quota / private mode */ }
  return { ...next };
}

export function resetPrefs() {
  cache = { ...DEFAULTS };
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return { ...cache };
}

// Format a number using the user's configured significant figures.
// Strips trailing zeros from the fractional part for readability.
export function formatNumber(value, sigFigs = read().sigFigs) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e7)) {
    return value.toExponential(Math.max(0, sigFigs - 1));
  }
  let s = value.toPrecision(sigFigs);
  if (s.includes('e')) return s;
  if (s.indexOf('.') !== -1) {
    s = s.replace(/\.?0+$/, '');
  }
  const parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join('.');
}
