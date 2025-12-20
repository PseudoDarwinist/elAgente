/**
 * OpenTelemetry Instrumentation for Redis Mock Service
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'redis-mock';
const OTEL_EXPORTER_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://tempo:4317';

console.log(`[OpenTelemetry] Initializing for service: ${SERVICE_NAME}`);

const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
});

const traceExporter = new OTLPTraceExporter({
    url: OTEL_EXPORTER_ENDPOINT,
});

const sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
        getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-http': { enabled: true },
            '@opentelemetry/instrumentation-express': { enabled: true },
            '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
    ],
});

sdk.start();
console.log(`[OpenTelemetry] SDK started successfully`);

process.on('SIGTERM', () => {
    sdk.shutdown().finally(() => process.exit(0));
});

module.exports = sdk;
