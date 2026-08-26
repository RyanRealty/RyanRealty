/**
 * lib/data/studio/drafts.ts — the studio's rows and bytes.
 *
 * Drafts live in marketing_brain_actions, the same chain of custody the
 * approval queue and publisher-sweep already understand. That is deliberate:
 * the studio is a new front end on a spine that already works, not a second
 * pipeline with its own idea of what "approved" means.
 *
 * Lifecycle: pending -> ready -> (Matt) approved -> publisher-sweep ->
 * executed. `killed` at any point. approved_at is only ever stamped by a
 * human action (CLAUDE.md §1).
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { StudioFormatId } from '@/lib/studio/formats'

const BUCKET = 'banners'
const PREFIX = 'studio'
const GENERATOR = 'grok-studio'

export type StudioDraftRow = {
  id: string
  formatId: string
  label: string
  status: string
  caption: string | null
  altText: string | null
  mediaUrl: string | null
  posterUrl: string | null
  mediaKind: 'image' | 'video'
  platforms: string[]
  qaScore: number | null
  qaDefects: string[]
  spendUsd: number | null
  citations: Array<Record<string, unknown>>
  origin: string | null
  createdAt: string
  approvedAt: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function shapeDraft(row: Record<string, unknown>): StudioDraftRow {
  const payload = asRecord(row.payload)
  const executor = asRecord(row.executor_response)
  const media = asRecord(executor.media)
  const qa = asRecord(executor.qa)
  const spend = asRecord(executor.spend)
  const citations = Array.isArray(executor.citations)
    ? (executor.citations as Array<Record<string, unknown>>)
    : []

  return {
    id: String(row.id),
    formatId: String(row.action_type ?? ''),
    label: String(row.target ?? row.topic ?? ''),
    status: String(row.status ?? ''),
    caption: asString(payload.caption),
    altText: asString(payload.alt_text),
    mediaUrl: asString(media.url) ?? asString(payload.media_url),
    posterUrl: asString(media.posterUrl) ?? asString(payload.poster_url),
    mediaKind: media.kind === 'video' ? 'video' : 'image',
    platforms: Array.isArray(payload.platforms) ? (payload.platforms as string[]) : [],
    qaScore: typeof qa.score === 'number' ? qa.score : null,
    qaDefects: Array.isArray(qa.defects) ? (qa.defects as string[]) : [],
    spendUsd: typeof spend.totalUsd === 'number' ? spend.totalUsd : null,
    citations,
    origin: asString(payload.origin),
    createdAt: String(row.created_at ?? ''),
    approvedAt: asString(row.approved_at),
  }
}

/** Open a draft row so media and spend have somewhere to live. */
export async function insertStudioDraft(input: {
  formatId: StudioFormatId
  label: string
  brokerSlug: string
  requestedBy: string
  payload: Record<string, unknown>
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.formatId?.trim() || !input.label?.trim()) {
    return { ok: false, error: 'formatId and label are required' }
  }
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('marketing_brain_actions')
      .insert({
        topic: input.label,
        format: input.formatId,
        platforms: [],
        hook: '',
        body: null,
        cta: null,
        target_audience: 'brand_default',
        data_sources: [],
        predicted_outcome: {},
        status: 'pending',
        generated_by: GENERATOR,
        generation_reason: `Studio ${input.payload.origin === 'slate' ? 'daily slate' : 'produce'}`,
        action_type: input.formatId,
        target: input.label,
        assigned_producer: 'lib/studio/produce',
        assigned_approver: input.brokerSlug || 'matt',
        payload: {
          ...input.payload,
          requested_by_slug: input.brokerSlug,
          requested_by: input.requestedBy,
          humanApprovedAt: null,
        },
        data_evidence: {},
      })
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'insert returned no row' }
    return { ok: true, id: String(data.id) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'insert failed' }
  }
}

