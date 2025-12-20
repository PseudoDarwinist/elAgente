const express = require('express');
const cors = require('cors');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 5432;

app.use(cors());
app.use(express.json());

// Fault Injection State
let FAULT_CONFIG = {
    connection_timeout: false,
    query_slow: false,
    disk_full: false
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
    const { connection_timeout, query_slow, disk_full } = req.body;
    if (connection_timeout !== undefined) FAULT_CONFIG.connection_timeout = connection_timeout;
    if (query_slow !== undefined) FAULT_CONFIG.query_slow = query_slow;
    if (disk_full !== undefined) FAULT_CONFIG.disk_full = disk_full;

    logger.warn('fault_config_updated', { config: FAULT_CONFIG });
    res.json({ message: 'Fault config updated', current: FAULT_CONFIG });
});

// Health check
app.get('/health', (req, res) => {
    if (FAULT_CONFIG.connection_timeout) {
        return res.status(503).json({ status: 'unhealthy', error: 'Connection timeout' });
    }
    res.json({ status: 'healthy', service: 'postgres-mock' });
});

// Mock database query endpoint
app.get('/query', async (req, res) => {
    const { table } = req.query;

    // Simulate connection timeout
    if (FAULT_CONFIG.connection_timeout) {
        logger.error('database_connection_failed', {
            error: 'ConnectionTimeout',
            host: 'postgres-mock',
            port: 5432,
            retry_count: 5
        });
        return res.status(503).json({
            error: 'Connection timeout',
            code: 'ETIMEDOUT',
            host: 'postgres-mock'
        });
    }

    // Simulate slow query
    if (FAULT_CONFIG.query_slow) {
        await new Promise(r => setTimeout(r, 3000));
    }

    // Simulate disk full
    if (FAULT_CONFIG.disk_full) {
        logger.error('disk_space_exhausted', {
            error: 'DiskFull',
            available_bytes: 0,
            required_bytes: 1048576
        });
        return res.status(507).json({
            error: 'Insufficient storage',
            code: 'ENOSPC'
        });
    }

    // Normal response - mock inventory data
    logger.info('query_executed', { table, rows_returned: 10 });
    res.json({
        success: true,
        table: table || 'inventory',
        rows: [
            { id: 1, product: 'Meditation Candle', stock: 50 },
            { id: 2, product: 'Zen Garden Kit', stock: 25 },
            { id: 3, product: 'Bamboo Incense', stock: 100 }
        ],
        execution_time_ms: 12
    });
});

// Mock insert/update endpoint
app.post('/execute', async (req, res) => {
    const { query, params } = req.body;

    if (FAULT_CONFIG.connection_timeout) {
        logger.error('database_write_failed', {
            error: 'ConnectionTimeout',
            query: query?.substring(0, 50)
        });
        return res.status(503).json({ error: 'Connection timeout' });
    }

    logger.info('query_executed', { query: query?.substring(0, 50), affected_rows: 1 });
    res.json({ success: true, affected_rows: 1 });
});

app.listen(PORT, () => {
    console.log(`Postgres Mock running on port ${PORT}`);
    logger.info('server_started', { port: PORT, service: 'postgres-mock' });
});
