/**
 * CRM mirror layer — dual-write glue for the parallel-run period
 * (docs/CRM_REPLACEMENT_BLUEPRINT.md §7).
 *
 * Every FUB mutation made by our code calls one of these mirrors afterward so
 * the crm_* tables stay current in real time. The 30-min delta cron
 * (/api/cron/crm-fub-delta) is the catch-all for anything mirrored late or
 * mutated directly in the FUB UI.
 *
 * Design rules:
 *  - NEVER throws. A mirror failure must not break a lead-capture path.
 *  - Fire-and-forget callers use `void mirrorX(...)`.
 *  - Kill switch: CRM_MIRROR_ENABLED=false disables all writes.
 *  - Reads FUB directly (GET only) to re-fetch canonical person state after a
 *    mutation, rather than re-implementing FUB's merge semantics.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { getFubApiKey } from './fub-env'
import { mirrorHealthStatus } from './mirror-health'

const FUB_BASE = 'https://api.followupboss.com/v1'

const BROKER_BY_FUB_USER: Record<number, string> = { 1: 'matt', 2: 'rebecca', 3: 'paul' }

// Once-per-process guard so the kill-switch alarm is loud but not spammy: every
// mirror entrypoint funnels through mirrorEnabled(), so without this the warn
// would fire on every single mirror call.
let killSwitchWarned = false

function mirrorEnabled(): boolean {
  const health = mirrorHealthStatus({ CRM_MIRROR_ENABLED: process.env.CRM_MIRROR_ENABLED })
  // The kill switch (CRM_MIRROR_ENABLED=false) silently stops every crm_* write.
  // Surface it ONCE, loudly + structured — a missing FUB key is a separate
  // config concern (level stays 'ok') and is intentionally not alarmed here.
  if (health.level === 'alarm' && !killSwitchWarned) {
    killSwitchWarned = true
    console.warn(health.message)
  }
  return health.enabled && !!getFubApiKey()
}

function fubGetHeaders(): HeadersInit | null {
  const key = getFubApiKey()?.trim()
  if (!key) return null
  return {
    Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
    'X-System': 'RyanRealtyPlatform',
    Accept: 'application/json',
  }
}

export function normalizeCrmPhone(v: string | null | undefined): string | null {
  const d = String(v ?? '').replace(/\D/g, '')
  if (d.length >= 10) return d.slice(-10)
  return d || null
}

type FubPersonRecord = Record<string, unknown> & {
  id: number
  created?: string
  updated?: string
  name?: string
  firstName?: string
  lastName?: string
  stage?: string
  source?: string
  sourceUrl?: string
  assignedUserId?: number
  emails?: Array<{ value?: string; type?: string; isPrimary?: number | boolean }>
  phones?: Array<{ value?: string; type?: string; isPrimary?: number | boolean }>
  addresses?: unknown[]
  tags?: string[]
  background?: string
  price?: number
  picture?: { small?: string }
  lastActivity?: string
}

export function mapFubPersonToCrm(p: FubPersonRecord) {
  const custom: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(p)) {
    if (k.startsWith('custom') && v !== null && v !== '' && v !== undefined) custom[k] = v
  }
  return {
    fub_legacy_id: p.id,
    fub_created_at: p.created ?? null,
    fub_updated_at: p.updated ?? null,
    first_name: p.firstName ?? null,
    last_name: p.lastName ?? null,
    name: p.name || [p.firstName, p.lastName].filter(Boolean).join(' ') || null,
    stage: p.stage || 'Lead',
    source: p.source ?? null,
    source_url: p.sourceUrl ?? null,
    assigned_broker: p.assignedUserId ? BROKER_BY_FUB_USER[p.assignedUserId] ?? null : null,
    assigned_fub_user_id: p.assignedUserId ?? null,
    emails: p.emails ?? [],
    phones: p.phones ?? [],
    addresses: p.addresses ?? [],
    tags: Array.isArray(p.tags) ? p.tags : [],
    custom,
    background: p.background ?? null,
    price: typeof p.price === 'number' ? p.price : null,
    // Only set when FUB actually has a photo — a null here would clobber the
    // OAuth profile photo saved by saveOauthAvatarByEmail on every delta sync.
    ...(p.picture?.small ? { picture_url: p.picture.small } : {}),
    last_activity_at: p.lastActivity ?? null,
    raw: p as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  }
}

/** Upsert one FUB person snapshot into crm_people + rebuild its contact points. Returns crm person id. */
export async function upsertCrmMirrorPerson(p: FubPersonRecord): Promise<number | null> {
  try {
    const sb = createServiceClient()
    const row = mapFubPersonToCrm(p)
    const { data, error } = await sb
      .from('crm_people')
      .upsert(row, { onConflict: 'fub_legacy_id' })
      .select('id')
      .single()
    if (error || !data) {
      console.warn('[crm-mirror] person upsert failed:', error?.message)
      return null
    }
    const points: Array<{ person_id: number; kind: string; value: string; label: string | null; is_primary: boolean }> = []
    for (const e of p.emails ?? []) {
      const v = String(e.value ?? '').trim().toLowerCase()
      if (v) points.push({ person_id: data.id, kind: 'email', value: v, label: e.type ?? null, is_primary: !!e.isPrimary })
    }
    for (const ph of p.phones ?? []) {
      const v = normalizeCrmPhone(ph.value)
      if (v) points.push({ person_id: data.id, kind: 'phone', value: v, label: ph.type ?? null, is_primary: !!ph.isPrimary })
    }
    await sb.from('crm_contact_points').delete().eq('person_id', data.id)
    if (points.length) await sb.from('crm_contact_points').insert(points)
    return data.id
  } catch (err) {
    console.warn('[crm-mirror] upsertCrmMirrorPerson error:', err)
    return null
  }
}

