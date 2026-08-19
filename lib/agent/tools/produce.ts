/**
 * lib/agent/tools/produce.ts — the produce-protocol tool set for the broker
 * SMS agent (docs/plans/BROKER_SMS_AGENT_2026-07-31.md R3.1-R3.4 + Amendment
 * R2.9/R3.6/R3.7).
 *
 * Six tools, all thin wrappers over existing DAL/protocol functions (zero new
 * query paths, per R2.2):
 *   create_action  — the produce-protocol INSERT, guarded by the retired-
 *                     format refusal, the third-party-listing refusal (R3.7),
 *                     and the coming-soon/pre-market compliance affordance
 *                     (R3.6) — in that order.
 *   run_now        — text producers complete in-process via runProducerRow
 *                     (no waiting for the hourly producer-runtime cron);
 *                     visual producers are left for the local render worker
 *                     with an honest ETA.
 *   revise_action  — feedback -> needs_changes -> immediate re-run.
 *   approve_action — ready -> approved (the literal-token APPROVE check
 *                     itself lives in the runtime keyword layer, R2.4 — this
 *                     tool just resolves WHICH job and stamps the approval).
 *   hold_action    — approved -> ready rollback ("wait, hold that").
 *   job_status     — the broker's active jobs as numbered handles, in plain
 *                     language (no "action row / producer / registry" jargon
 *                     — edge-case ledger A.9).
 *
 * Job handles are 1-based indices into listBrokerJobs()'s stable
 * (created_at ASC) ordering — the SAME numbering everywhere in a
 * conversation, so "APPROVE 2" always means the second-oldest active job.
 *
 * G1 boundary: this file never calls Supabase directly. Every
 * marketing_brain_actions read/write goes through lib/data/agent/actions.ts.
 */
import fs from 'fs'
import path from 'path'
import type { AgentContext, AgentTool, ToolOutcome, AgentCitation } from '@/lib/agent/types'
import {
  createActionRow,
  listBrokerJobs,
  getActionForBroker,
  appendChangeRequest,
  approveAction,
  unapproveAction,
  setInProduction,
  type BrokerJobRow,
} from '@/lib/data/agent/actions'
import { runProducerRow } from '@/lib/marketing-brain/run-producer-core'
import {
  classifyProducerFromDisk,
  canCloudComplete,
  buildVisualDeferralEnvelope,
  type ProducerOutputClass,
} from '@/lib/marketing-brain/producer-output-class'
import { inferListingState } from '@/lib/agent/listing-state'
import { findCmaSubjectByMls, findCmaSubjectByAddress } from '@/lib/data/cma/builderReads'

// ── registry resolution (never hard-coded — CLAUDE.md §5) ──────────────────

const REGISTRY_PATH = path.join(process.cwd(), 'marketing_brain_skills/producers/REGISTRY.md')

/**
 * Resolve an action_type to its assigned_producer path by reading
 * marketing_brain_skills/producers/REGISTRY.md at call time — the brain's
 * documented source of truth, never a hard-coded map that can drift out of
 * sync with a registry edit. Table rows look like:
 *   | name | `path/` | `content:x`, `content:y` | approval | run_time | notes |
 * Returns null when no row's action_types cell contains an exact match.
 */
export function resolveProducerFromRegistry(actionType: string, registryPath: string = REGISTRY_PATH): string | null {
  let content: string
  try {
    content = fs.readFileSync(registryPath, 'utf-8')
  } catch {
    return null
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue
    const inner = trimmed.split('|').slice(1, -1).map((c) => c.trim())
    if (inner.length < 3) continue
    if (/^-+$/.test(inner[0])) continue // markdown separator row
    if (inner[0].toLowerCase() === 'producer_name') continue // header row
    if (inner.some((c) => /UNUSED\s*\/\s*DO NOT DISPATCH/i.test(c))) continue
    const pathMatch = inner[1].match(/`([^`]+)`/)
    if (!pathMatch) continue
    const tokens = [...inner[2].matchAll(/`([^`]+)`/g)].map((m) => m[1].trim())
    if (tokens.includes(actionType)) return pathMatch[1]
  }
  return null
}

