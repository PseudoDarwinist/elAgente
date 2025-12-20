/**
 * OpenTelemetry Instrumentation for Aura Backend
 * 
 * This MUST be imported FIRST before any other modules.
 * It auto-instruments HTTP, Express, and external calls.
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-grpc');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'aura-backend';
const OTEL_EXPORTER_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://tempo:4317';

console.log(`[OpenTelemetry] Initializing for service: ${SERVICE_NAME}`);
console.log(`[OpenTelemetry] Exporting to: ${OTEL_EXPORTER_ENDPOINT}`);

// Create resource with service name
const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
});

// Configure trace exporter (sends traces to Tempo)
const traceExporter = new OTLPTraceExporter({
    url: OTEL_EXPORTER_ENDPOINT,
});

// Configure metrics exporter (sends metrics to Prometheus via Tempo's metrics generator)
const metricExporter = new OTLPMetricExporter({
    url: OTEL_EXPORTER_ENDPOINT,
});

const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 5000,
});

// Initialize the SDK
const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations: [
        getNodeAutoInstrumentations({
            // Enable all auto-instrumentations but fine-tune some
            '@opentelemetry/instrumentation-http': {
                enabled: true,
                // Ignore health checks to reduce noise
                ignoreIncomingRequestHook: (request) => {
                    return request.url === '/health' || request.url === '/metrics';
                },
            },
            '@opentelemetry/instrumentation-express': {
                enabled: true,
            },
            '@opentelemetry/instrumentation-fs': {
                enabled: false, // Too noisy for our use case
            },
        }),
    ],
});

// Start the SDK
sdk.start();

console.log(`[OpenTelemetry] SDK started successfully`);

// Graceful shutdown
process.on('SIGTERM', () => {
    sdk.shutdown()
        .then(() => console.log('[OpenTelemetry] SDK shut down successfully'))
        .catch((error) => console.error('[OpenTelemetry] Error shutting down SDK:', error))
        .finally(() => process.exit(0));
});

module.exports = sdk;
