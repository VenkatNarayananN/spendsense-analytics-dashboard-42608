const express = require('express');
const healthController = require('../controllers/health');
const fxController = require('../controllers/fx');

const router = express.Router();
// Health endpoint

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health endpoint
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', healthController.check.bind(healthController));

/**
 * @swagger
 * /api/fx/latest:
 *   get:
 *     summary: Get latest FX rates (cached 1 hour)
 *     description: >
 *       Fetches latest FX rates from Open Exchange Rates using OPEN_EXCHANGE_RATES_API_KEY.
 *       Responses are cached in-memory per base currency for 1 hour. On the free plan, Open Exchange Rates
 *       provides USD as the base; for other bases, the server computes cross-rates from USD.
 *     parameters:
 *       - in: query
 *         name: base
 *         required: false
 *         description: 3-letter ISO currency code (e.g., USD, EUR, GBP, INR). Defaults to USD.
 *         schema:
 *           type: string
 *           example: USD
 *     responses:
 *       200:
 *         description: Latest FX rates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 base:
 *                   type: string
 *                   example: USD
 *                 rates:
 *                   type: object
 *                   additionalProperties:
 *                     type: number
 *                   example:
 *                     USD: 1
 *                     EUR: 0.92
 *                     GBP: 0.79
 *                     INR: 83.1
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid query/base currency
 *       500:
 *         description: Server misconfiguration or internal error
 *       502:
 *         description: Upstream FX provider error
 */
router.get('/api/fx/latest', fxController.latest.bind(fxController));

module.exports = router;
