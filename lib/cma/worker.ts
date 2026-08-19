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

import { listOpenCmaActions, updateCmaActionRow, getCmaActionPayload, getCmaServeHead, attachCmaToPerson } from '@/lib/data'
import { isCmaClientIntent, parseCmaClientIntent } from '@/lib/cma/client-intent'
import { parsePositiveInt, parsePositiveNumber } from '@/lib/cma/client-link'
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

/**
 * Ready-notify entries from a row's payload (D8 kick-off + notify contract).
 * Canonical shape is notify_broker_sms: [{person_id, broker}, …] — one entry
 * per kicker (the enqueuer plus everyone who attached to the open build).
 * Legacy scalar rows (notify_broker_sms: true + flat crm_person_id /
 * alert_broker, written before the contract became a list) still resolve to
 * their single entry. De-duped per person: queueBrokerAlert's timeline key is
 * per (slug, person), so a repeat person entry could never text twice anyway.
 */
function notifyEntries(payload: Record<string, unknown>): Array<{ personId: number; broker: string | null }> {
  const out: Array<{ personId: number; broker: string | null }> = []
  const raw = payload['notify_broker_sms']
  if (Array.isArray(raw)) {
    for (const e of raw) {
      if (e && typeof e === 'object') {
        const rec = e as Record<string, unknown>
        const personId = num(rec['person_id'])
        if (personId) out.push({ personId, broker: str(rec['broker']) })
      }
    }
  } else if (raw === true) {
    const personId = num(payload['crm_person_id'])
    if (personId) out.push({ personId, broker: str(payload['alert_broker']) })
  }
  const seen = new Set<number>()
  return out.filter((e) => (seen.has(e.personId) ? false : (seen.add(e.personId), true)))
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

  // Clobber guard: never build over a protected document. An open action can
  // outlive a finalize/deliver (the broker approved while the build sat queued
  // or retry-pending); building would flip the document back to draft with the
  // action's stale client fields and 404 the client's live /cma/[slug] link —
  // the upsert-by-slug clobber class (adversarial review 2026-07-17). New
  // requests for the address open a --vN slot via createCmaRequest instead.
  const existingDoc = await getCmaServeHead(slug)
  const existingStatus = existingDoc ? String(existingDoc.status ?? '') : null
  if (existingDoc && existingStatus !== 'draft') {
    await updateCmaActionRow(action.id, {
      status: 'killed',
      killed_reason: `Build skipped: the document at ${slug} is already ${existingStatus} — building would reset it to draft and break its delivered link.`,
    })
    return { slug, status: 'killed', error: `document already ${existingStatus}` }
  }

  const prior = (action.executor_response ?? {}) as Record<string, unknown>
  const attempts = (num(prior['build_attempts']) ?? 0) + 1

  await updateCmaActionRow(action.id, {
    status: 'in_production',
    executed_at: new Date().toISOString(),
  })

  const payload = action.payload
  const homeDetails =
    payload['home_details'] && typeof payload['home_details'] === 'object'
      ? (payload['home_details'] as Record<string, unknown>)
      : null
  const linkedPersonId = num(payload['crm_person_id']) ?? notifyEntries(payload)[0]?.personId ?? null
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
    personId: linkedPersonId,
    subjectFacts: {
      beds: parsePositiveInt(num(homeDetails?.bedrooms) ?? num(homeDetails?.beds)),
      baths: parsePositiveNumber(num(homeDetails?.bathrooms) ?? num(homeDetails?.baths)),
      sqft: parsePositiveInt(num(homeDetails?.square_feet) ?? num(homeDetails?.sqft)),
    },
    clientIntent: isCmaClientIntent(payload['client_intent'])
      ? payload['client_intent']
      : parseCmaClientIntent(str(payload['client_notes'])),
    // Spec 07 §4.1 — thread the doc type end to end (kills Defect 4). Expired
    // detection queues its CMA request with payload.doc_type='expired-audit';
    // the worker must pass it through so the built cmas row lands as an audit
    // (failure analysis + services standard + 2.5% net sheet) instead of a plain
    // CMA the prospecting surface then refuses to send.
    docType: str(payload['doc_type']) === 'expired-audit' ? 'expired-audit' : 'cma',
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

    // D8 kick-off + notify: a broker-initiated build texts EVERY kicker on the
    // row's notify list the moment the draft is ready — the enqueuer plus
    // anyone who attached while the build was open. Only rows whose payload
    // carries entries (set by kickoffCmaCore) — seller-LP / cron rows keep
    // their existing email-only behavior. The list is RE-READ here rather than
    // taken from the scan-time snapshot: attaches landing mid-build appended
    // to the row after listOpenCmaActions captured it, and the append RPC only
    // admits entries while status is open — so post-ready attaches self-handle
    // and pre-ready attaches are all visible to this read. queueBrokerAlert
    // dedupes per (kind, person) and is gated on the broker's SMS opt-in; a
    // notify failure never fails the build.
    try {
      const freshPayload = (await getCmaActionPayload(action.id)) ?? payload
      const entries = notifyEntries(freshPayload)
      // W5.1 person link: a kicked-off build knows its lead — stamp
      // cmas.person_id so person-scoped reads (getContactCmas, the person
      // page's Valuations lane) can see the doc. Fill-only; found live
      // 2026-08-05 with person_id null on a person-kicked CMA.
      const kickPersonId = linkedPersonId ?? entries[0]?.personId
      if (kickPersonId) {
        await attachCmaToPerson(slug, kickPersonId)
      }
      if (entries.length > 0) {
        const { queueCmaReadyAlert } = await import('@/lib/crm/broker-alerts')
        for (const entry of entries) {
          await queueCmaReadyAlert({
            slug,
            subjectAddress: str(payload['subject_address']),
            personId: entry.personId,
            broker: entry.broker,
          })
        }
      }
    } catch (e) {
      console.warn('[cma-worker] ready-notify failed:', e instanceof Error ? e.message : String(e))
    }
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
