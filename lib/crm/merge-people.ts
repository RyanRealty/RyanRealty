/**
 * mergePeopleCore — the ONE contact-merge implementation, shared by the UI merge
 * action (app/actions/crm-person-gaps.ts) and the batch deduper
 * (scripts/_crm-dedupe.ts). Pure: it takes a Supabase client (service-role) so it
 * carries no auth/`server-only` coupling — the CALLER enforces broker scope.
 *
 * (Named merge-people to avoid a clash with lib/crm/merge.ts, which is the
 * unrelated email merge-FIELD/token system.)
 *
 * Design goals (Matt directive 2026-07-05 — "lose nothing" + "record multi-property
 * in an expert way"):
 *   1. LOSE NOTHING. Every table keyed by crm_people.id is repointed from the
 *      duplicate onto the survivor (notes, calls, texts, tasks, files, deals,
 *      appointments, suppressions, drafts, subscriptions, email events, audience
 *      queue, CMA deliveries, visitor identity/sessions, saved searches, newsletter,
 *      relationships, collaborators, sequence enrollments). The survivor also
 *      UNIONS the duplicate's own fields it would otherwise drop: emails, phones,
 *      tags, custom, neighborhood, and the earliest/most-recent timestamps.
 *   2. MULTI-PROPERTY. westside_parcels.person_id is the property ledger: one
 *      contact -> many owned parcels. The merge repoints it, so consolidating a
 *      duplicated owner leaves ONE contact linked to ALL their parcels, and stamps
 *      custom.properties_owned with the resulting count for display.
 *   3. AUDITABLE + REVERSIBLE-ish. The duplicate is SOFT-deleted (stage=Trash,
 *      deleted=true) with custom.merged_into set, and a permanent system timeline
 *      row is written on the survivor. Nothing is hard-deleted.
 *
 * Unique-constraint handling (verified against migrations):
 *   - crm_contact_points  unique(person_id,kind,value)  -> upsert to survivor, drop dup's
 *   - crm_conversation_state / crm_report_subscriptions  unique(person_id) -> keep survivor's
 *   - crm_relationships   no-self-link CHECK             -> repoint both cols, drop self-links
 *   - crm_people_collaborators PK(person_id,broker_slug) -> upsert to survivor
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type MergeActor = { email: string; brokerSlug: string | null }

export type MergeResult = {
  survivorId: number
  mergedId: number
  repointed: Record<string, number>
  propertiesOwned: number
  incidents: string[]
}

type ContactPoint = { value?: string; label?: string; type?: string; status?: string }

const normEmail = (v: string) => v.trim().toLowerCase()
const normPhone = (v: string) => v.replace(/[^0-9]/g, '').replace(/^1(?=\d{10}$)/, '')

/** Union two jsonb contact arrays, deduped by normalized value; survivor first. */
function unionContacts(
  survivor: ContactPoint[] | null | undefined,
  merged: ContactPoint[] | null | undefined,
  kind: 'email' | 'phone',
): ContactPoint[] {
  const norm = kind === 'email' ? normEmail : normPhone
  const out: ContactPoint[] = []
  const seen = new Set<string>()
  for (const list of [survivor ?? [], merged ?? []]) {
    for (const cp of list) {
      const raw = (cp?.value ?? '').toString()
      if (!raw.trim()) continue
      const key = norm(raw)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(cp)
    }
  }
  return out
}

function unionTags(a: string[] | null | undefined, b: string[] | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of [...(a ?? []), ...(b ?? [])]) {
    const v = (t ?? '').toString().trim()
    if (!v || seen.has(v.toLowerCase())) continue
    seen.add(v.toLowerCase())
    out.push(v)
  }
  return out
}

const olderIso = (a: string | null, b: string | null): string | null =>
  a && b ? (a < b ? a : b) : (a ?? b)
const newerIso = (a: string | null, b: string | null): string | null =>
  a && b ? (a > b ? a : b) : (a ?? b)

