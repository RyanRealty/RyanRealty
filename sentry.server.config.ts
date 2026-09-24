import * as Sentry from "@sentry/nextjs";
import { scrubDeep } from "./lib/analytics/private-paths";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // 10% sampling in production keeps trace cost bounded.
  // Dev uses full sampling for debugging. Goal acceptance criterion: <= 0.2 in prod.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
  debug: false,
  // A signing link's token (and any secret query value) never leaves in a report.
  beforeSend: (event) => scrubDeep(event),
  beforeBreadcrumb: (crumb) => scrubDeep(crumb),
  beforeSendTransaction: (event) => scrubDeep(event),
});
