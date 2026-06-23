/**
 * Environment variable validation + a typed Zod schema (audit p3.3, Stage 1).
 *
 * The schema documents and types every env var the app reads, with the SAME
 * required/optional split as before (no expansion). `Env` is the inferred type;
 * `env` is a typed, lazily-validated accessor. validateEnv (build) and
 * validateEnvRuntime (server boot) keep their EXACT prior behavior: they return
 * { ok, missing } and NEVER throw — app/layout.tsx console.error's on failure.
 *
 * Stage 2 (DONE 2026-06-22, runtime-boot only): assertRuntimeEnv() throws if a
 * required var is missing, called from instrumentation.ts register() in the
 * nodejs runtime and SKIPPED during `next build` (NEXT_PHASE) — so a missing
 * runtime-only var fails the running server loudly but can NEVER brick a deploy's
 * build. Verified with a build that has a required runtime var unset (still
 * succeeds). NOT done: a build-FAILING throw over the broader ~159-key surface,
 * which would need a conservative required-vs-optional sign-off against the real
 * Vercel build env (over-marking a build-required var bricks every deploy).
 *
 * zod is already a build dependency (used across lib/data/*); this joins it.
 */
import { z } from 'zod'

const nonEmpty = z.string().trim().min(1)

export const EnvSchema = z.object({
  // Required at build time (NEXT_PUBLIC_* are inlined into the client bundle).
  NEXT_PUBLIC_SUPABASE_URL: nonEmpty,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty,
  // Required at runtime (server data + sync); optional at build.
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty.optional(),
  SPARK_API_KEY: nonEmpty.optional(),
  // Optional integrations / config.
  NEXT_PUBLIC_SITE_URL: z.string().optional(),
  NEXT_PUBLIC_SITE_OWNER_EMAIL: z.string().optional(),
  NEXT_PUBLIC_SITE_OWNER_NAME: z.string().optional(),
  NEXT_PUBLIC_SITE_PHONE: z.string().optional(),
  NEXT_PUBLIC_SITE_ADDRESS: z.string().optional(),
  REVALIDATE_SECRET: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  FOLLOWUPBOSS_API_KEY: z.string().optional(),
  // CRM send/track secrets (CONTACT360 Phase 9.8). Listed so a missing one is
  // visible at boot instead of silently falling back to the service-role key /
  // 'insecure-dev-secret'. EMAIL_TRACKING_SECRET signs the open/click + unsubscribe
  // tokens (lib/email-tracking.ts, lib/email/unsubscribe-token.ts); CRON_SECRET
  // gates every cron send/track route (lib/auth/cron-auth.ts). Optional at build (a
  // missing one must never brick a deploy build); their presence is the running
  // server's concern. ci:crm-secrets requires both stay listed here, so a CRM send/
  // track path that references a NEW secret unlisted in this schema fails the gate.
  EMAIL_TRACKING_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  // CMA preview/delivery token signing secret (lib/cma-delivery-tokens.ts) — the
  // third member of the email-track/unsubscribe signing-secret fallback chain.
  CMA_PREVIEW_SECRET: z.string().optional(),
})

export type Env = z.infer<typeof EnvSchema>

/**
 * The required/optional split, preserved exactly (Stage 1: no expansion).
 * Exported so the partition coverage guard (lib/env.test.ts) can assert that
 * every EnvSchema key is classified into exactly one list and vice-versa — the
 * prerequisite invariant for a future ~159-key Stage-2 expansion.
 */
export const requiredForBuild = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const
export const requiredForRuntime = ['SUPABASE_SERVICE_ROLE_KEY', 'SPARK_API_KEY'] as const
export const optional = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SITE_OWNER_EMAIL',
  'NEXT_PUBLIC_SITE_OWNER_NAME',
  'NEXT_PUBLIC_SITE_PHONE',
  'NEXT_PUBLIC_SITE_ADDRESS',
  'REVALIDATE_SECRET',
  'INNGEST_SIGNING_KEY',
  'INNGEST_EVENT_KEY',
  'SENTRY_DSN',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'RESEND_API_KEY',
  'FOLLOWUPBOSS_API_KEY',
  'EMAIL_TRACKING_SECRET',
  'CRON_SECRET',
  'CMA_PREVIEW_SECRET',
] as const

function getEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined
}

/**
 * Typed env accessor. safeParse never throws — on a partial environment the
 * raw process.env is returned typed, so callers get autocomplete without a hard
 * failure (the validateEnv* functions are the boot-time gate).
 */
export function getValidatedEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env)
  return parsed.success ? parsed.data : (process.env as unknown as Env)
}

export function validateEnv(): { ok: boolean; missing: string[] } {
  const missing = requiredForBuild.filter((key) => !getEnv(key))
  return { ok: missing.length === 0, missing }
}

export function validateEnvRuntime(): { ok: boolean; missing: string[] } {
  const missing = [...requiredForBuild, ...requiredForRuntime].filter((key) => !getEnv(key))
  return { ok: missing.length === 0, missing }
}

/**
 * Stage 2 — fail LOUD at runtime server boot if a required var is missing,
 * instead of limping along and breaking in confusing ways downstream.
 *
 * Called ONLY from instrumentation.ts register() in the nodejs runtime, and ONLY
 * when NOT in the `next build` phase (the caller gates on NEXT_PHASE). That gate
 * is the safety guarantee: a missing runtime-only var (e.g. SPARK_API_KEY, which
 * the build doesn't need) can never brick a deploy's build — it only fails the
 * running server, where you WANT it to fail loud. In healthy production all four
 * required vars are present, so this throws never fires.
 */
export function assertRuntimeEnv(): void {
  const { ok, missing } = validateEnvRuntime()
  if (!ok) {
    throw new Error(
      `[env] Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Set them in .env.local (dev) or the Vercel project environment (prod).',
    )
  }
}

export function logOptionalEnv(): void {
  if (process.env.NODE_ENV !== 'development') return
  const notSet = optional.filter((key) => !getEnv(key))
  if (notSet.length > 0) {
    console.warn('[env] Optional vars not set:', notSet.join(', '))
  }
}