// Simple person_id-keyed tables: a plain repoint moves every row.
const PLAIN_PERSON_TABLES = [
  'crm_tasks',
  'crm_suppressions',
  'crm_appointments',
  'crm_deals',
  'crm_message_drafts',
  'crm_person_files',
  'meta_audience_removal_queue',
  'cma_deliveries',
  'email_events',
]
// crm_person_id-keyed denormalized caches. listing_alerts is the unified
// alert table (2026-07-07); saved_searches stays listed so LEGACY rows keep
// repointing until the parent drops the table.
const PLAIN_CRMPERSON_TABLES = ['newsletter_subscribers', 'saved_searches', 'listing_alerts', 'visitor_identity_map', 'visitor_sessions']

/* eslint-disable @typescript-eslint/no-explicit-any */
// Count rows on any table WITHOUT assuming an `id` column — westside_parcels is
// keyed by `apn`, so select('id') there silently returns 0 (a real bug we hit
// 2026-07-05). `select('*', head)` counts rows on any PK.
async function countRows(sb: SupabaseClient, table: string, col: string, id: number): Promise<number> {
  const { count } = await sb.from(table).select('*', { count: 'exact', head: true }).eq(col, id)
  return count ?? 0
}

async function repointPlain(
  sb: SupabaseClient,
  table: string,
  col: string,
  survivorId: number,
  mergedId: number,
  repointed: Record<string, number>,
  incidents: string[],
): Promise<void> {
  try {
    const n = await countRows(sb, table, col, mergedId)
    if (n === 0) return
    const { error } = await sb.from(table).update({ [col]: survivorId }).eq(col, mergedId)
    if (error) throw error
    repointed[table] = (repointed[table] ?? 0) + n
  } catch (e) {
    incidents.push(`${table}.${col}: ${(e as Error).message}`)
  }
}

/**
 * Merge `mergedId` INTO `survivorId`. Both must already be validated (exist, not
 * deleted, same scope) by the caller. Idempotent-ish: safe to re-run if a prior
 * run half-completed (repoints of an already-empty duplicate are no-ops).
 */
