/**
 * Unit tests never reach production (setupFiles of the vitest `unit` project).
 *
 * A unit test runs with whatever env the shell has, and cloud sessions, hooks
 * and CI carry the production Supabase service key. 2026-09-24: the market
 * report test mocked its subscriber fetch to throw "db down" but not the alert
 * it raises, so every unit run with those keys inserted a real
 * crm_broker_alerts row that texted Matt "Market report send could not read
 * its subscriber list (db down)", eleven times from 09-20 to 09-24, capped only
 * by the alert's 6-hour dedupe. Blanking the credentials here makes any
 * unmocked production call fail at the client, for every unit file, instead of
 * relying on each test to mock the right module. A test that needs the live
 * database is an int test (*.int.test.ts) with its own residue contract.
 */
const LIVE_SERVICE_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_DB_URL',
  'DATABASE_URL',
  'RESEND_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_MESSAGING_SERVICE_SID',
]

for (const name of LIVE_SERVICE_ENV) delete process.env[name]