/** Store bytes in our own bucket. Generator URLs expire; ours do not. */
export async function storeStudioMedia(input: {
  draftId: string
  filename: string
  body: Buffer
  contentType: string
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!supabaseUrl?.trim()) return { ok: false, error: 'Supabase URL missing' }
  const draftId = input.draftId.trim()
  const filename = input.filename.replace(/[^a-zA-Z0-9._-]/g, '')
  if (!draftId || !filename) return { ok: false, error: 'draftId and filename are required' }
  try {
    const sb = createServiceClient()
    const storagePath = `${PREFIX}/${draftId}/${filename}`
    const { error } = await sb.storage.from(BUCKET).upload(storagePath, input.body, {
      contentType: input.contentType,
      upsert: true,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, url: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'upload failed' }
  }
}

/** pending -> ready. Approval stays null: only a human stamps that. */
export async function markStudioDraftReady(input: {
  id: string
  executorResponse: Record<string, unknown>
  payloadPatch?: Record<string, unknown>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = input.id.trim()
  if (!id) return { ok: false, error: 'id is required' }
  try {
    const sb = createServiceClient()
    const { data: existing, error: fetchErr } = await sb
      .from('marketing_brain_actions')
      .select('payload')
      .eq('id', id)
      .maybeSingle()
    if (fetchErr || !existing) return { ok: false, error: fetchErr?.message ?? 'row not found' }

    const payload = {
      ...asRecord(existing.payload),
      ...(input.payloadPatch ?? {}),
      humanApprovedAt: null,
    }
    const { data, error } = await sb
      .from('marketing_brain_actions')
      .update({
        status: 'ready',
        executor_response: input.executorResponse,
        payload,
        approved_at: null,
        approved_by: null,
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
    if (error) return { ok: false, error: error.message }
    if (!data || data.length === 0) return { ok: false, error: 'Row is not pending' }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'update failed' }
  }
}

export async function killStudioDraft(
  id: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const draftId = id.trim()
  if (!draftId) return { ok: false, error: 'id is required' }
  try {
    const sb = createServiceClient()
    const { error } = await sb
      .from('marketing_brain_actions')
      .update({ status: 'killed', killed_reason: reason.slice(0, 500) })
      .eq('id', draftId)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'kill failed' }
  }
}

/**
 * ready -> approved, with the human stamp publisher-sweep and the publish
 * route both verify. This is the one write in the studio that authorises a
 * post, so it is deliberately the only place approved_by is set.
 */
export async function approveStudioDraft(input: {
  id: string
  approvedBy: string
  platforms?: string[]
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = input.id.trim()
  const approvedBy = input.approvedBy.trim()
  if (!id || !approvedBy) return { ok: false, error: 'id and approvedBy are required' }

  try {
    const sb = createServiceClient()
    const { data: existing, error: fetchErr } = await sb
      .from('marketing_brain_actions')
      .select('payload, executor_response, status')
      .eq('id', id)
      .maybeSingle()
    if (fetchErr || !existing) return { ok: false, error: fetchErr?.message ?? 'row not found' }
    if (existing.status !== 'ready') return { ok: false, error: `Draft is ${existing.status}, not ready` }

    const executor = asRecord(existing.executor_response)
    const citations = Array.isArray(executor.citations) ? executor.citations : []
    if (citations.length === 0) {
      return { ok: false, error: 'Draft carries no citations. No trace, no ship.' }
    }

    const publishPayload = asRecord(executor.publish_payload)
    if (!asString(publishPayload.mediaUrl)) {
      return { ok: false, error: 'Draft has no stored media. Nothing to post.' }
    }
    const nextPublish = input.platforms?.length
      ? { ...publishPayload, platforms: input.platforms }
      : publishPayload

    const approvedAt = new Date().toISOString()
    const { data, error } = await sb
      .from('marketing_brain_actions')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: approvedAt,
        executor_response: { ...executor, publish_payload: nextPublish },
        payload: { ...asRecord(existing.payload), humanApprovedAt: approvedAt },
      })
      .eq('id', id)
      .eq('status', 'ready')
      .select('id')
    if (error) return { ok: false, error: error.message }
    if (!data || data.length === 0) return { ok: false, error: 'Draft is no longer ready' }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'approve failed' }
  }
}

/** Everything the console shows: recent studio rows, newest first. */
export async function listStudioDrafts(options: { limit?: number } = {}): Promise<StudioDraftRow[]> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('marketing_brain_actions')
      .select('id, action_type, target, topic, status, payload, executor_response, created_at, approved_at')
      .eq('generated_by', GENERATOR)
      .order('created_at', { ascending: false })
      .limit(Math.min(60, Math.max(1, options.limit ?? 24)))
    if (error || !data) return []
    return data.map((row) => shapeDraft(row as Record<string, unknown>))
  } catch {
    return []
  }
}

/** How many drafts the slate already made today, so the cron cannot double up. */
export async function countStudioDraftsSince(isoTimestamp: string): Promise<number> {
  try {
    const sb = createServiceClient()
    const { count, error } = await sb
      .from('marketing_brain_actions')
      .select('id', { count: 'exact', head: true })
      .eq('generated_by', GENERATOR)
      .gte('created_at', isoTimestamp)
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}
