import * as Sentry from "@sentry/nextjs";

/** Skip init when DSN is unset or still a docs placeholder (avoids "Invalid Sentry Dsn" in dev). */
function sentryDsn(): string | undefined {
  const d = process.env.SENTRY_DSN?.trim()
  if (!d || d.includes("your-dsn")) return undefined
  return d
}

Sentry.init({
  dsn: sentryDsn(),
  tracesSampleRate: 1,
  debug: false,
});
