/**
 * scripts/_backfill-cma-send-now-prospect-stamps.ts
 *
 * One-time reconciliation for the send-now defect (found 2026-09-29): a CMA
 * delivered from "Send now" was recorded on the CMA row, the CRM timeline and
 * email_events, but never on the owner's prospect row, so /admin/prospecting
 * showed the owner as never emailed. The rule set lives in
 * lib/data/prospecting/cma-send-stamp-backfill.ts (read that header first).
 *
 *   npx tsx scripts/_backfill-cma-send-now-prospect-stamps.ts            # DRY RUN, the default: reads and prints, writes nothing
 *   npx tsx scripts/_backfill-cma-send-now-prospect-stamps.ts --apply    # writes the stamps it printed
 *
 * Only --apply writes, and each write is guarded by `outreach_email_sent_at IS
 * NULL`, so re-running is safe: a row that already carries a send stamp is left
 * exactly as it is. Every read and write goes through the DAL
 * (lib/data/prospecting/cma-send-stamp-backfill.ts).
 *
 * Order of operations when this ships: deploy the send-path fix, THEN run this
 * with --apply. Until it runs, the six owners' rows still read "never emailed",
 * which means their CMA rows could still be re-sent.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

// `server-only` / `next/cache` throw in a bare tsx process, and every DAL
// module carries them. Install the resolve hook BEFORE anything under lib/** is
// imported, which is why every lib import below is dynamic, inside main().
const { installServerOnlyShim } = require('./lib/server-only-shim.cjs') as {
  installServerOnlyShim: (repoRoot?: string) => void
}
installServerOnlyShim()

import type { PlannedStamp, SkippedCma, StampPlan } from '@/lib/data/prospecting/cma-send-stamp-backfill'

const KNOWN_FLAGS = new Set(['--apply'])

function show(v: string | number | null | undefined): string {
  return v === null || v === undefined ? 'null' : String(v)
}

function printStamp(s: PlannedStamp): void {
  const { cma, prospect, before, patch } = s
  const ownerNote =
    s.recipientMatchesProspect === true
      ? 'same address as the owner email on the prospect row'
      : s.recipientMatchesProspect === false
        ? `DIFFERS from the owner email on the prospect row (${show(before.contactEmail)})`
        : 'the prospect row has no owner email to compare'
  console.log(`  ${cma.slug}   (cmas.status ${show(cma.status)})`)
  console.log(`    delivered ${cma.deliveredAt}  to ${cma.clientEmail}   [${ownerNote}]`)
  console.log(
    `    prospect ${prospect.kind}:${prospect.id}  found via ${prospect.via}` +
      `   now: sent_at=${show(before.emailSentAt)} status=${show(before.emailStatus)}` +
      ` message_id=${show(before.messageId)} crm_person=${show(before.crmPersonId)}`,
  )
  const messageIdNote = patch.outreach_email_message_id
    ? patch.outreach_email_message_id
    : before.messageId
      ? `(keeps existing ${before.messageId})`
      : '(no email_events sent row with a provider id)'
  const personNote =
    patch.outreach_crm_person_id != null
      ? String(patch.outreach_crm_person_id)
      : before.crmPersonId != null
        ? `(keeps existing ${before.crmPersonId})`
        : '(cmas.person_id is empty)'
  console.log(
    `    set   outreach_email_sent_at=${patch.outreach_email_sent_at}  outreach_email_status=${patch.outreach_email_status}` +
      `  outreach_email_message_id=${messageIdNote}  outreach_crm_person_id=${personNote}`,
  )
  const ev = s.sentEvent
  console.log(
    `    email_events 'sent' rows for cma:${cma.slug}: ${s.sentEventCount}` +
      (ev ? `  (used ${ev.occurredAt} to ${ev.recipientEmail})` : ''),
  )
}

function printSkipped(rows: SkippedCma[]): void {
  for (const r of rows) {
    console.log(
      `  ${r.slug}   delivered ${r.deliveredAt}   to ${show(r.recipient)}   ${r.reason}${r.detail ? `: ${r.detail}` : ''}`,
    )
  }
}

function summarize(plan: StampPlan): void {
  const byReason = new Map<string, number>()
  for (const s of plan.skipped) byReason.set(s.reason, (byReason.get(s.reason) ?? 0) + 1)
  console.log(`delivered cmas read (cmas.delivered_at is set): ${plan.delivered}`)
  console.log(`prospect rows to stamp: ${plan.stamps.length}`)
  console.log(`skipped: ${plan.skipped.length}`)
  for (const [reason, n] of [...byReason.entries()].sort()) console.log(`  ${reason}: ${n}`)
}

async function main() {
  const args = process.argv.slice(2)
  const unknown = args.filter((a) => !KNOWN_FLAGS.has(a))
  if (unknown.length > 0) {
    console.error(`Unknown argument: ${unknown.join(' ')}. The only flag is --apply. Nothing was run.`)
    process.exit(2)
  }
  const apply = args.includes('--apply')

  const { planCmaSendProspectStampBackfill, applyCmaSendProspectStamp } = await import(
    '@/lib/data/prospecting/cma-send-stamp-backfill'
  )

  console.log(
    `\nCMA send-now prospect stamp backfill  |  ${apply ? 'APPLY (writes)' : 'DRY RUN (writes nothing)'}  |  ${new Date().toISOString()}`,
  )
  console.log('source: cmas (delivered_at) -> resolveProspectForCmaSend -> expired_listings / fsbo_listings, email_events (sent, cma:<slug>)\n')

  const plan = await planCmaSendProspectStampBackfill()
  summarize(plan)

  console.log(`\nWOULD STAMP (${plan.stamps.length})`)
  if (plan.stamps.length === 0) console.log('  none')
  for (const s of plan.stamps) printStamp(s)

  console.log(`\nSKIPPED (${plan.skipped.length})`)
  if (plan.skipped.length === 0) console.log('  none')
  printSkipped(plan.skipped)

  if (!apply) {
    console.log('\nDRY RUN: nothing was written. Re-run with --apply to write the stamps above.\n')
    return
  }

  console.log(`\nAPPLYING ${plan.stamps.length} stamp(s)`)
  let written = 0
  let guarded = 0
  let failed = 0
  for (const s of plan.stamps) {
    const res = await applyCmaSendProspectStamp(s)
    if (!res.ok) {
      failed++
      console.log(`  FAILED  ${s.prospect.kind}:${s.prospect.id}  (${s.cma.slug}): ${res.error}`)
    } else if (res.updated) {
      written++
      console.log(`  stamped ${s.prospect.kind}:${s.prospect.id}  (${s.cma.slug})`)
    } else {
      guarded++
      console.log(`  guarded ${s.prospect.kind}:${s.prospect.id}  (${s.cma.slug}): outreach_email_sent_at was set meanwhile, left as is`)
    }
  }
  console.log(`\nwritten ${written}, guarded (already stamped) ${guarded}, failed ${failed}`)

  const after = await planCmaSendProspectStampBackfill()
  console.log(`re-check: ${after.stamps.length} prospect row(s) still left to stamp\n`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : String(e))
  process.exit(1)
})
