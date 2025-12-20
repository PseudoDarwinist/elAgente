FROM node:20-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Create log directory
RUN mkdir -p logs

# Environment variables for OpenTelemetry
ENV OTEL_SERVICE_NAME=aura-backend
ENV OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4317

EXPOSE 4000

# Use npm start to load tracing.js before server.js
CMD ["npm", "start"]
