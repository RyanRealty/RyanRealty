/**
 * Backfill the hard bounce on the CMA whose slug starts with cma-1109-yapoah.
 *
 * The send left on 2026-09-28 (about 1:02 PM Pacific) from matt@ryan-realty.com
 * through Gmail and came back 550 5.1.1. The row still reads as sent because
 * delivered_at is the moment it left, and nothing stamped the bounce.
 *
 * DRY RUN IS THE DEFAULT. This prints the writes and does not touch the
 * database. Pass --apply to write. It does not call Gmail, Resend, or any
 * other live API. delivered_at is not cleared.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-cma-yapoah-bounce.ts
 *   npx tsx --env-file=.env.local scripts/backfill-cma-yapoah-bounce.ts --apply
 */

import { mergeCmaDelivery } from '@/lib/cma/delivery-status'
import { backfillWritesEnabled, planYapoahBounceBackfill, YAPOAH_SLUG_PREFIX } from '@/lib/cma/yapoah-bounce-plan'

type CmaHit = {
  slug: string
  status: string | null
  delivered_at: string | null
  client_email: string | null
  person_id: number | null
  build_summary: unknown
}

type SentHit = {
  recipient_email: string | null
  occurred_at: string | null
  message_id: string | null
  email_key: string | null
  meta: Record<string, unknown> | null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

async function main(): Promise<void> {
  const apply = backfillWritesEnabled(process.argv)
  console.log(apply ? 'APPLY (writes)' : 'DRY RUN (no writes)')

  const { createServiceClient } = await import('@/lib/supabase/service')
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('cmas')
    .select('slug, status, delivered_at, client_email, person_id, build_summary')
    .ilike('slug', `${YAPOAH_SLUG_PREFIX}%`)
    .order('slug', { ascending: true })
    .limit(20)
  if (error) {
    console.error(`cmas read failed: ${error.message}`)
    process.exitCode = 1
    return
  }
  const rows = (data ?? []) as CmaHit[]
  if (rows.length === 0) {
    console.log(`no cmas row with slug starting ${YAPOAH_SLUG_PREFIX}`)
    return
  }
  if (rows.length === 20) {
    console.error('slug prefix matched 20 rows. Refusing to guess. Narrow the prefix.')
    process.exitCode = 1
    return
  }

  const { recordEmailEvent } = await import('@/lib/crm/email-events')
  const { insertEmailBounceTimeline } = await import('@/lib/data/crm/gmailBounceWatch')
  const { addSuppression } = await import('@/lib/crm/suppressions')
  const { readCmaBuildSummaryForMerge, updateCmaRowFieldsBySlug } = await import('@/lib/data')

  let writes = 0
  for (const row of rows) {
    const slug = String(row.slug)
    const emailKey = `cma:${slug}`
    const { data: sentData, error: sentError } = await sb
      .from('email_events')
      .select('recipient_email, occurred_at, message_id, email_key, meta')
      .eq('email_key', emailKey)
      .eq('event', 'sent')
      .order('occurred_at', { ascending: false })
      .limit(20)
    if (sentError) {
      console.log(`${slug}: sent-event read failed: ${sentError.message}`)
      continue
    }
    const sents = ((sentData ?? []) as SentHit[]).map((s) => {
      const meta = s.meta && typeof s.meta === 'object' ? s.meta : {}
      return {
        recipientEmail: str(s.recipient_email),
        occurredAt: str(s.occurred_at),
        transport: str(meta.transport),
        mailbox: str(meta.mailbox),
        messageId: str(s.message_id),
        emailKey: str(s.email_key),
      }
    })
    const plan = planYapoahBounceBackfill(
      {
        slug,
        status: str(row.status),
        deliveredAt: str(row.delivered_at),
        clientEmail: str(row.client_email),
        personId: typeof row.person_id === 'number' ? row.person_id : null,
        buildSummary: row.build_summary,
      },
      sents,
    )
    if (!plan.ok) {
      console.log(`${slug}: skip. ${plan.reason}`)
      continue
    }
    for (const line of plan.lines) console.log(line)
    if (!apply) continue

    const prior = await readCmaBuildSummaryForMerge(slug)
    if (!prior.ok) {
      console.error(`${slug}: summary read failed: ${prior.error}. Nothing else written for this row.`)
      process.exitCode = 1
      continue
    }
    const saved = await updateCmaRowFieldsBySlug(slug, {
      build_summary: mergeCmaDelivery(prior.summary, plan.stamp),
    })
    if (!saved.ok) {
      console.error(`${slug}: summary write failed: ${saved.error}`)
      process.exitCode = 1
      continue
    }
    const rec = await recordEmailEvent({
      messageId: plan.messageId,
      recipientEmail: plan.recipient,
      personId: plan.personId,
      sendType: 'cma',
      event: 'bounce',
      emailKey: plan.emailKey,
      meta: {
        source: 'gmail-dsn',
        hard: true,
        status: '5.1.1',
        smtp: '550',
        backfill: 'cma-1109-yapoah',
      },
    })
    if (!rec.ok) console.error(`${slug}: bounce event failed: ${rec.error}`)
    if (plan.personId) {
      await insertEmailBounceTimeline({
        personId: plan.personId,
        title: 'Email bounced',
        body: `Delivery failed for ${plan.recipient}. 550 5.1.1.`,
        broker: null,
        dedupeKey: `gmail-dsn:${plan.messageId ?? plan.emailKey}:bounce:p${plan.personId}`,
        payload: {
          email: plan.recipient,
          emailKey: plan.emailKey,
          hard: true,
          status: '5.1.1',
          backfill: true,
        },
      })
      await addSuppression({
        personId: plan.personId,
        channel: 'email',
        reason: `Gmail DSN 5.1.1 for ${plan.recipient}`,
        source: 'gmail-dsn',
        value: plan.recipient,
      })
    }
    writes++
    console.log(`${slug}: wrote`)
  }

  if (!apply) console.log('DRY RUN. Nothing written. Re-run with --apply to write.')
  else console.log(`wrote ${writes} row(s)`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
