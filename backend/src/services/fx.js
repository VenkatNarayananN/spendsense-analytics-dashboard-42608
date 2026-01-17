'use strict';

/**
 * In-memory FX cache and Open Exchange Rates fetcher.
 *
 * Open Exchange Rates "latest" endpoint uses USD as base on the free plan.
 * If a non-USD base is requested, we compute cross-rates from USD rates.
 */

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const OXR_LATEST_URL = 'https://openexchangerates.org/api/latest.json';

/**
 * Cache structure:
 * Map<base, { expiresAt:number, payload:{ base:string, rates:Object<string,number>, timestamp:string } }>
 */
const cacheByBase = new Map();

function nowMs() {
  return Date.now();
}

function normalizeBase(base) {
  return String(base || 'USD').trim().toUpperCase() || 'USD';
}

function safeNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

function computeCrossRatesFromUsdRates(usdRates, base) {
  // usdRates are rates where 1 USD = rate[currency]
  // To convert to base B: 1 B = rateTo / rateB
  const baseRate = safeNumber(usdRates?.[base]);
  if (!baseRate || baseRate <= 0) {
    const err = new Error(`Base currency "${base}" is not available in rates.`);
    err.code = 'BASE_NOT_AVAILABLE';
    throw err;
  }

  const out = {};
  Object.entries(usdRates || {}).forEach(([ccy, rate]) => {
    const r = safeNumber(rate);
    if (!r || r <= 0) return;
    out[ccy] = r / baseRate;
  });

  // Ensure base is exactly 1
  out[base] = 1;

  return out;
}

async function fetchUsdLatestFromOxr(apiKey) {
  const url = `${OXR_LATEST_URL}?app_id=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  // OXR can return non-2xx with JSON body
  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg =
      (data && (data.description || data.message || data.error)) ||
      `Failed to fetch FX rates (status ${res.status}).`;
    const err = new Error(msg);
    err.httpStatus = res.status;
    err.oxr = data || null;
    throw err;
  }

  if (!data || typeof data !== 'object' || !data.rates || typeof data.rates !== 'object') {
    const err = new Error('Unexpected FX response format from Open Exchange Rates.');
    err.httpStatus = 502;
    throw err;
  }

  return data;
}

// PUBLIC_INTERFACE
async function getLatestRates(base) {
  /**
   * Get latest rates for a base currency with 1-hour in-memory caching.
   *
   * @param {string} base - ISO currency code (e.g., USD, EUR)
   * @returns {Promise<{base:string, rates:Object<string,number>, timestamp:string}>}
   */
  const apiKey = process.env.OPEN_EXCHANGE_RATES_API_KEY;
  if (!apiKey) {
    const err = new Error('OPEN_EXCHANGE_RATES_API_KEY is not configured.');
    err.httpStatus = 500;
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const normalizedBase = normalizeBase(base);
  const cached = cacheByBase.get(normalizedBase);
  if (cached && cached.expiresAt > nowMs()) {
    return cached.payload;
  }

  const usdPayload = await fetchUsdLatestFromOxr(apiKey);

  const timestamp =
    typeof usdPayload.timestamp === 'number'
      ? new Date(usdPayload.timestamp * 1000).toISOString()
      : new Date().toISOString();

  const usdRates = {
    ...usdPayload.rates,
    USD: 1,
  };

  let rates = usdRates;
  if (normalizedBase !== 'USD') {
    rates = computeCrossRatesFromUsdRates(usdRates, normalizedBase);
  }

  const payload = {
    base: normalizedBase,
    rates,
    timestamp,
  };

  cacheByBase.set(normalizedBase, {
    expiresAt: nowMs() + CACHE_TTL_MS,
    payload,
  });

  return payload;
}

module.exports = {
  getLatestRates,
};