export async function mergePeopleCore(
  sb: SupabaseClient,
  params: { survivorId: number; mergedId: number; mergedName: string; actor: MergeActor },
): Promise<MergeResult> {
  const { survivorId, mergedId, mergedName, actor } = params
  const repointed: Record<string, number> = {}
  const incidents: string[] = []
  if (survivorId === mergedId) throw new Error('cannot merge a contact into itself')

  const SEL =
    'id,emails,phones,tags,custom,source,stage,assigned_broker,neighborhood_slug,subdivision,is_resort,neighborhood_source,last_activity_at,fub_created_at'
  const [{ data: survivor }, { data: merged }] = await Promise.all([
    sb.from('crm_people').select(SEL).eq('id', survivorId).maybeSingle(),
    sb.from('crm_people').select(SEL).eq('id', mergedId).maybeSingle(),
  ])
  if (!survivor) throw new Error(`survivor ${survivorId} not found`)
  if (!merged) throw new Error(`merged ${mergedId} not found`)
  const s = survivor as any
  const m = merged as any

  // 1) UNION the duplicate's own fields onto the survivor (what the old merge dropped).
  const mergedCustom = { ...(m.custom ?? {}), ...(s.custom ?? {}) } // survivor wins on conflict
  await sb
    .from('crm_people')
    .update({
      emails: unionContacts(s.emails, m.emails, 'email'),
      phones: unionContacts(s.phones, m.phones, 'phone'),
      tags: unionTags(s.tags, m.tags),
      custom: mergedCustom,
      neighborhood_slug: s.neighborhood_slug ?? m.neighborhood_slug,
      subdivision: s.subdivision ?? m.subdivision,
      is_resort: s.is_resort ?? m.is_resort,
      neighborhood_source: s.neighborhood_source ?? m.neighborhood_source,
      last_activity_at: newerIso(s.last_activity_at ?? null, m.last_activity_at ?? null),
      fub_created_at: olderIso(s.fub_created_at ?? null, m.fub_created_at ?? null),
      updated_at: new Date().toISOString(),
    })
    .eq('id', survivorId)

  // 2) crm_timeline — the notes / calls / texts / emails. NEVER lose these.
  {
    const n = await countRows(sb, 'crm_timeline', 'person_id', mergedId)
    if (n > 0) {
      const { error } = await sb.from('crm_timeline').update({ person_id: survivorId }).eq('person_id', mergedId)
      if (error) incidents.push(`crm_timeline: ${error.message}`)
      else repointed['crm_timeline'] = n
    }
  }

  // 3) Plain person_id tables.
  for (const t of PLAIN_PERSON_TABLES) await repointPlain(sb, t, 'person_id', survivorId, mergedId, repointed, incidents)
  // 3b) Denormalized crm_person_id caches.
  for (const t of PLAIN_CRMPERSON_TABLES) await repointPlain(sb, t, 'crm_person_id', survivorId, mergedId, repointed, incidents)
  // 3c) profiles.crm_person_id is 1:1 with an auth user — guard against a unique clash.
  try {
    const n = await countRows(sb, 'profiles', 'crm_person_id', mergedId)
    if (n > 0) {
      const { count: survHas } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('crm_person_id', survivorId)
      if ((survHas ?? 0) > 0) incidents.push(`profiles: survivor already linked, left ${n} on duplicate`)
      else {
        const { error } = await sb.from('profiles').update({ crm_person_id: survivorId }).eq('crm_person_id', mergedId)
        if (error) throw error
        repointed['profiles'] = n
      }
    }
  } catch (e) {
    incidents.push(`profiles: ${(e as Error).message}`)
  }

  // 4) westside_parcels — the multi-property ledger. Plain repoint accumulates.
  await repointPlain(sb, 'westside_parcels', 'person_id', survivorId, mergedId, repointed, incidents)

  // 5) crm_contact_points — unique(person_id,kind,value): upsert to survivor, drop dup's.
  try {
    const { data: cps } = await sb.from('crm_contact_points').select('kind,value,label,is_primary').eq('person_id', mergedId)
    if (cps && cps.length > 0) {
      for (const cp of cps as any[]) {
        await sb
          .from('crm_contact_points')
          .upsert({ person_id: survivorId, kind: cp.kind, value: cp.value, label: cp.label ?? null, is_primary: false }, { onConflict: 'person_id,kind,value', ignoreDuplicates: true })
      }
      await sb.from('crm_contact_points').delete().eq('person_id', mergedId)
      repointed['crm_contact_points'] = cps.length
    }
  } catch (e) {
    incidents.push(`crm_contact_points: ${(e as Error).message}`)
  }

  // 6) Unique-per-person tables — keep survivor's, drop the duplicate's.
  for (const t of ['crm_conversation_state', 'crm_report_subscriptions']) {
    try {
      const n = await countRows(sb, t, 'person_id', mergedId)
      if (n === 0) continue
      const { count: survHas } = await sb.from(t).select('id', { count: 'exact', head: true }).eq('person_id', survivorId)
      if ((survHas ?? 0) > 0) {
        await sb.from(t).delete().eq('person_id', mergedId)
      } else {
        const { error } = await sb.from(t).update({ person_id: survivorId }).eq('person_id', mergedId)
        if (error) throw error
      }
      repointed[t] = n
    } catch (e) {
      incidents.push(`${t}: ${(e as Error).message}`)
    }
  }

  // 7) crm_sequence_enrollments — repoint live ones, stop if survivor already enrolled.
  try {
    const LIVE = ['running', 'paused', 'paused_reply', 'awaiting_broker', 'awaiting_broker_next']
    const [{ data: mE }, { data: sE }] = await Promise.all([
      sb.from('crm_sequence_enrollments').select('id,sequence_id').eq('person_id', mergedId).in('status', LIVE),
      sb.from('crm_sequence_enrollments').select('sequence_id').eq('person_id', survivorId).in('status', LIVE),
    ])
    if (mE && mE.length > 0) {
      const have = new Set((sE ?? []).map((e: any) => Number(e.sequence_id)))
      const repoint = mE.filter((e: any) => !have.has(Number(e.sequence_id))).map((e: any) => Number(e.id))
      const stop = mE.filter((e: any) => have.has(Number(e.sequence_id))).map((e: any) => Number(e.id))
      if (repoint.length) await sb.from('crm_sequence_enrollments').update({ person_id: survivorId }).in('id', repoint)
      if (stop.length) await sb.from('crm_sequence_enrollments').update({ status: 'stopped' }).in('id', stop)
      // Anything not live (completed/stopped) still repoints so history is kept.
      await sb.from('crm_sequence_enrollments').update({ person_id: survivorId }).eq('person_id', mergedId)
      repointed['crm_sequence_enrollments'] = mE.length
    } else {
      await sb.from('crm_sequence_enrollments').update({ person_id: survivorId }).eq('person_id', mergedId)
    }
  } catch (e) {
    incidents.push(`crm_sequence_enrollments: ${(e as Error).message}`)
  }

  // 8) crm_relationships — repoint both directions, then drop any self-link.
  try {
    await sb.from('crm_relationships').update({ person_id: survivorId }).eq('person_id', mergedId)
    await sb.from('crm_relationships').update({ related_person_id: survivorId }).eq('related_person_id', mergedId)
    await sb.from('crm_relationships').delete().eq('person_id', survivorId).eq('related_person_id', survivorId)
  } catch (e) {
    incidents.push(`crm_relationships: ${(e as Error).message}`)
  }

  // 9) crm_people_collaborators — PK(person_id,broker_slug): upsert to survivor.
  try {
    const { data: collabs } = await sb.from('crm_people_collaborators').select('broker_slug,added_by').eq('person_id', mergedId)
    for (const c of collabs ?? []) {
      await sb.from('crm_people_collaborators').upsert(
        { person_id: survivorId, broker_slug: (c as any).broker_slug, added_by: (c as any).added_by ?? 'merge' },
        { onConflict: 'person_id,broker_slug' },
      )
    }
    await sb.from('crm_people_collaborators').delete().eq('person_id', mergedId)
  } catch (e) {
    incidents.push(`crm_people_collaborators: ${(e as Error).message}`)
  }

  // 10) Recompute the survivor's owned-property count for display convenience.
  const propertiesOwned = await countRows(sb, 'westside_parcels', 'person_id', survivorId)
  if (propertiesOwned > 1) {
    await sb
      .from('crm_people')
      .update({ custom: { ...mergedCustom, properties_owned: propertiesOwned } })
      .eq('id', survivorId)
  }

  // 11) Soft-delete the duplicate, stamped with where it went.
  await sb
    .from('crm_people')
    .update({
      stage: 'Trash',
      deleted: true,
      custom: { ...(m.custom ?? {}), merged_into: survivorId, merged_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq('id', mergedId)

  // 12) Permanent audit row on the survivor.
  const propNote = propertiesOwned > 1 ? ` Survivor now linked to ${propertiesOwned} properties.` : ''
  await sb.from('crm_timeline').insert({
    person_id: survivorId,
    kind: 'system',
    title: `Merged with "${mergedName}" (ID ${mergedId}) by ${actor.email}. Duplicate archived to Trash.${propNote} Unmerge not supported.`,
    source: 'app',
    broker: actor.brokerSlug ?? null,
  })

  return { survivorId, mergedId, repointed, propertiesOwned, incidents }
}
