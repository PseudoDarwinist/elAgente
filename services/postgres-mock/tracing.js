/**
 * OpenTelemetry Instrumentation for Postgres Mock Service
 * MUST be imported FIRST before any other modules.
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'postgres-mock';
const OTEL_EXPORTER_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://tempo:4317';

console.log(`[OpenTelemetry] Initializing for service: ${SERVICE_NAME}`);
console.log(`[OpenTelemetry] Exporting to: ${OTEL_EXPORTER_ENDPOINT}`);

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
    sdk.shutdown()
        .then(() => console.log('[OpenTelemetry] SDK shut down'))
        .finally(() => process.exit(0));
});

module.exports = sdk;
