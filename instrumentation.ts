import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Stage 2 env fail-fast: throw at server boot if a required var is missing,
    // so an env misconfiguration surfaces immediately instead of as confusing
    // downstream breakage. Skipped during `next build` (NEXT_PHASE) so a missing
    // runtime-only var can never brick a deploy's build. No-op in healthy prod.
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      const { assertRuntimeEnv } = await import("./lib/env");
      assertRuntimeEnv();
    }
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
