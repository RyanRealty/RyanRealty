import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // 10% sampling in production keeps trace cost bounded.
  // Dev uses full sampling for debugging. Goal acceptance criterion: <= 0.2 in prod.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
  debug: false,
});
