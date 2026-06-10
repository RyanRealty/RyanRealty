/**
 * Publisher sweep cron.
 *
 * Polls marketing_brain_actions for status='approved' rows that are due
 * (scheduled_for IS NULL OR scheduled_for <= now()). For each row:
 *   1. Reads executor_response.publish_payload (built by producer during render).
 *   2. POSTs to /api/social/publish with that payload.
 *   3. Parses the response and collects externalPostId per platform.
 *   4. Updates the row to status='executed', published_at=now().
 *   5. Inserts a content_performance row per platform.
 *   6. On failure: writes to producer_execution_failures with phase='publish'.
 *      Does NOT flip the row off 'approved'; sweep retries on the next run
 *      unless retry_count >= 2, at which point it kills the row.
 *
 * Idempotency: the UPDATE to status='executed' only fires when the row is
 * still 'approved' (optimistic lock). A row already set to 'executed' by a
 * concurrent sweep call is skipped.
 *
 * Schedule: every 10 minutes (see vercel.json).
 * Auth: Authorization: Bearer $CRON_SECRET
 *
 * Manual invocation:
 *   GET /api/cron/publisher-sweep
 *     ?maxRows=10   (default 10)
 *     &dryRun=true  (returns candidates without publishing)
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { createServiceClient } from '@/lib/supabase/service'

export const maxDuration = 300

const DEFAULT_MAX_ROWS = 10
const MAX_RETRY_COUNT = 2

interface PublishResult {
  action_id: string
  action_type: string
  platforms_published: string[]
  platforms_failed: string[]
}

interface SweepError {
  action_id: string
  phase: string
  error: string
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const maxRowsParam = url.searchParams.get('maxRows')
  const dryRun = url.searchParams.get('dryRun') === 'true'

  const maxRows = maxRowsParam
    ? Math.max(1, parseInt(maxRowsParam, 10) || DEFAULT_MAX_ROWS)
    : DEFAULT_MAX_ROWS

  const startedAt = new Date().toISOString()
  const supabase = createServiceClient()

  // Fetch approved rows that are due.
  const { data: candidates, error: fetchErr } = await supabase
    .from('marketing_brain_actions')
    .select('id, action_type, executor_response, failure_log')
    .eq('status', 'approved')
    .or('scheduled_for.is.null,scheduled_for.lte.' + startedAt)
    .order('approved_at', { ascending: true })
    .limit(maxRows)

  if (fetchErr) {
    console.error('[publisher-sweep] fetch error:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const rows = candidates ?? []

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      candidates: rows.map((r) => ({
        id: r.id,
        action_type: r.action_type,
        has_publish_payload: !!(r.executor_response as Record<string, unknown> | null)?.publish_payload,
      })),
      startedAt,
    })
  }

  const published: PublishResult[] = []
  const errors: SweepError[] = []

  const cronSecret = process.env.CRON_SECRET
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  // Stamp utm_content=<action_id> onto every ryan-realty.com link in a publish
  // payload (ctaUrl, caption text, nested per-platform fields). A seller lead who
  // clicks through the published post then lands on the LP with the action_id in
  // the URL; the seller LP forwards that into the FUB sourceUrl and the
  // seller-lead-attribution cron matches it back to THIS content_performance row.
  // This is the sender half of the north-star attribution path. Idempotent.
  function stampAttributionUtm(value: unknown, actionId: string, actionType: string): unknown {
    if (typeof value === 'string') {
      return value.replace(/https?:\/\/(?:www\.)?ryan-realty\.com\/[^\s"')]*/gi, (urlStr) => {
        try {
          const u = new URL(urlStr)
          if (!u.searchParams.has('utm_content')) u.searchParams.set('utm_content', actionId)
          if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', actionType)
          if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'social')
          // 'social' (not 'organic_post') so GA4's default channel grouping
          // buckets the click as Organic Social instead of Unassigned.
          if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'social')
          return u.toString()
        } catch {
          return urlStr
        }
      })
    }
    if (Array.isArray(value)) return value.map((v) => stampAttributionUtm(v, actionId, actionType))
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = stampAttributionUtm(v, actionId, actionType)
      }
      return out
    }
    return value
  }

  for (const row of rows) {
    const executorResponse = (row.executor_response ?? {}) as Record<string, unknown>
    const publishPayload = executorResponse.publish_payload as Record<string, unknown> | undefined

    // If producer has not written a publish_payload, log and skip.
    if (!publishPayload) {
      await supabase.from('producer_execution_failures').insert({
        action_id: row.id,
        producer_slug: 'publisher-sweep',
        phase: 'publish_payload_missing',
        error_message: 'executor_response.publish_payload is absent. Producer has not completed the render phase.',
        occurred_at: new Date().toISOString(),
        retry_count: 0,
      })
      errors.push({ action_id: row.id, phase: 'publish_payload_missing', error: 'publish_payload absent' })
      continue
    }

    // Check existing failure count to enforce kill threshold.
    const existingFailures = Array.isArray(row.failure_log) ? (row.failure_log as unknown[]).filter(
      (f) => (f as Record<string, unknown>).phase === 'publish'
    ).length : 0

    if (existingFailures >= MAX_RETRY_COUNT) {
      const { error: killErr } = await supabase
        .from('marketing_brain_actions')
        .update({
          status: 'killed',
          killed_reason: `publisher-sweep: exceeded ${MAX_RETRY_COUNT} publish retry attempts`,
        })
        .eq('id', row.id)
        .eq('status', 'approved')
      if (killErr) {
        console.error(`[publisher-sweep] kill error for ${row.id}:`, killErr.message)
      }
      errors.push({ action_id: row.id, phase: 'publish', error: 'killed after max retries' })
      continue
    }

    // Stamp the action_id into every ryan-realty.com link so a click-through
    // attributes back to this row (north-star path).
    const stampedPayload = stampAttributionUtm(
      publishPayload,
      row.id,
      typeof row.action_type === 'string' ? row.action_type : 'content',
    ) as Record<string, unknown>

    // POST to /api/social/publish.
    let publishResponse: Response
    try {
      publishResponse = await fetch(`${appUrl}/api/social/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': cronSecret ?? '',
        },
        body: JSON.stringify(stampedPayload),
      })
    } catch (fetchError) {
      const msg = fetchError instanceof Error ? fetchError.message : String(fetchError)
      await recordPublishFailure(supabase, row.id, msg)
      errors.push({ action_id: row.id, phase: 'publish', error: msg })
      continue
    }

    let publishBody: Record<string, unknown>
    try {
      publishBody = await publishResponse.json()
    } catch {
      publishBody = {}
    }

    if (!publishResponse.ok && !(publishBody.partialSuccess)) {
      const msg = typeof publishBody.error === 'string'
        ? publishBody.error
        : `HTTP ${publishResponse.status}`
      await recordPublishFailure(supabase, row.id, msg)
      errors.push({ action_id: row.id, phase: 'publish', error: msg })
      continue
    }

    // Collect per-platform results.
    const results = (publishBody.results ?? {}) as Record<string, Record<string, unknown>>
    const platformsPublished: string[] = []
    const platformsFailed: string[] = []

    for (const [platform, result] of Object.entries(results)) {
      if (result.success) {
        platformsPublished.push(platform)
      } else {
        platformsFailed.push(platform)
      }
    }

    const publishedAt = new Date().toISOString()

    // Optimistic lock: only UPDATE rows still in 'approved' status.
    const { data: updated, error: updateErr } = await supabase
      .from('marketing_brain_actions')
      .update({
        status: 'executed',
        published_at: publishedAt,
        executor_response: {
          ...executorResponse,
          publish_result: publishBody,
          published_at: publishedAt,
          platforms_published: platformsPublished,
          // Canonical post-identity the performance-pull crons read
          // (executor_response.published_to: [{ platform, post_id }]). Without
          // this the 48h/7d/30d metric pulls iterate an empty array and
          // content_performance never gets real metrics.
          published_to: platformsPublished.map((p) => ({
            platform: p,
            post_id:
              typeof results[p]?.externalPostId === 'string'
                ? (results[p].externalPostId as string)
                : null,
          })),
        },
      })
      .eq('id', row.id)
      .eq('status', 'approved')
      .select('id')

    if (updateErr || !updated?.length) {
      // Either an update error or the row was claimed by a concurrent sweep.
      const reason = updateErr?.message ?? 'already_executed_by_concurrent_run'
      errors.push({ action_id: row.id, phase: 'status_update', error: reason })
      continue
    }

    // Insert one content_performance row per successfully published platform.
    const assetLibraryRefs = Array.isArray(publishPayload.asset_library_refs)
      ? publishPayload.asset_library_refs
      : []

    for (const platform of platformsPublished) {
      const platformResult = results[platform]
      const externalPostId = typeof platformResult?.externalPostId === 'string'
        ? platformResult.externalPostId
        : null

      const { error: perfInsertErr } = await supabase
        .from('content_performance')
        .upsert(
          {
            action_id: row.id,
            platform,
            post_external_id: externalPostId,
            posted_at: publishedAt,
            asset_library_refs: assetLibraryRefs,
            north_star_attributed_seller_leads: 0,
          },
          { onConflict: 'action_id,platform' }
        )

      if (perfInsertErr) {
        console.error(
          `[publisher-sweep] content_performance insert error for ${row.id}/${platform}:`,
          perfInsertErr.message
        )
      }
    }

    published.push({
      action_id: row.id,
      action_type: row.action_type,
      platforms_published: platformsPublished,
      platforms_failed: platformsFailed,
    })
  }

  return NextResponse.json({
    startedAt,
    rows_processed: rows.length,
    published_count: published.length,
    error_count: errors.length,
    published,
    errors,
  })
}

async function recordPublishFailure(
  supabase: ReturnType<typeof createServiceClient>,
  actionId: string,
  errorMessage: string
) {
  // Increment failure_log on the action row.
  const { data: actionRow } = await supabase
    .from('marketing_brain_actions')
    .select('failure_log')
    .eq('id', actionId)
    .single()

  const existingLog = Array.isArray(actionRow?.failure_log) ? actionRow.failure_log as unknown[] : []
  const newEntry = { phase: 'publish', error: errorMessage, at: new Date().toISOString() }
  const updatedLog = [...existingLog, newEntry]

  await supabase
    .from('marketing_brain_actions')
    .update({ failure_log: updatedLog })
    .eq('id', actionId)

  await supabase.from('producer_execution_failures').insert({
    action_id: actionId,
    producer_slug: 'publisher-sweep',
    phase: 'publish',
    error_message: errorMessage,
    occurred_at: new Date().toISOString(),
    retry_count: updatedLog.filter((e) => (e as Record<string, unknown>).phase === 'publish').length - 1,
  })
}
