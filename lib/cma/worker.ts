/**
 * CMA build worker — drains `content:cma` rows in marketing_brain_actions
 * through the deterministic builder (the LLM producer-runtime that used to
 * own these rows is dead — no Anthropic credits — which left 12 rows stuck
 * in_production).
 *
 * Build only. NO sending of any kind — the built CMA lands as a `cmas` row in
 * status 'draft' for Matt's review at /admin/cmas, and the action row moves
 * to 'ready' with an executor_response. Repeated failures (3 attempts) kill
 * the action row with the reason recorded.
 */

import { listOpenCmaActions, updateCmaActionRow } from '@/lib/data'
import type { CmaActionRow } from '@/lib/data'
import { buildCma } from '@/lib/cma/build'
import { slugifyAddress } from '@/lib/cma-request'

const MAX_ATTEMPTS = 3
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export interface CmaWorkerRunResult {
  scanned: number
  built: number
  failed: number
  killed: number
  results: Array<{ actionId: string; slug: string; status: string; error?: string }>
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : null
  return s || null
}

function slugForAction(action: CmaActionRow): string | null {
  // Canonical slug IS the action row's target slug (G47 single-path rule).
  const fromTarget = action.target?.startsWith('cma:') ? action.target.slice(4).trim() : null
  if (fromTarget) return fromTarget.toLowerCase()
  const fromPayload = str(action.payload['cma_slug'])
  if (fromPayload) return fromPayload.toLowerCase()
  const addr = str(action.payload['subject_address'])
  return addr ? slugifyAddress(addr) : null
}

async function processOne(action: CmaActionRow): Promise<{ slug: string; status: string; error?: string }> {
  const slug = slugForAction(action)
  if (!slug) {
    await updateCmaActionRow(action.id, {
      status: 'killed',
      killed_reason: 'No slug derivable from target or payload.',
    })
    return { slug: '(none)', status: 'killed', error: 'no slug' }
  }

  const prior = (action.executor_response ?? {}) as Record<string, unknown>
  const attempts = (num(prior['build_attempts']) ?? 0) + 1

  await updateCmaActionRow(action.id, {
    status: 'in_production',
    executed_at: new Date().toISOString(),
  })

  const payload = action.payload
  const result = await buildCma({
    slug,
    rawAddress: str(payload['subject_address']),
    city: str(payload['subject_city']),
    postalCode: str(payload['subject_postal_code']),
    client: {
      name: str(payload['client_name']),
      email: str(payload['client_email']),
      phone: str(payload['client_phone']),
      notes: str(payload['client_notes']),
    },
    brokerSlug: str(payload['broker_slug']),
    brokerEmail: str(payload['broker_email']),
    sellerImprovementsTotal: num(payload['seller_improvements_total']),
    sellerImprovementsText: str(payload['seller_improvements']),
    requestSource:
      str((action.data_evidence ?? {})['request_source'] as string | undefined) ?? 'brain-queue',
  })

  if (result.ok) {
    await updateCmaActionRow(action.id, {
      status: 'ready',
      executor_response: {
        ...prior,
        build_attempts: attempts,
        built_by: 'cma-build-worker (deterministic, no LLM)',
        built_at: new Date().toISOString(),
        cma_slug: slug,
        preview_url: `${SITE_URL}/cma/${slug}`,
        admin_review_url: `${SITE_URL}/admin/cmas/${slug}`,
        recommended_list: result.pricing?.recommended ?? null,
        value_low: result.pricing?.valueLow ?? null,
        value_high: result.pricing?.valueHigh ?? null,
        comps_count: result.comps?.length ?? 0,
        confidence: result.pricing?.confidence ?? null,
        page_count: result.pageCount ?? null,
      },
    })
    return { slug, status: 'ready' }
  }

  const failureEntry = {
    at: new Date().toISOString(),
    attempt: attempts,
    error: (result.error ?? 'unknown').slice(0, 500),
    source: 'cma-build-worker',
  }
  const failureLog = Array.isArray(action.failure_log) ? [...action.failure_log, failureEntry] : [failureEntry]
  if (attempts >= MAX_ATTEMPTS) {
    await updateCmaActionRow(action.id, {
      status: 'killed',
      killed_reason: `Deterministic build failed ${attempts} times. Last error: ${(result.error ?? 'unknown').slice(0, 300)}`,
      executor_response: { ...prior, build_attempts: attempts, last_error: result.error ?? 'unknown' },
      failure_log: failureLog,
    })
    return { slug, status: 'killed', error: result.error }
  }
  await updateCmaActionRow(action.id, {
    // Back to pending so the next run retries.
    status: 'pending',
    executor_response: { ...prior, build_attempts: attempts, last_error: result.error ?? 'unknown' },
    failure_log: failureLog,
  })
  return { slug, status: 'retry-pending', error: result.error }
}

export async function runCmaBuildWorker(maxPerRun = 3): Promise<CmaWorkerRunResult> {
  const actions = await listOpenCmaActions(maxPerRun)
  const out: CmaWorkerRunResult = { scanned: actions.length, built: 0, failed: 0, killed: 0, results: [] }
  for (const action of actions) {
    try {
      const r = await processOne(action)
      out.results.push({ actionId: action.id, ...r })
      if (r.status === 'ready') out.built++
      else if (r.status === 'killed') out.killed++
      else out.failed++
    } catch (e) {
      out.failed++
      out.results.push({
        actionId: action.id,
        slug: '(error)',
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }
  return out
}
