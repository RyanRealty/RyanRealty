// cron: manual-only Matt 2026-09-04 — unscheduled. This was the largest line on
// the xAI bill: four Grok Imagine clips every day at 13:10 UTC, $42.30 of the
// $62.62 spent in the week to 2026-09-04, against a Studio nobody was shipping
// from. The route still works; run it by hand with ?force=true when a slate is
// actually wanted, and re-add the vercel.json entry to put it back on a clock.
/**
 * Studio daily slate cron.
 *
 * Every morning, draft a small slate off real triggers and leave it waiting
 * in /admin/studio. It never posts and never approves: publishing needs a
 * human stamp (CLAUDE.md §1), and this route cannot supply one.
 *
 * Deliberately small: ONE draft a day (Matt, 2026-08-26). One good thing
 * daily clears in a minute and never piles up unapproved; a firehose nobody
 * clears is worth less than nothing. The spend cap keeps a bad day from being
 * an expensive day: the slate refuses to start if today's drafts are already
 * at the ceiling.
 *
 * Schedule: 13:10 UTC daily (see vercel.json), which is early morning local.
 * Auth: Authorization: Bearer $CRON_SECRET
 *
 * Manual:
 *   GET /api/cron/studio-slate?dryRun=true            plan only, spends nothing
 *   GET /api/cron/studio-slate?max=1
 *   GET /api/cron/studio-slate?format=place_video&subject=bend-old-bend&force=true
 *
 * `format` overrides the editorial plan for one draft, and `force` skips the
 * already-drafted-today guard. Both exist so a specific format can be
 * exercised on demand without waiting for tomorrow's slate.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { produceStudioDraft } from '@/lib/studio/produce'
import { planSlate } from '@/lib/studio/slate'
import type { StudioFormatId } from '@/lib/studio/formats'
import { studioAdapters } from '@/app/admin/(protected)/studio/adapters'
import { countStudioDraftsSince } from '@/lib/data/studio/drafts'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
import { getRecentStudioTriggers } from '@/lib/data/studio/triggers'

/** A slate of three can run several minutes: two stills, QA, and video each. */
export const maxDuration = 800

const DEFAULT_MAX = 1
/**
 * A day's slate should never cost more than this. One listing film is the
 * most expensive thing the studio makes: eight graded frames plus four
 * animated beats lands near $2.30, so $4 leaves room without licensing two.
 */
const DAILY_CAP_USD = 4

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === 'true'
  const max = Math.min(5, Math.max(1, Number(url.searchParams.get('max')) || DEFAULT_MAX))
  const force = url.searchParams.get('force') === 'true'
  const formatOverride = url.searchParams.get('format')
  const subjectOverride = url.searchParams.get('subject') ?? undefined
  const startedAt = new Date().toISOString()

  const midnight = new Date()
  midnight.setUTCHours(0, 0, 0, 0)
  const alreadyToday = force ? 0 : await countStudioDraftsSince(midnight.toISOString())
  if (alreadyToday >= max) {
    return NextResponse.json({
      ok: true,
      skipped: `Slate already drafted ${alreadyToday} today.`,
      startedAt,
    })
  }

  const [pulse, triggers] = await Promise.all([
    getMarketPulse({ geoType: 'city', geoSlug: 'bend' }),
    getRecentStudioTriggers(),
  ])

  const slate = formatOverride
    ? [
        {
          formatId: formatOverride as StudioFormatId,
          subjectQuery: subjectOverride,
          because: 'Manual run.',
        },
      ]
    : planSlate({ pulse, triggers, max: max - alreadyToday })

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, slate, startedAt })
  }

  const adapters = studioAdapters()
  const made: Array<Record<string, unknown>> = []
  const failed: Array<Record<string, unknown>> = []
  let spent = 0

  for (const item of slate) {
    if (spent >= DAILY_CAP_USD) {
      failed.push({ formatId: item.formatId, error: `Daily cap $${DAILY_CAP_USD} reached.` })
      break
    }
    try {
      const result = await produceStudioDraft(
        {
          formatId: item.formatId,
          subjectQuery: item.subjectQuery,
          brokerSlug: 'matt',
          requestedBy: 'studio-slate-cron',
          origin: 'slate',
        },
        adapters,
      )
      if (result.ok) {
        spent += result.spendUsd
        made.push({ draftId: result.draftId, formatId: item.formatId, spendUsd: result.spendUsd })
      } else {
        failed.push({ formatId: item.formatId, error: result.error })
      }
    } catch (err) {
      failed.push({
        formatId: item.formatId,
        error: err instanceof Error ? err.message : 'produce threw',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    made,
    failed,
    spentUsd: Number(spent.toFixed(4)),
    startedAt,
    finishedAt: new Date().toISOString(),
  })
}