// ── retired-format refusal (R0.3) ───────────────────────────────────────────

/**
 * Video producers were decommissioned 2026-06-14 (Matt directive) and removed
 * from REGISTRY.md entirely — resolveProducerFromRegistry would already
 * return null for these, but this explicit list lets create_action give the
 * honest "retired" answer instead of the generic "no producer registered"
 * one. Kept in sync with REGISTRY.md's decommission note.
 */
const RETIRED_ACTION_TYPES = new Set([
  'content:listing_video',
  'content:listing_reel',
  'content:market_video',
  'content:news_clip',
  'content:neighborhood_tour',
  'content:listing_reveal',
  'content:market_data_video',
  'content:youtube_long_form_market_report',
  'content:news_video',
  'content:area_guides',
  'content:data_viz_video',
  'content:avatar_market_update',
  'content:earth_zoom',
  'content:google_maps_flyover',
  'content:market_report_video',
  'content:coming_soon_teaser',
  'content:tiktok_listing_tour',
  'content:youtube_long_form_walkthrough',
  'content:map_route_video',
  'content:school_district_overlay',
  'content:walkability_overlay',
  'content:market_pulse_short',
  'content:clip_compilation',
  'content:monthly_market_report_orchestrator',
  'content:listing_launch',
])
/** Defensive fallback for any retired-adjacent action_type not in the explicit set above. */
const RETIRED_TOKEN_RE = /video|reel/i

export function isRetiredActionType(actionType: string): boolean {
  const at = (actionType ?? '').trim()
  if (!at) return false
  if (RETIRED_ACTION_TYPES.has(at)) return true
  return RETIRED_TOKEN_RE.test(at)
}

// ── listing resolution for the R3.6/R3.7 guards ─────────────────────────────

interface ResolvedListingSignal {
  found: boolean
  standardStatus?: string | null
  listAgentEmail?: string | null
  onMarketDate?: string | null
}

/** `123 NW Foo St` -> { streetNumber: '123', streetNameIlike: '%NW Foo St%' }. */
function parseAddressForLookup(address: string): { streetNumber: string; streetNameIlike: string } | null {
  const m = address.trim().match(/^(\d+)\s+(.+)$/)
  if (!m) return null
  return { streetNumber: m[1], streetNameIlike: `%${m[2].trim()}%` }
}

/**
 * Best-effort listing resolution for the guard checks below — deliberately
 * reuses the existing CMA-builder DAL reads (lib/data/cma/builderReads.ts)
 * rather than the public getListingDetail(), because the public reader
 * SUPPRESSES Coming Soon rows (returns null, indistinguishable from "no
 * listing"). The guards here need the raw StandardStatus, including Coming
 * Soon and NULL, to work at all.
 */
async function resolveListingForGuard(payload: Record<string, unknown>): Promise<ResolvedListingSignal> {
  const mlsId = typeof payload.mlsId === 'string' ? payload.mlsId.trim() : ''
  const address = typeof payload.address === 'string' ? payload.address.trim() : ''
  const city = typeof payload.city === 'string' ? payload.city.trim() : ''

  let rows: Record<string, unknown>[] = []
  try {
    if (mlsId) {
      rows = (await findCmaSubjectByMls(mlsId)) as Record<string, unknown>[]
    } else if (address) {
      const parsed = parseAddressForLookup(address)
      if (parsed) {
        rows = (await findCmaSubjectByAddress({
          streetNumber: parsed.streetNumber,
          streetNameIlike: parsed.streetNameIlike,
          cityIlike: city ? `%${city}%` : null,
        })) as Record<string, unknown>[]
      }
    }
  } catch {
    rows = []
  }

  if (rows.length === 0) return { found: false }
  const row = rows[0]
  return {
    found: true,
    standardStatus: typeof row.StandardStatus === 'string' ? row.StandardStatus : null,
    listAgentEmail: typeof row.list_agent_email === 'string' ? row.list_agent_email : null,
    onMarketDate: typeof row.OnMarketDate === 'string' ? row.OnMarketDate : null,
  }
}

