/**
 * DAL for G2 Imagine drafts on Today.
 *
 * Listing reads reuse the CMA subject lookups (same listings row, live
 * Active + PhotoURL only). Writes go to marketing_brain_actions as
 * pending → ready. approved_at stays null. Media lands in our banners
 * bucket so the draft never points at an xAI temp URL.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import {
  findCmaSubjectByAddress,
  findCmaSubjectByMls,
  type CmaListingRow,
} from '@/lib/data/cma/builderReads'

const BUCKET = 'banners'
const PREFIX = 'imagine-drafts'

export type LiveListingForImagine = {
  listingKey: string
  listNumber: string | null
  address: string
  city: string
  listPrice: number | null
  photoUrl: string
  bedrooms: number | null
  bathrooms: number | null
}

function parseAddressQuery(raw: string): {
  streetNumber: string
  streetNameIlike: string
  cityIlike?: string | null
} | null {
  const m = raw.trim().match(/^(\d+)\s+([^,]+)(?:,\s*([^,]+))?/)
  if (!m) return null
  const streetName = m[2].replace(/\s+(OR|Oregon)\s*$/i, '').trim()
  const city = m[3]?.replace(/\s+(OR|Oregon)\s*$/i, '').trim()
  if (!streetName) return null
  return {
    streetNumber: m[1],
    streetNameIlike: `%${streetName}%`,
    cityIlike: city || null,
  }
}

function asLive(row: CmaListingRow): LiveListingForImagine | null {
  const status = String(row.StandardStatus ?? '')
  const photoUrl = String(row.PhotoURL ?? '').trim()
  if (status !== 'Active') return null
  if (!/^https?:\/\//i.test(photoUrl)) return null
  const listingKey = String(row.ListingKey ?? '').trim()
  if (!listingKey) return null
  const num = String(row.StreetNumber ?? '').trim()
  const name = String(row.StreetName ?? '').trim()
  const priceRaw = row.ListPrice
  const listPrice =
    typeof priceRaw === 'number' && Number.isFinite(priceRaw)
      ? priceRaw
      : priceRaw != null && Number.isFinite(Number(priceRaw))
        ? Number(priceRaw)
        : null
  return {
    listingKey,
    listNumber: row.ListNumber != null ? String(row.ListNumber) : null,
    address: [num, name].filter(Boolean).join(' '),
    city: String(row.City ?? '').trim(),
    listPrice,
    photoUrl,
    bedrooms: row.BedroomsTotal != null ? Number(row.BedroomsTotal) : null,
    bathrooms: row.BathroomsTotal != null ? Number(row.BathroomsTotal) : null,
  }
}

/** Live Active listing with a real MLS photo. Null if the query misses. */
export async function findLiveListingForImagine(
  query: string,
): Promise<LiveListingForImagine | null> {
  const q = query.trim()
  if (!q) return null
  try {
    const mls = q.replace(/^mls:\s*/i, '').trim()
    let rows: CmaListingRow[] = []
    if (mls && !/\s/.test(mls)) {
      rows = await findCmaSubjectByMls(mls)
    }
    if (rows.length === 0) {
      const parsed = parseAddressQuery(q)
      if (parsed) rows = await findCmaSubjectByAddress(parsed)
    }
    for (const row of rows) {
      const live = asLive(row)
      if (live) return live
    }
    return null
  } catch (err) {
    console.error('[findLiveListingForImagine]', err)
    return null
  }
}

export type InsertImagineDraftInput = {
  actionType: string
  target: string
  topic: string
  format: string
  brokerSlug: string
  requestedBy: string
  payload: Record<string, unknown>
}

export async function insertImagineDraftPending(
  input: InsertImagineDraftInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.actionType?.trim() || !input.target?.trim()) {
    return { ok: false, error: 'actionType and target are required' }
  }
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('marketing_brain_actions')
      .insert({
        topic: input.topic || input.target,
        format: input.format,
        platforms: [],
        hook: '',
        body: null,
        cta: null,
        target_audience: 'brand_default',
        data_sources: [],
        predicted_outcome: {},
        status: 'pending',
        generated_by: 'today-imagine-g2',
        generation_reason: input.payload.generation_reason ?? 'Today Imagine produce',
        action_type: input.actionType,
        target: input.target,
        assigned_producer: 'lib/social/imagine-produce',
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

export async function storeImagineMedia(input: {
  actionId: string
  filename: string
  body: Buffer
  contentType: string
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!supabaseUrl?.trim()) return { ok: false, error: 'Supabase URL missing' }
  const actionId = input.actionId.trim()
  const filename = input.filename.replace(/[^a-zA-Z0-9._-]/g, '')
  if (!actionId || !filename) return { ok: false, error: 'actionId and filename are required' }
  try {
    const sb = createServiceClient()
    const storagePath = `${PREFIX}/${actionId}/${filename}`
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

export async function markImagineDraftReady(input: {
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
      ...((existing.payload as Record<string, unknown> | null) ?? {}),
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

export async function killImagineDraft(
  id: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actionId = id.trim()
  if (!actionId) return { ok: false, error: 'id is required' }
  try {
    const sb = createServiceClient()
    const { error } = await sb
      .from('marketing_brain_actions')
      .update({ status: 'killed', killed_reason: reason.slice(0, 500) })
      .eq('id', actionId)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'kill failed' }
  }
}
