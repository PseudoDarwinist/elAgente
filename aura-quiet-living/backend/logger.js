const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
    level: 'info',
    defaultMeta: { service: 'aura-backend' },
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: path.join(__dirname, 'logs', 'app.log')
        })
    ]
});

module.exports = logger;