/** Does this action name a specific property (vs. a city/topic/page target)? */
function targetsProperty(target: string, payload: Record<string, unknown>): boolean {
  if (typeof payload.mlsId === 'string' && payload.mlsId.trim()) return true
  if (typeof payload.address === 'string' && payload.address.trim()) return true
  return /^(mls|manual):/i.test(target ?? '')
}

// ── job labels + plain-language status (edge-case ledger A.9: no jargon) ───

const PRODUCER_KIND_LABEL: Record<string, string> = {
  'content:cma': 'CMA',
  'content:ig_single_post': 'IG post',
  'content:ig_carousel': 'IG carousel',
  'content:flyer': 'flyer',
  'content:just_listed_flyer': 'just-listed flyer',
  'content:open_house_flyer': 'open-house flyer',
  'content:feature_sheet': 'feature sheet',
  'content:blog_post': 'blog post',
  'content:seo_blog': 'blog post',
  'content:list_kit': 'listing kit',
}

function kindLabel(actionType: string): string {
  return PRODUCER_KIND_LABEL[actionType] ?? actionType.replace(/^content:/, '').replace(/_/g, ' ')
}

/** A short subject for a job label ("CMA Awbrey", "IG post Tumalo"). */
function shortSubject(job: BrokerJobRow): string {
  const addr = typeof job.payload?.address === 'string' ? (job.payload.address as string) : ''
  if (addr) {
    const words = addr.replace(/^\d+\s*/, '').split(/\s+/).filter(Boolean)
    if (words.length > 0) return words.slice(0, 2).join(' ')
  }
  const target = job.target || ''
  return target.replace(/^(mls|city|neighborhood|manual|topic|segment|contact):/i, '')
}

export function jobLabel(job: BrokerJobRow): string {
  const kind = kindLabel(job.actionType)
  const subject = shortSubject(job)
  return subject ? `${kind} ${subject}` : kind
}

/** drafting / rendering / ready for your review / approved - posting soon / needs changes. */
export function humanStatus(job: BrokerJobRow): string {
  if (job.status === 'pending') return 'queued'
  if (job.status === 'in_production') {
    const deferred = job.executorResponse?.deferred_to_local_render === true
    return deferred ? 'rendering' : 'drafting'
  }
  if (job.status === 'ready') return 'ready for your review'
  if (job.status === 'approved') return 'approved - posting soon'
  if (job.status === 'needs_changes') return 'needs changes'
  return job.status
}

// ── shared helpers ───────────────────────────────────────────────────────────

