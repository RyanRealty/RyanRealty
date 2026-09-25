import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Errors always. Tracing is off (undefined) unless SENTRY_TRACES_SAMPLE_RATE
  // is set: at a flat 10% the crawled geo pages sent about 300K spans an hour
  // (2026-09-24), so a trace rate is a deliberate choice, not a default.
  tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE) : undefined,
  debug: false,
});
