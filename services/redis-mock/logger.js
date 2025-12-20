const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'redis-mock' },
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: '/app/logs/redis-mock.log' })
    ]
});

module.exports = logger;