function classifySafe(
  producerSlug: string,
): { ok: true; cls: ProducerOutputClass } | { ok: false; error: string } {
  try {
    const { cls } = classifyProducerFromDisk(producerSlug, process.cwd())
    return { ok: true, cls }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Map a text producer's payload-provenance citations into AgentCitation rows. */
function mapCitations(raw: unknown[] | undefined): AgentCitation[] {
  if (!Array.isArray(raw)) return []
  const out: AgentCitation[] = []
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue
    const rec = c as Record<string, unknown>
    const figure = typeof rec.figure === 'string' ? rec.figure : null
    const source = typeof rec.source === 'string' ? rec.source : null
    if (!figure || !source) continue
    out.push({
      figure,
      source,
      detail: typeof rec.payload_field === 'string' ? `payload.${rec.payload_field}` : undefined,
    })
  }
  return out
}

type ResolveResult = { ok: true; job: BrokerJobRow } | { ok: false; result: Record<string, unknown> }

/**
 * Resolve a tool's target job from either a direct action_id or a numbered
 * handle. Handles number against the FULL active job list (not a status-
 * filtered subset) so "job 2" means the same thing in job_status,
 * revise_action, approve_action, and hold_action alike. `statusFilter` (when
 * given) both auto-picks the single matching job when there's exactly one,
 * and validates an explicit handle actually points at a job in that state.
 * Ambiguous cases NEVER guess (R2.4) — they return the numbered list and ask.
 */
async function resolveHandleOrActionId(
  input: Record<string, unknown>,
  ctx: AgentContext,
  opts?: { statusFilter?: (job: BrokerJobRow) => boolean; verb?: string },
): Promise<ResolveResult> {
  const directId = typeof input.action_id === 'string' ? input.action_id.trim() : ''
  if (directId) {
    const job = await getActionForBroker(directId, ctx.brokerSlug)
    if (!job) return { ok: false, result: { ok: false, message: "I couldn't find that job." } }
    return { ok: true, job }
  }

  const jobs = await listBrokerJobs(ctx.brokerSlug)
  const filtered = opts?.statusFilter ? jobs.filter(opts.statusFilter) : jobs

  const rawHandle = input.handle
  const handle = typeof rawHandle === 'number' ? rawHandle : Number(rawHandle)

  if (Number.isFinite(handle) && handle > 0) {
    const target = jobs[handle - 1]
    if (!target) return { ok: false, result: { ok: false, message: `I don't have a job ${handle}.` } }
    if (opts?.statusFilter && !opts.statusFilter(target)) {
      return {
        ok: false,
        result: {
          ok: false,
          message: `${jobLabel(target)} is ${humanStatus(target)}${opts.verb ? `, not ready to ${opts.verb}` : ''}.`,
        },
      }
    }
    return { ok: true, job: target }
  }

  if (filtered.length === 0) {
    return {
      ok: false,
      result: {
        ok: false,
        message: opts?.verb
          ? `You don't have anything to ${opts.verb} right now.`
          : "You don't have any active jobs right now.",
      },
    }
  }

  if (filtered.length === 1) return { ok: true, job: filtered[0] }

  const list = jobs.map((j, i) => `${i + 1}: ${jobLabel(j)} (${humanStatus(j)})`).join(' · ')
  return { ok: false, result: { ok: false, needs_clarification: true, message: `Which one? ${list}` } }
}

// ── create_action ────────────────────────────────────────────────────────────

const CREATE_ACTION_SCHEMA = {
  type: 'object',
  properties: {
    action_type: {
      type: 'string',
      description:
        "The marketing_brain_actions action_type. Live formats: 'content:cma', 'content:ig_single_post', " +
        "'content:ig_carousel', 'content:flyer', 'content:just_listed_flyer', 'content:open_house_flyer', " +
        "'content:feature_sheet', 'content:blog_post', 'content:seo_blog', 'content:list_kit'. " +
        'Listing video/reel formats were retired 2026-06-14 — do not offer them.',
    },
    target: {
      type: 'string',
      description:
        "e.g. 'mls:220189422' (resolved listing), 'manual:18705-tumalo-reservoir-rd' (pre-market, no MLS row), " +
        "'city:Bend', 'neighborhood:Awbrey Butte', 'topic:wildfire-risk-2026'.",
    },
    request_text: {
      type: 'string',
      description: "The broker's verbatim request — recorded verbatim as generation_reason.",
    },
    payload: {
      type: 'object',
      description: 'Any specifics the broker gave for the producer to use.',
      properties: {
        address: { type: 'string' },
        mlsId: { type: 'string' },
        city: { type: 'string' },
        topic: { type: 'string' },
        listing_agreement_confirmed: {
          type: 'boolean',
          description:
            'The broker confirmed in-thread that a signed listing agreement exists. Required before any ' +
            'pre-market or coming-soon content — ask for this explicitly if the property has no MLS row yet ' +
            'or is Coming Soon, do not assume it.',
        },
        broker_provided_facts: {
          type: 'object',
          description:
            'Price/beds/baths/sqft the broker supplied for a pre-market property with no MLS row (R2.10). ' +
            'Confirm every value back to the broker verbatim before calling this tool.',
        },
      },
    },
  },
  required: ['action_type', 'target', 'request_text'],
} as const

async function handleCreateAction(input: Record<string, unknown>, ctx: AgentContext): Promise<ToolOutcome> {
  const actionType = String(input.action_type ?? '').trim()
  const target = String(input.target ?? '').trim()
  const requestText = String(input.request_text ?? '').trim()
  const payload: Record<string, unknown> =
    input.payload && typeof input.payload === 'object' ? { ...(input.payload as Record<string, unknown>) } : {}

  if (!actionType || !target) {
    return {
      result: {
        ok: false,
        refused: true,
        reason: 'missing_input',
        message: 'I need both what to make and what property or topic it is for.',
      },
    }
  }

  // Guard 1 — retired format (R0.3).
  if (isRetiredActionType(actionType)) {
    return {
      result: {
        ok: false,
        refused: true,
        reason: 'format_retired',
        message:
          'That format (video/reel) was retired 2026-06-14 and there is no producer left to build it. I can do ' +
          'a flyer, an Instagram carousel, an Instagram post, a blog post, or a full listing kit instead.',
      },
    }
  }

  if (targetsProperty(target, payload)) {
    const resolved = await resolveListingForGuard(payload)

    // Guard 2 — third-party listing (R3.7).
    if (
      resolved.found &&
      resolved.listAgentEmail &&
      !resolved.listAgentEmail.toLowerCase().endsWith('@ryan-realty.com')
    ) {
      return {
        result: {
          ok: false,
          refused: true,
          reason: 'third_party_listing',
          message:
            `That listing is held by another brokerage (${resolved.listAgentEmail}), not Ryan Realty. ` +
            "Advertising another firm's active listing without written consent is a violation, so I can't " +
            'produce marketing for it. If Ryan Realty represented the buyer and it has closed, I can do a ' +
            '"represented the buyer" just-sold post instead.',
        },
      }
    }

    // Guard 3 — coming-soon / pre-market compliance affordance (R3.6). The
    // exact clear-cooperation day count is intentionally NOT stated here —
    // R4.1 verifies the current NAR/MLSCO window against a primary source
    // before this module cites a number (CLAUDE.md §0: no invented timelines).
    const state = inferListingState({
      hasListingRow: resolved.found,
      freshShootAvailable: !resolved.found,
      standardStatus: resolved.standardStatus,
      onMarketDate: resolved.onMarketDate,
    })
    if ((state.state === 'pre_market' || state.state === 'coming_soon') && payload.listing_agreement_confirmed !== true) {
      return {
        result: {
          ok: false,
          refused: true,
          reason: 'listing_agreement_required',
          message:
            'Before I build anything for a pre-market or coming-soon property, confirm a signed listing ' +
            'agreement is in place. Once public marketing starts it starts the MLS clear-cooperation ' +
            'submission clock, so we cannot sit on it indefinitely after that — reply back once the ' +
            'agreement is signed and I will get started.',
        },
      }
    }
  }

  const assignedProducer = resolveProducerFromRegistry(actionType)
  if (!assignedProducer) {
    return {
      result: {
        ok: false,
        refused: true,
        reason: 'no_producer',
        message:
          "I don't have a producer registered for that yet. I can do: CMA, flyer, IG post, IG carousel, " +
          'blog post, or a full listing kit.',
      },
    }
  }

  const topic = typeof payload.topic === 'string' && payload.topic.trim() ? payload.topic.trim() : target
  const created = await createActionRow({
    topic,
    format: actionType.replace(/^content:/, ''),
    actionType,
    target,
    assignedProducer,
    payload: {
      ...payload,
      requested_via: 'broker_sms',
      requested_by_slug: ctx.brokerSlug,
      requested_by_cell: ctx.brokerCell,
    },
    generatedBy: 'broker_sms_agent',
    generationReason: `broker_sms: ${requestText}`,
    assignedApprover: ctx.brokerSlug,
  })

  if (!created.ok) {
    return {
      result: { ok: false, refused: false, reason: 'insert_failed', message: `Something went wrong creating that job: ${created.error}` },
    }
  }

  // Best-effort session bookkeeping — lib/data/agent/sessions.ts (R1.3) is
  // being built in parallel; a missing/failing addActiveAction must never
  // block the broker from getting their job created.
  try {
    const sessions = await import('@/lib/data/agent/sessions')
    await sessions.addActiveAction(ctx.sessionId, created.id)
  } catch (e) {
    console.warn('[produce.create_action] addActiveAction unavailable or failed (non-blocking):', e)
  }

  return {
    result: {
      ok: true,
      action_id: created.id,
      action_type: actionType,
      target,
      status: 'pending',
      assigned_producer: assignedProducer,
      message: `Queued: ${kindLabel(actionType)} for ${target}.`,
    },
  }
}

// ── run_now ──────────────────────────────────────────────────────────────────

const RUN_NOW_SCHEMA = {
  type: 'object',
  properties: {
    action_id: { type: 'string', description: 'The marketing_brain_actions row id returned by create_action.' },
  },
  required: ['action_id'],
} as const

async function handleRunNow(input: Record<string, unknown>, ctx: AgentContext): Promise<ToolOutcome> {
  const actionId = String(input.action_id ?? '').trim()
  if (!actionId) return { result: { ok: false, message: 'Which job? I need the job id.' } }

  const job = await getActionForBroker(actionId, ctx.brokerSlug)
  if (!job) return { result: { ok: false, message: "I couldn't find that job." } }

  if (job.status !== 'pending') {
    return { result: { ok: true, already: true, status: job.status, message: `${jobLabel(job)} is already ${humanStatus(job)}.` } }
  }

  const cls = classifySafe(job.assignedProducer)
  if (!cls.ok) return { result: { ok: false, message: `I can't run that producer: ${cls.error}` } }

  if (!canCloudComplete(cls.cls)) {
    const envelope = buildVisualDeferralEnvelope({}, cls.cls, job.assignedProducer)
    const started = await setInProduction(actionId, envelope)
    if (!started.ok) return { result: { ok: false, message: `Couldn't start that job: ${started.error}` } }
    return {
      result: {
        ok: true,
        deferred: true,
        message: 'Started — render takes about 15 minutes, I will text you the link when it is ready.',
      },
    }
  }

  const started = await setInProduction(actionId)
  if (!started.ok) return { result: { ok: false, message: `Couldn't start that job: ${started.error}` } }

  const ran = await runProducerRow(actionId, { triggeredBy: 'broker_sms' })
  if (!ran.ok) return { result: { ok: false, message: `That run failed: ${ran.error}` } }

  return {
    result: {
      ok: true,
      draft_summary: ran.draftSummary,
      deliverable_text: ran.deliverableText,
      cost_usd: ran.costUsd,
      message: `${ran.draftSummary ?? 'Draft ready.'} Reply APPROVE to post, or tell me what to change.`,
    },
    citations: mapCitations(ran.citations),
  }
}

// ── revise_action ────────────────────────────────────────────────────────────

const REVISE_ACTION_SCHEMA = {
  type: 'object',
  properties: {
    handle: { type: 'number', description: 'The numbered job handle from job_status.' },
    action_id: { type: 'string', description: 'Direct job id, if already known.' },
    feedback: { type: 'string', description: "The broker's verbatim revision feedback." },
  },
  required: ['feedback'],
} as const

async function handleReviseAction(input: Record<string, unknown>, ctx: AgentContext): Promise<ToolOutcome> {
  const feedback = String(input.feedback ?? '').trim()
  if (!feedback) return { result: { ok: false, message: 'What should I change?' } }

  const resolved = await resolveHandleOrActionId(input, ctx)
  if (!resolved.ok) return { result: resolved.result }
  const { job } = resolved

  const appended = await appendChangeRequest(job.id, feedback, { author: ctx.brokerEmail })
  if (!appended.ok) return { result: { ok: false, message: `Couldn't log that feedback: ${appended.error}` } }

  const cls = classifySafe(job.assignedProducer)
  if (!cls.ok) return { result: { ok: false, message: `I can't re-run that producer: ${cls.error}` } }

  if (!canCloudComplete(cls.cls)) {
    const envelope = buildVisualDeferralEnvelope({}, cls.cls, job.assignedProducer)
    const started = await setInProduction(job.id, envelope)
    if (!started.ok) return { result: { ok: false, message: `Couldn't restart that job: ${started.error}` } }
    return {
      result: {
        ok: true,
        deferred: true,
        message: 'Reworking it now — render takes about 15 minutes, I will text you the updated link.',
      },
    }
  }

  const started = await setInProduction(job.id)
  if (!started.ok) return { result: { ok: false, message: `Couldn't restart that job: ${started.error}` } }

  const ran = await runProducerRow(job.id, { triggeredBy: 'broker_sms' })
  if (!ran.ok) return { result: { ok: false, message: `That revision failed: ${ran.error}` } }

  return {
    result: {
      ok: true,
      draft_summary: ran.draftSummary,
      deliverable_text: ran.deliverableText,
      cost_usd: ran.costUsd,
      message: `${ran.draftSummary ?? 'Updated draft ready.'} Reply APPROVE to post, or tell me what else to change.`,
    },
    citations: mapCitations(ran.citations),
  }
}

// ── approve_action ───────────────────────────────────────────────────────────

const APPROVE_ACTION_SCHEMA = {
  type: 'object',
  properties: {
    handle: {
      type: 'number',
      description: 'The numbered job handle — required when more than one job is ready for review.',
    },
  },
} as const

async function handleApproveAction(input: Record<string, unknown>, ctx: AgentContext): Promise<ToolOutcome> {
  const resolved = await resolveHandleOrActionId(input, ctx, {
    statusFilter: (j) => j.status === 'ready',
    verb: 'approve',
  })
  if (!resolved.ok) return { result: resolved.result }
  const { job } = resolved

  const approved = await approveAction(job.id, { approvedBy: ctx.brokerEmail, assignedApprover: ctx.brokerSlug })
  if (!approved.ok) {
    const message =
      approved.reason === 'not_ready'
        ? `${jobLabel(job)} isn't ready to approve anymore — it's ${humanStatus(job)}.`
        : `Couldn't approve that: ${approved.error}`
    return { result: { ok: false, message } }
  }

  return {
    result: {
      ok: true,
      action_id: job.id,
      message: `Approved — ${jobLabel(job)} will post within the next 30 minutes.`,
    },
  }
}

// ── hold_action ──────────────────────────────────────────────────────────────

const HOLD_ACTION_SCHEMA = {
  type: 'object',
  properties: {
    handle: {
      type: 'number',
      description: 'The numbered job handle — required when more than one job is approved and not yet posted.',
    },
  },
} as const

async function handleHoldAction(input: Record<string, unknown>, ctx: AgentContext): Promise<ToolOutcome> {
  const resolved = await resolveHandleOrActionId(input, ctx, {
    statusFilter: (j) => j.status === 'approved',
    verb: 'hold',
  })
  if (!resolved.ok) return { result: resolved.result }
  const { job } = resolved

  const held = await unapproveAction(job.id)
  if (!held.ok) return { result: { ok: false, message: `Couldn't hold that: ${held.error}` } }

  return {
    result: {
      ok: true,
      action_id: job.id,
      message: `Holding ${jobLabel(job)} — it won't post. Reply APPROVE when you're ready.`,
    },
  }
}

// ── job_status ───────────────────────────────────────────────────────────────

const JOB_STATUS_SCHEMA = { type: 'object', properties: {} } as const

async function handleJobStatus(_input: Record<string, unknown>, ctx: AgentContext): Promise<ToolOutcome> {
  const jobs = await listBrokerJobs(ctx.brokerSlug)
  if (jobs.length === 0) {
    return { result: { ok: true, jobs: [], message: "You don't have any active jobs right now." } }
  }

  const lines = jobs.map((j, i) => `${i + 1}: ${jobLabel(j)} — ${humanStatus(j)}`)
  return {
    result: {
      ok: true,
      jobs: jobs.map((j, i) => ({
        handle: i + 1,
        action_id: j.id,
        label: jobLabel(j),
        status: j.status,
        status_text: humanStatus(j),
      })),
      message: lines.join('\n'),
    },
  }
}

// ── factory ──────────────────────────────────────────────────────────────────

/**
 * Build the produce-protocol tool set bound to one broker's turn context.
 * Every handler closes over `ctx` — the second parameter of AgentTool.handler
 * is accepted by the interface but not needed here since ctx never changes
 * mid-turn.
 */
export function produceTools(ctx: AgentContext): AgentTool[] {
  return [
    {
      name: 'create_action',
      description:
        'Create a marketing_brain_actions row for a content request (CMA, flyer, IG post/carousel, blog post, ' +
        'listing kit). Guards, in order: refuses retired video/reel formats; refuses another brokerage\'s ' +
        'listing (third-party guard); requires a confirmed signed listing agreement before any pre-market or ' +
        'coming-soon content. Does not run the producer — call run_now after this succeeds.',
      input_schema: CREATE_ACTION_SCHEMA,
      handler: (input) => handleCreateAction(input, ctx),
    },
    {
      name: 'run_now',
      description:
        'Run a pending job immediately (no waiting for the hourly producer-runtime cron). Text producers ' +
        '(CMA, flyer copy, IG caption, blog post) complete in-process and return the draft. Visual renders ' +
        '(CMA PDF, flyer image, carousel) are left for the local render worker with an honest ~15 minute ETA.',
      input_schema: RUN_NOW_SCHEMA,
      handler: (input) => handleRunNow(input, ctx),
    },
    {
      name: 'revise_action',
      description:
        "Log the broker's revision feedback on a job and immediately re-run the producer with it. Works on " +
        'a job by numbered handle (from job_status) or direct job id.',
      input_schema: REVISE_ACTION_SCHEMA,
      handler: (input) => handleReviseAction(input, ctx),
    },
    {
      name: 'approve_action',
      description:
        "Approve a job that is ready for review — stamps approved_by as this broker's email so the publisher-" +
        'sweep can publish it within its next run (~30 min). Only call this when the inbound message is the ' +
        'literal token APPROVE. If more than one job is ready, a handle is required.',
      input_schema: APPROVE_ACTION_SCHEMA,
      handler: (input) => handleApproveAction(input, ctx),
    },
    {
      name: 'hold_action',
      description:
        'Roll an approved-but-not-yet-published job back to ready ("wait, hold that"). Only works before the ' +
        'publisher-sweep has executed it.',
      input_schema: HOLD_ACTION_SCHEMA,
      handler: (input) => handleHoldAction(input, ctx),
    },
    {
      name: 'job_status',
      description:
        "The broker's active jobs as numbered handles with plain-language status (drafting/rendering/ready " +
        'for your review/approved - posting soon/needs changes). No internal jargon.',
      input_schema: JOB_STATUS_SCHEMA,
      handler: (input) => handleJobStatus(input, ctx),
    },
  ]
}