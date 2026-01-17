'use strict';

const fxService = require('../services/fx');

function normalizeBase(base) {
  return String(base || 'USD').trim().toUpperCase() || 'USD';
}

function isValidCurrencyCode(code) {
  // Simple ISO-4217-ish validation (3 uppercase letters)
  return /^[A-Z]{3}$/.test(String(code || '').trim().toUpperCase());
}

class FxController {
  // PUBLIC_INTERFACE
  async latest(req, res) {
    /**
     * GET /api/fx/latest?base=USD
     * Returns latest FX rates for the requested base, cached in-memory for 1 hour.
     *
     * Response: { base, rates, timestamp }
     */
    const base = normalizeBase(req.query?.base || 'USD');

    if (!isValidCurrencyCode(base)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid base currency. Expected a 3-letter ISO code like "USD".',
      });
    }

    try {
      const payload = await fxService.getLatestRates(base);
      return res.status(200).json(payload);
    } catch (err) {
      const httpStatus = Number(err.httpStatus) || 500;

      // Differentiate misconfiguration vs upstream errors.
      if (err.code === 'MISSING_API_KEY') {
        return res.status(500).json({
          status: 'error',
          message: 'FX service is not configured (missing API key).',
        });
      }

      if (err.code === 'BASE_NOT_AVAILABLE') {
        return res.status(400).json({
          status: 'error',
          message: err.message,
        });
      }

      // Upstream errors or unexpected failures
      if (httpStatus >= 400 && httpStatus < 600) {
        return res.status(httpStatus).json({
          status: 'error',
          message: err.message || 'Failed to fetch FX rates.',
        });
      }

      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch FX rates.',
      });
    }
  }
}

module.exports = new FxController();
