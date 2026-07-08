/**
 * _ws4-verify-email-delivery.mts — READ-ONLY verification for the WS4 delivery
 * DAL (lib/data/crm/emailDelivery.ts). Runs the two new readers against the
 * REAL database and prints their output, so the delivery surfaces are proven
 * to render real data before integration.
 *
 *   npx tsx scripts/_ws4-verify-email-delivery.mts
 *
 * The DAL is written for the Next.js server runtime ('server-only' +
 * lib/supabase/service). To execute it under plain tsx we stub the two
 * Next-runtime-only modules BEFORE importing the DAL:
 *   - 'server-only'  -> {} (it is a build-time poison pill, not runtime code)
 *   - 'next/cache'   -> unstable_cache passthrough (imported transitively via
 *     getEmailReporting; none of its cached entry points are called here)
 * Nothing else is mocked — every query below hits the live database read-only.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ── Stub Next-runtime-only modules in the CJS loader tsx compiles through ────
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown
}
const originalLoad = Module._load
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'server-only') return {}
  if (request === 'next/cache') {
    return {
      unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
      revalidateTag: () => undefined,
      revalidatePath: () => undefined,
    }
  }
  return originalLoad.call(this, request, parent, isMain)
}

// ── Load .env.local (same var names the app uses) ────────────────────────────
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const envPath = path.join(root, '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const [, key, raw] = m
    if (process.env[key] !== undefined) continue
    process.env[key] = raw.replace(/^["']|["']$/g, '')
  }
}

async function main() {
  const { getGlobalDeliverySummary, getPersonDeliveryHistory } =
    await import('../lib/data/crm/emailDelivery')
  const { getPersonSubscriptionOutlook } = await import('../lib/data/crm/emailDeliveryOutlook')

  console.log('── getGlobalDeliverySummary({ days: 30 }) ─────────────────────────')
  const summary = await getGlobalDeliverySummary({ days: 30 })
  console.log(JSON.stringify(
    {
      windowDays: summary.windowDays,
      unreadable: summary.unreadable,
      subscriptionCounts: summary.subscriptionCounts,
      streams: summary.streams,
      attentionCount: summary.attention.length,
      attention: summary.attention.slice(0, 8),
      recentSends: summary.recentSends.slice(0, 6),
    },
    null,
    2,
  ))

  // Pick a person who actually has sends: the most recent send row with a person id.
  const withPerson = summary.recentSends.find((r) => r.personId)
  const personId = withPerson?.personId ?? null
  const email = withPerson?.recipientEmail ?? null

  if (personId) {
    console.log(`\n── getPersonDeliveryHistory({ personId: ${personId} }) ────────────`)
    const history = await getPersonDeliveryHistory({ personId, email, limit: 10 })
    console.log(JSON.stringify({ totalSends: history.totalSends, rows: history.rows }, null, 2))

    console.log(`\n── getPersonSubscriptionOutlook(${personId}) ──────────────────────`)
    const outlook = await getPersonSubscriptionOutlook(personId, email)
    console.log(JSON.stringify(outlook, null, 2))
  } else {
    console.log('\n(no recent send carries a person_id in this window; skipping person probes)')
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('VERIFY FAILED:', e)
  process.exit(1)
})
