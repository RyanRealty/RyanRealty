/**
 * vitest `globalSetup` for the `int` project — the residue net.
 *
 * setup()    runs BEFORE any int test file. It sweeps marker rows old enough
 *            that no live run could still need them. This is the half that
 *            survives a killed run: it does not depend on the PREVIOUS run
 *            having reached its own teardown, which is exactly the case that
 *            stranded 17 `cmas` rows, 22 `crm_people` rows and 11
 *            `newsletter_subscribers` rows in production.
 *
 * teardown() runs after the last int test, including when tests FAILED (vitest
 *            runs globalSetup teardown on failure; `afterAll` inside a file
 *            does not run if the file crashed the worker). It sweeps every
 *            marker row created since this run started.
 *
 * Together: residue from a normal run is gone at teardown, residue from a
 * SIGKILLed run is gone at the next run's setup. Nothing accumulates.
 *
 * Skips silently without DB creds — same condition the int tests skip on, so a
 * credential-less checkout still runs green.
 */
import { config } from 'dotenv'
import { INT_MARKER, sweepIntResidue } from './int-scope'

config({ path: '.env.local' })

/** No int test runs anywhere near this long; anything older is abandoned. */
const STALE_MINUTES = 20

let runStartedAt = new Date().toISOString()

function haveDb(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())
}

async function client() {
  const { createServiceClient } = await import('@/lib/supabase/service')
  return createServiceClient()
}

function log(phase: string, report: Awaited<ReturnType<typeof sweepIntResidue>>) {
  const total = report.swept.reduce((n, s) => n + s.rows, 0)
  if (total) {
    const detail = report.swept.map((s) => `${s.table}=${s.rows}`).join(' ')
    console.log(`[int-scope] ${phase}: swept ${total} ${INT_MARKER} row(s) — ${detail}`)
  }
  for (const e of report.errors) console.warn(`[int-scope] ${phase}: ${e.table} — ${e.message}`)
}

export async function setup(): Promise<void> {
  runStartedAt = new Date().toISOString()
  if (!haveDb()) return
  log('pre-run', await sweepIntResidue(await client(), { mode: 'stale', olderThanMinutes: STALE_MINUTES }))
}

export async function teardown(): Promise<void> {
  if (!haveDb()) return
  log('post-run', await sweepIntResidue(await client(), { mode: 'since', sinceIso: runStartedAt }))
}
