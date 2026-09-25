/**
 * /api/cron/market-report-publish: publish the monthly Central Oregon market
 * report for the month that just ended.
 *
 * Runs after the daily refresh (app/api/cron/market-report-refresh) has
 * brought the store current. publishEdition (lib/market-report/pipeline.ts)
 * builds the edition from the stored series, runs the Spark × Supabase
 * reconciliation gate (CLAUDE.md §0: any figure Spark can reproduce that is
 * more than 1% off stops the edition), renders the PDF under THE
 * PAGE CONTRACT, stores it and publishes it. A held edition is stored as a
 * draft with the reason, and ONE deduped ops text goes to the owner through
 * queueBrokerHealthAlert. Nothing is sent to a client or posted anywhere.
 *
 * Idempotent: a month already published is left alone unless ?force=1.
 * ?month=YYYY-MM publishes a specific month (a late re-run). ?dry=1 builds,
 * gates and renders the month and writes nothing, sends nothing: the check
 * that a deployment can render the PDF (Chromium and the fonts traced into
 * the function) before the 8th.
 *
 * Schedule: 15:23 UTC on the 8th (vercel.json). A week after month end most
 * late closings are recorded; the daily refresh runs at 11:17 UTC first.
 * Auth: Authorization: Bearer ${CRON_SECRET} (requireCronAuth).
 */
import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import { getEditionForWrite } from '@/lib/data/market-report/editions'
import { monthLabel } from '@/lib/market-report/format'
import { lastCompleteMonth, publishEdition } from '@/lib/market-report/pipeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 800

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const url = new URL(request.url)
  const asked = url.searchParams.get('month')
  const month = asked && /^\d{4}-\d{2}$/.test(asked) ? asked : lastCompleteMonth()
  const force = url.searchParams.get('force') === '1'
  const dryRun = url.searchParams.get('dry') === '1'
  const log: string[] = []

  try {
    if (dryRun) {
      const outcome = await publishEdition({ month, dryRun: true, log: (l) => log.push(l) })
      return NextResponse.json({ ok: true, month, dryRun: true, outcome: { ...outcome, reconciliation: undefined }, log })
    }

    const existing = await getEditionForWrite(month)
    if (existing?.status === 'published' && !force) {
      return NextResponse.json({ ok: true, month, skipped: 'already published' })
    }

    const outcome = await publishEdition({ month, log: (l) => log.push(l) })
    if (outcome.status === 'held') {
      await queueBrokerHealthAlert({
        key: `market-report-hold-${month}`,
        body: `The ${monthLabel(month)} market report is held as a draft: a figure it prints disagrees with the MLS by more than 1%. ${outcome.holdReason?.slice(0, 200) ?? ''}`,
        cooldownMinutes: 1440,
      })
      return NextResponse.json({ ok: false, month, held: outcome.holdReason, log })
    }

    revalidateTag(cacheTag.market, 'max')
    revalidatePath('/housing-market/reports/monthly')
    revalidatePath(`/housing-market/reports/monthly/${month}`)
    return NextResponse.json({ ok: true, month, outcome: { ...outcome, reconciliation: undefined }, log })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // A dry run is a deployment check: its failure is the response, not a text to the owner.
    if (dryRun) return NextResponse.json({ ok: false, month, dryRun: true, error: message, log }, { status: 500 })
    await queueBrokerHealthAlert({
      key: `market-report-publish-${month}`,
      body: `The ${monthLabel(month)} market report did not publish: ${message.slice(0, 180)}`,
      cooldownMinutes: 1440,
    })
    return NextResponse.json({ ok: false, month, error: message, log }, { status: 500 })
  }
}
