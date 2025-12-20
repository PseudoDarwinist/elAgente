const express = require('express');
const cors = require('cors');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 8081;

app.use(cors());
app.use(express.json());

// Fault Injection State
let FAULT_CONFIG = {
    gateway_timeout: false,
    card_declined: false,
    api_error: false
};

// Middleware to log requests
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('request_processed', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration_ms: duration
        });
    });
    next();
});

// Admin Endpoint to Set Faults
app.post('/api/admin/fault', (req, res) => {
    const { gateway_timeout, card_declined, api_error } = req.body;
    if (gateway_timeout !== undefined) FAULT_CONFIG.gateway_timeout = gateway_timeout;
    if (card_declined !== undefined) FAULT_CONFIG.card_declined = card_declined;
    if (api_error !== undefined) FAULT_CONFIG.api_error = api_error;

    logger.warn('fault_config_updated', { config: FAULT_CONFIG });
    res.json({ message: 'Fault config updated', current: FAULT_CONFIG });
});

// Health check
app.get('/health', (req, res) => {
    if (FAULT_CONFIG.gateway_timeout) {
        return res.status(503).json({ status: 'unhealthy', error: 'Gateway timeout' });
    }
    res.json({ status: 'healthy', service: 'stripe-mock' });
});

// Create a charge (payment)
app.post('/v1/charges', async (req, res) => {
    const { amount, currency, source, description } = req.body;
    const chargeId = 'ch_' + Date.now() + Math.random().toString(36).substr(2, 9);

    // Simulate gateway timeout
    if (FAULT_CONFIG.gateway_timeout) {
        await new Promise(r => setTimeout(r, 30000)); // 30s timeout
        logger.error('payment_gateway_timeout', {
            error: 'GatewayTimeout',
            charge_id: chargeId,
            amount
        });
        return res.status(504).json({
            error: {
                type: 'api_error',
                code: 'gateway_timeout',
                message: 'The payment gateway did not respond in time'
            }
        });
    }

    // Simulate card declined
    if (FAULT_CONFIG.card_declined) {
        logger.error('payment_card_declined', {
            error: 'CardDeclined',
            charge_id: chargeId,
            decline_code: 'insufficient_funds'
        });
        return res.status(402).json({
            error: {
                type: 'card_error',
                code: 'card_declined',
                decline_code: 'insufficient_funds',
                message: 'Your card has insufficient funds'
            }
        });
    }

    // Simulate API error
    if (FAULT_CONFIG.api_error) {
        logger.error('stripe_api_error', {
            error: 'APIError',
            message: 'Internal server error'
        });
        return res.status(500).json({
            error: {
                type: 'api_error',
                message: 'An internal error occurred'
            }
        });
    }

    // Successful payment
    logger.info('payment_succeeded', {
        charge_id: chargeId,
        amount,
        currency: currency || 'usd'
    });

    res.json({
        id: chargeId,
        object: 'charge',
        amount: amount || 0,
        currency: currency || 'usd',
        status: 'succeeded',
        paid: true,
        description: description || 'Aura Quiet Living Order',
        created: Math.floor(Date.now() / 1000)
    });
});

// Retrieve a charge
app.get('/v1/charges/:id', (req, res) => {
    const { id } = req.params;
    res.json({
        id,
        object: 'charge',
        status: 'succeeded',
        paid: true
    });
});

// Create a refund
app.post('/v1/refunds', (req, res) => {
    const { charge, amount } = req.body;
    const refundId = 're_' + Date.now();

    logger.info('refund_created', { refund_id: refundId, charge, amount });

    res.json({
        id: refundId,
        object: 'refund',
        charge,
        amount,
        status: 'succeeded'
    });
});

app.listen(PORT, () => {
    console.log(`Stripe Mock running on port ${PORT}`);
    logger.info('server_started', { port: PORT, service: 'stripe-mock' });
});
