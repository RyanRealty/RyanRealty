import * as Sentry from "@sentry/nextjs";

/** Browser bundle only receives NEXT_PUBLIC_* — ignore docs placeholders. */
function publicSentryDsn(): string | undefined {
  const d = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!d || d.includes("your-dsn")) return undefined;
  return d;
}

Sentry.init({
  dsn: publicSentryDsn(),
  tracesSampleRate: 1,
  debug: false,
});
