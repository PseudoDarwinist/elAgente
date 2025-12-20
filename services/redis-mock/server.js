const express = require('express');
const cors = require('cors');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 6379;

app.use(cors());
app.use(express.json());

// In-memory cache storage
const cache = new Map();

// Fault Injection State
let FAULT_CONFIG = {
    memory_full: false,
    connection_refused: false,
    slow_response: false
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
    const { memory_full, connection_refused, slow_response } = req.body;
    if (memory_full !== undefined) FAULT_CONFIG.memory_full = memory_full;
    if (connection_refused !== undefined) FAULT_CONFIG.connection_refused = connection_refused;
    if (slow_response !== undefined) FAULT_CONFIG.slow_response = slow_response;

    logger.warn('fault_config_updated', { config: FAULT_CONFIG });
    res.json({ message: 'Fault config updated', current: FAULT_CONFIG });
});

// Health check
app.get('/health', (req, res) => {
    if (FAULT_CONFIG.connection_refused) {
        return res.status(503).json({ status: 'unhealthy', error: 'Connection refused' });
    }
    res.json({ status: 'healthy', service: 'redis-mock' });
});

// Get cached value
app.get('/cache/:key', async (req, res) => {
    const { key } = req.params;

    if (FAULT_CONFIG.connection_refused) {
        logger.error('redis_connection_refused', {
            error: 'ECONNREFUSED',
            host: 'redis-mock',
            port: 6379
        });
        return res.status(503).json({ error: 'Connection refused' });
    }

    if (FAULT_CONFIG.slow_response) {
        await new Promise(r => setTimeout(r, 2000));
    }

    const value = cache.get(key);
    if (value) {
        logger.info('cache_hit', { key });
        return res.json({ key, value, hit: true });
    }

    logger.info('cache_miss', { key });
    res.json({ key, value: null, hit: false });
});

// Set cached value
app.post('/cache', async (req, res) => {
    const { key, value, ttl } = req.body;

    if (FAULT_CONFIG.connection_refused) {
        logger.error('redis_connection_refused', { error: 'ECONNREFUSED' });
        return res.status(503).json({ error: 'Connection refused' });
    }

    if (FAULT_CONFIG.memory_full) {
        logger.error('redis_memory_exhausted', {
            error: 'OOM',
            used_memory: '256MB',
            max_memory: '256MB'
        });
        return res.status(507).json({ error: 'Out of memory' });
    }

    cache.set(key, value);
    logger.info('cache_set', { key, ttl });

    // Auto-expire if TTL specified
    if (ttl) {
        setTimeout(() => cache.delete(key), ttl * 1000);
    }

    res.json({ success: true, key });
});

// Delete cached value
app.delete('/cache/:key', (req, res) => {
    const { key } = req.params;
    cache.delete(key);
    logger.info('cache_delete', { key });
    res.json({ success: true, key });
});

// Get cache stats
app.get('/stats', (req, res) => {
    res.json({
        size: cache.size,
        memory_used: `${cache.size * 100}B`, // Mock calculation
        uptime_seconds: process.uptime()
    });
});

app.listen(PORT, () => {
    console.log(`Redis Mock running on port ${PORT}`);
    logger.info('server_started', { port: PORT, service: 'redis-mock' });
});
