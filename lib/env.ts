/**
 * Environment variable validation. Step 23 Task 4.
 * Required for build; optional vars log a warning.
 */

const requiredForBuild = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

const requiredForRuntime = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SPARK_API_KEY',
] as const

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

export function validateEnv(): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  for (const key of requiredForBuild) {
    if (!getEnv(key)) missing.push(key)
  }
  return { ok: missing.length === 0, missing }
}

export function validateEnvRuntime(): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  for (const key of [...requiredForBuild, ...requiredForRuntime]) {
    if (!getEnv(key)) missing.push(key)
  }
  return { ok: missing.length === 0, missing }
}

export function logOptionalEnv(): void {
  if (process.env.NODE_ENV !== 'development') return
  const notSet = optional.filter((key) => !getEnv(key))
  if (notSet.length > 0) {
    console.warn('[env] Optional vars not set:', notSet.join(', '))
  }
}
