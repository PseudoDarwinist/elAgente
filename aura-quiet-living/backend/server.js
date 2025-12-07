const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());

// Fault Injection State
let FAULT_CONFIG = {
    checkout_latency_ms: 0,
    checkout_error_rate: 0, // 0 to 1
    db_connection_error: false
};

// Middleware to log requests (Structured)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('request_processed', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration_ms: duration,
            user_agent: req.get('User-Agent')
        });
    });
    next();
});

// Admin Endpoint to Set Faults (Hidden)
app.post('/api/admin/fault', (req, res) => {
    const { latency_ms, error_rate, db_down } = req.body;
    if (latency_ms !== undefined) FAULT_CONFIG.checkout_latency_ms = latency_ms;
    if (error_rate !== undefined) FAULT_CONFIG.checkout_error_rate = error_rate;
    if (db_down !== undefined) FAULT_CONFIG.db_connection_error = db_down;

    logger.warn('fault_config_updated', { config: FAULT_CONFIG });
    res.json({ message: 'Fault config updated', current: FAULT_CONFIG });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Checkout Endpoint
app.post('/api/checkout', async (req, res) => {
    const { cart, email } = req.body;

    // 1. Simulate Latency
    if (FAULT_CONFIG.checkout_latency_ms > 0) {
        await new Promise(r => setTimeout(r, FAULT_CONFIG.checkout_latency_ms));
    }

    // 2. Simulate DB Connection Error
    if (FAULT_CONFIG.db_connection_error) {
        logger.error('database_connection_failed', {
            error: 'ConnectionTimeout',
            db_host: 'inventory-db-01',
            retry_count: 5
        });
        return res.status(503).json({ error: 'Service Unavailable: Database connection timeout' });
    }

    // 3. Simulate Random Error
    if (Math.random() < FAULT_CONFIG.checkout_error_rate) {
        logger.error('payment_processing_failed', {
            error: 'GatewayTimeout',
            provider: 'stripe',
            transaction_id: 'tx_failed_' + Date.now()
        });
        return res.status(500).json({ error: 'Payment processing failed. Please try again.' });
    }

    // Success
    logger.info('order_placed', {
        email,
        item_count: cart?.length || 0,
        total_amount: cart?.reduce((s, i) => s + (i.price || 0), 0) || 0
    });

    res.json({ success: true, orderId: 'ord_' + Date.now() });
});

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    logger.info('server_started', { port: PORT });
});