/** Re-fetch a FUB person (allFields) and mirror it. Safe fire-and-forget. */
export async function mirrorPersonFromFub(fubPersonId: number): Promise<void> {
  if (!mirrorEnabled()) return
  if (!Number.isFinite(fubPersonId) || fubPersonId <= 0) return
  try {
    const headers = fubGetHeaders()
    if (!headers) return
    const res = await fetch(`${FUB_BASE}/people/${fubPersonId}?fields=allFields`, { headers, next: { revalidate: 0 } })
    if (!res.ok) return
    const person = (await res.json()) as FubPersonRecord
    if (!person?.id) return
    await upsertCrmMirrorPerson(person)
  } catch (err) {
    console.warn('[crm-mirror] mirrorPersonFromFub error:', err)
  }
}

/** Resolve a FUB person by email, then mirror. Used after sendEvent (which returns no id). */
/**
 * Save the OAuth profile photo (Google/Facebook sign-in) onto the CRM person.
 * The real face beats whatever FUB has — set unconditionally; the FUB mirror
 * only writes picture_url when FUB itself has a photo.
 */
export async function saveOauthAvatarByEmail(email: string | null | undefined, avatarUrl: string | null | undefined): Promise<void> {
  const cleanedEmail = String(email ?? '').trim().toLowerCase()
  const url = String(avatarUrl ?? '').trim()
  if (!cleanedEmail || !/^https:\/\//.test(url)) return
  try {
    const sb = createServiceClient()
    const { data: pt } = await sb
      .from('crm_contact_points')
      .select('person_id')
      .eq('kind', 'email')
      .eq('value', cleanedEmail)
      .limit(1)
      .maybeSingle()
    if (!pt?.person_id) return
    await sb.from('crm_people').update({ picture_url: url.slice(0, 1024), updated_at: new Date().toISOString() }).eq('id', pt.person_id)
  } catch (err) {
    console.warn('[crm-mirror] saveOauthAvatarByEmail error:', err)
  }
}

export async function mirrorPersonByEmail(email: string | null | undefined): Promise<void> {
  if (!mirrorEnabled()) return
  const cleaned = String(email ?? '').trim().toLowerCase()
  if (!cleaned) return
  try {
    const headers = fubGetHeaders()
    if (!headers) return
    const res = await fetch(`${FUB_BASE}/people?email=${encodeURIComponent(cleaned)}&fields=allFields&limit=1`, {
      headers,
      next: { revalidate: 0 },
    })
    if (!res.ok) return
    const data = (await res.json()) as { people?: FubPersonRecord[] }
    const person = data.people?.[0]
    if (person?.id) await upsertCrmMirrorPerson(person)
  } catch (err) {
    console.warn('[crm-mirror] mirrorPersonByEmail error:', err)
  }
}

/**
 * Site behavioral event → CRM timeline, in real time (Matt directive
 * 2026-06-10: track leads at every site touchpoint). One chokepoint: every
 * sendEvent success calls this, so listing views, searches, saves, inquiries,
 * and return visits land on the contact's CRM timeline the moment they happen
 * — and the person mirror refreshes for lastActivity/tags.
 */
export async function mirrorSiteEvent(params: {
  email: string | null | undefined
  type: string
  source?: string
  pageUrl?: string
  pageTitle?: string
  message?: string
  propertyStreet?: string
}): Promise<void> {
  if (!mirrorEnabled()) return
  const email = String(params.email ?? '').trim().toLowerCase()
  if (!email) return
  try {
    const sb = createServiceClient()
    const { data: pt } = await sb
      .from('crm_contact_points')
      .select('person_id')
      .eq('kind', 'email')
      .eq('value', email)
      .limit(1)
      .maybeSingle()
    if (pt?.person_id) {
      await sb.from('crm_timeline').insert({
        person_id: pt.person_id,
        kind: 'web_event',
        title: [params.type, params.propertyStreet ?? params.pageTitle].filter(Boolean).join(' · ').slice(0, 180),
        body: params.message ?? params.pageUrl ?? null,
        payload: {
          type: params.type,
          source: params.source ?? null,
          pageUrl: params.pageUrl ?? null,
          property: params.propertyStreet ?? null,
        },
        source: 'site',
      })
    }
  } catch (err) {
    console.warn('[crm-mirror] mirrorSiteEvent error:', err)
  }
  // refresh the person mirror too (lastActivity, tag drift)
  await mirrorPersonByEmail(email)
}

async function crmIdForFub(fubPersonId: number): Promise<number | null> {
  try {
    const sb = createServiceClient()
    const { data } = await sb.from('crm_people').select('id').eq('fub_legacy_id', fubPersonId).maybeSingle()
    return data?.id ?? null
  } catch {
    return null
  }
}

/** Mirror a note we just posted to FUB into the CRM timeline. */
export async function mirrorNoteToCrm(
  fubPersonId: number,
  body: string,
  opts: { fubNoteId?: number; broker?: string } = {},
): Promise<void> {
  if (!mirrorEnabled()) return
  try {
    let personId = await crmIdForFub(fubPersonId)
    if (!personId) {
      await mirrorPersonFromFub(fubPersonId)
      personId = await crmIdForFub(fubPersonId)
    }
    if (!personId) return
    const sb = createServiceClient()
    await sb.from('crm_timeline').upsert(
      {
        person_id: personId,
        ts: new Date().toISOString(),
        kind: 'note',
        body,
        payload: {},
        broker: opts.broker ?? null,
        source: 'dual-write',
        fub_legacy_id: opts.fubNoteId ?? null,
        dedupe_key: opts.fubNoteId ? `fub:note:${opts.fubNoteId}` : null,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
  } catch (err) {
    console.warn('[crm-mirror] mirrorNoteToCrm error:', err)
  }
}

/** Mirror a task we just created in FUB. */
export async function mirrorTaskToCrm(
  fubPersonId: number,
  task: { name: string; type?: string; dueAt?: string | null; fubTaskId?: number },
): Promise<void> {
  if (!mirrorEnabled()) return
  try {
    const personId = await crmIdForFub(fubPersonId)
    if (!personId) return
    const sb = createServiceClient()
    await sb.from('crm_tasks').upsert(
      {
        person_id: personId,
        name: task.name,
        type: task.type ?? null,
        due_at: task.dueAt ?? null,
        origin: 'dual-write',
        fub_legacy_id: task.fubTaskId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fub_legacy_id' },
    )
  } catch (err) {
    console.warn('[crm-mirror] mirrorTaskToCrm error:', err)
  }
}

/** Mirror an action-plan enrollment into crm_sequence_enrollments (record-keeping only; engine is separate). */
export async function mirrorEnrollmentToCrm(fubPersonId: number, fubActionPlanId: number): Promise<void> {
  if (!mirrorEnabled()) return
  try {
    const sb = createServiceClient()
    const [personId, seq] = await Promise.all([
      crmIdForFub(fubPersonId),
      sb.from('crm_sequences').select('id').eq('fub_legacy_plan_id', fubActionPlanId).maybeSingle(),
    ])
    if (!personId || !seq.data?.id) return
    // The active-enrollment unique index is partial, which ON CONFLICT cannot
    // target through PostgREST — check-then-insert instead.
    const existing = await sb
      .from('crm_sequence_enrollments')
      .select('id')
      .eq('person_id', personId)
      .eq('sequence_id', seq.data.id)
      .in('status', ['running', 'paused_reply'])
      .maybeSingle()
    if (existing.data?.id) return
    await sb.from('crm_sequence_enrollments').insert({
      person_id: personId,
      sequence_id: seq.data.id,
      status: 'running',
      enrolled_by: 'fub-dual-write',
    })
  } catch (err) {
    console.warn('[crm-mirror] mirrorEnrollmentToCrm error:', err)
  }
}
