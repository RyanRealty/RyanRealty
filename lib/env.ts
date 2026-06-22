/**
 * Environment variable validation + a typed Zod schema (audit p3.3, Stage 1).
 *
 * The schema documents and types every env var the app reads, with the SAME
 * required/optional split as before (no expansion). `Env` is the inferred type;
 * `env` is a typed, lazily-validated accessor. validateEnv (build) and
 * validateEnvRuntime (server boot) keep their EXACT prior behavior: they return
 * { ok, missing } and NEVER throw — app/layout.tsx console.error's on failure.
 *
 * Stage 2 (deliberately NOT done here): make validation build-FAILING by throwing
 * in instrumentation.ts. That needs a verified `next build` against the real
 * Vercel env + a conservative required-vs-optional sign-off, since over-marking a
 * var as required bricks every deploy. Until then this is additive + non-throwing.
 *
 * zod is already a build dependency (used across lib/data/*); this joins it.
 */
import { z } from 'zod'

const nonEmpty = z.string().trim().min(1)

const EnvSchema = z.object({
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
})

export type Env = z.infer<typeof EnvSchema>

/** The required/optional split, preserved exactly (Stage 1: no expansion). */
const requiredForBuild = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const
const requiredForRuntime = ['SUPABASE_SERVICE_ROLE_KEY', 'SPARK_API_KEY'] as const
const optional = [
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

export function logOptionalEnv(): void {
  if (process.env.NODE_ENV !== 'development') return
  const notSet = optional.filter((key) => !getEnv(key))
  if (notSet.length > 0) {
    console.warn('[env] Optional vars not set:', notSet.join(', '))
  }
}
