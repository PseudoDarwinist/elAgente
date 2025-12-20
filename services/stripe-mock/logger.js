const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'stripe-mock' },
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: '/app/logs/stripe-mock.log' })
    ]
});

module.exports = logger;
