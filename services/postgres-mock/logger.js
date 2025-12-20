const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'postgres-mock' },
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: '/app/logs/postgres-mock.log' })
    ]
});

module.exports = logger;
