const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 4000;

// Service URLs (Docker internal networking)
const POSTGRES_URL = process.env.POSTGRES_URL || 'http://postgres-mock:5432';
const REDIS_URL = process.env.REDIS_URL || 'http://redis-mock:6379';
const STRIPE_URL = process.env.STRIPE_URL || 'http://stripe-mock:8081';

app.use(cors());
app.use(bodyParser.json());

// Fault Injection State (local backend faults)
let FAULT_CONFIG = {
    checkout_latency_ms: 0,
    checkout_error_rate: 0,
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

// Get products - calls postgres-mock
app.get('/api/products', async (req, res) => {
    try {
        // Call postgres-mock for inventory
        const dbResponse = await fetch(`${POSTGRES_URL}/query?table=products`);
        const dbData = await dbResponse.json();

        if (!dbResponse.ok) {
            logger.error('failed_to_fetch_products', {
                error: dbData.error,
                service: 'postgres-mock'
            });
            return res.status(dbResponse.status).json({ error: 'Database error', details: dbData.error });
        }

        // Try to get cached product data from redis
        try {
            const cacheResponse = await fetch(`${REDIS_URL}/cache/products_list`);
            const cacheData = await cacheResponse.json();
            if (cacheData.hit) {
                logger.info('products_cache_hit');
            }
        } catch (cacheErr) {
            logger.warn('redis_cache_unavailable', { error: cacheErr.message });
        }

        res.json({
            success: true,
            products: dbData.rows || [
                { id: 1, name: 'Meditation Candle', price: 24.99, stock: 50 },
                { id: 2, name: 'Zen Garden Kit', price: 49.99, stock: 25 },
                { id: 3, name: 'Bamboo Incense Set', price: 19.99, stock: 100 },
                { id: 4, name: 'Himalayan Salt Lamp', price: 34.99, stock: 40 },
                { id: 5, name: 'Yoga Mat Premium', price: 79.99, stock: 30 }
            ]
        });
    } catch (error) {
        logger.error('products_fetch_failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Checkout Endpoint - calls all downstream services
app.post('/api/checkout', async (req, res) => {
    const { cart, email, paymentMethod } = req.body;
    const orderId = 'ord_' + Date.now();

    logger.info('checkout_started', { orderId, email, itemCount: cart?.length || 0 });

    // 1. Simulate local latency
    if (FAULT_CONFIG.checkout_latency_ms > 0) {
        await new Promise(r => setTimeout(r, FAULT_CONFIG.checkout_latency_ms));
    }

    // 2. Check local fault flag
    if (FAULT_CONFIG.db_connection_error) {
        logger.error('database_connection_failed', {
            error: 'ConnectionTimeout',
            db_host: 'postgres-mock',
            retry_count: 5
        });
        return res.status(503).json({ error: 'Service Unavailable: Database connection timeout' });
    }

    try {
        // 3. Check/Set user session in Redis cache
        logger.info('checking_user_session', { email });
        const sessionKey = `session_${email?.replace(/[^a-z0-9]/gi, '_')}`;

        try {
            const sessionResponse = await fetch(`${REDIS_URL}/cache/${sessionKey}`);
            const sessionData = await sessionResponse.json();

            if (!sessionResponse.ok) {
                logger.error('redis_session_check_failed', {
                    error: sessionData.error,
                    service: 'redis-mock'
                });
                // Continue - cache failure shouldn't block checkout
            } else {
                logger.info('session_retrieved', { hit: sessionData.hit });
            }
        } catch (redisErr) {
            logger.warn('redis_unavailable', { error: redisErr.message });
        }

        // 4. Check inventory in Postgres
        logger.info('checking_inventory', { items: cart?.length || 0 });
        const inventoryResponse = await fetch(`${POSTGRES_URL}/query?table=inventory`);
        const inventoryData = await inventoryResponse.json();

        if (!inventoryResponse.ok) {
            logger.error('inventory_check_failed', {
                error: inventoryData.error,
                service: 'postgres-mock'
            });
            return res.status(inventoryResponse.status).json({
                error: 'Inventory check failed',
                details: inventoryData.error
            });
        }

        logger.info('inventory_verified', { available: true });

        // 5. Process payment via Stripe
        logger.info('processing_payment', {
            provider: 'stripe',
            amount: cart?.reduce((s, i) => s + (i.price || 0), 0) || 0
        });

        const paymentResponse = await fetch(`${STRIPE_URL}/v1/charges`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: Math.round((cart?.reduce((s, i) => s + (i.price || 0), 0) || 0) * 100),
                currency: 'usd',
                source: paymentMethod || 'tok_visa',
                description: `Order ${orderId}`
            })
        });

        const paymentData = await paymentResponse.json();

        if (!paymentResponse.ok) {
            logger.error('payment_failed', {
                error: paymentData.error?.message || 'Payment failed',
                service: 'stripe-mock',
                orderId
            });
            return res.status(paymentResponse.status).json({
                error: 'Payment failed',
                details: paymentData.error
            });
        }

        logger.info('payment_succeeded', {
            chargeId: paymentData.id,
            orderId
        });

        // 6. Update order in database
        await fetch(`${POSTGRES_URL}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: 'INSERT INTO orders (id, email, status) VALUES ($1, $2, $3)',
                params: [orderId, email, 'completed']
            })
        });

        // 7. Cache order for quick retrieval
        try {
            await fetch(`${REDIS_URL}/cache`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: `order_${orderId}`,
                    value: { orderId, email, status: 'completed', items: cart },
                    ttl: 3600
                })
            });
        } catch (cacheErr) {
            logger.warn('order_cache_failed', { error: cacheErr.message });
        }

        // Success
        logger.info('order_placed', {
            orderId,
            email,
            item_count: cart?.length || 0,
            total_amount: cart?.reduce((s, i) => s + (i.price || 0), 0) || 0,
            chargeId: paymentData.id
        });

        res.json({
            success: true,
            orderId,
            chargeId: paymentData.id
        });

    } catch (error) {
        logger.error('checkout_failed', {
            error: error.message,
            orderId
        });
        return res.status(500).json({ error: 'Checkout failed: ' + error.message });
    }
});

// Simulate random error (for testing)
if (Math.random() < FAULT_CONFIG.checkout_error_rate) {
    // This is now handled per-request above
}

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    logger.info('server_started', { port: PORT });
});
