import * as Sentry from "@sentry/nextjs";
import { scrubDeep } from "./lib/analytics/private-paths";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Errors always. Tracing runs only when SENTRY_TRACES_SAMPLE_RATE is set: at a
  // flat 10% the crawled geo pages sent about 29K spans an hour (2026-09-24;
  // Sentry's charts show ten times that, because count() scales each sampled
  // span by 1/rate). Production runs 0.01 (Matt 2026-09-25): about 2.07M spans
  // a month at that busiest hour, inside the 5M every Sentry plan includes.
  tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE) : undefined,
  debug: false,
  // A signing link's token (and any secret query value) never leaves in a report.
  beforeSend: (event) => scrubDeep(event),
  beforeBreadcrumb: (crumb) => scrubDeep(crumb),
  beforeSendTransaction: (event) => scrubDeep(event),
});
