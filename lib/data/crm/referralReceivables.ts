/**
 * Referral queue + receivables DAL (W12 referral-capture tier).
 *
 * Read side for /admin/crm/referrals: the people the buyer-intake classifier
 * (lib/referral-geo.ts) routed OUT of the standard drip — out-of-area /
 * out-of-state referral candidates and fail-closed unclassified property
 * inquiries — plus the referral_receivables money trail.
 *
 * referral_receivables lands via migration 20260722212000_referral_tier.sql.
 * Every touch of that table FEATURE-DETECTS (undefined_table -> available:false)
 * so this surface ships and renders before the migration is applied.
 *
 * DAL boundary (G1): all raw .from() reads/writes live here, inside lib/data/.
 * Service client only — admin surface, behind requireAdminPage + getCrmAccess.
 */

import { createServiceClient } from '@/lib/supabase/service'
import {
  REFERRAL_CANDIDATE_TAG,
  GEO_UNCLASSIFIED_TAG,
  withReferredOutTag,
} from '@/lib/referral-geo'

export type ReferralCandidate = {
  personId: number
  name: string
  stage: string | null
  source: string | null
  assignedBroker: string | null
  tags: string[]
  createdAt: string
  /** 'referral' (out-of-area candidate) or 'unclassified' (needs human geo review). */
  bucket: 'referral' | 'unclassified'
  /** city-interest:<slug> tag payload when present, e.g. 'klamath-falls'. */
  cityInterest: string | null
}

export type ReferralReceivable = {
  id: number
  personId: number
  referredTo: string
  feeBasisPct: number
  status: string
  createdAt: string
}

export type ReferralReceivablesRead = {
  /** False until migration 20260722212000_referral_tier.sql is applied. */
  available: boolean
  rows: ReferralReceivable[]
}

/** Postgres undefined_table — the feature-detect signal pre-migration. */
const UNDEFINED_TABLE = '42P01'

function cityInterestFromTags(tags: string[]): string | null {
  const hit = tags.find((t) => t.toLowerCase().startsWith('city-interest:'))
  return hit ? hit.slice('city-interest:'.length) : null
}

/**
 * People routed to the referral tier, newest first. Referral candidates and
 * unclassified property inquiries come back in one list, bucketed.
 */
export async function listReferralCandidates(limit = 200): Promise<ReferralCandidate[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('id, name, stage, source, assigned_broker, tags, created_at')
    .overlaps('tags', [REFERRAL_CANDIDATE_TAG, GEO_UNCLASSIFIED_TAG])
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500))
  if (error) {
    console.warn('[listReferralCandidates] read failed:', error.message)
    return []
  }
  return (data ?? []).map((row) => {
    const tags = Array.isArray(row.tags) ? (row.tags as string[]) : []
    const lower = tags.map((t) => t.toLowerCase())
    return {
      personId: row.id as number,
      name: (row.name as string | null)?.trim() || `Lead ${row.id}`,
      stage: (row.stage as string | null) ?? null,
      source: (row.source as string | null) ?? null,
      assignedBroker: (row.assigned_broker as string | null) ?? null,
      tags,
      createdAt: row.created_at as string,
      bucket: lower.includes(REFERRAL_CANDIDATE_TAG) ? 'referral' : 'unclassified',
      cityInterest: cityInterestFromTags(tags),
    }
  })
}

/** All receivables, newest first. available:false until the migration lands. */
export async function listReferralReceivables(limit = 200): Promise<ReferralReceivablesRead> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('referral_receivables')
    .select('id, person_id, referred_to, fee_basis_pct, status, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500))
  if (error) {
    if (error.code === UNDEFINED_TABLE) return { available: false, rows: [] }
    console.warn('[listReferralReceivables] read failed:', error.message)
    return { available: true, rows: [] }
  }
  return {
    available: true,
    rows: (data ?? []).map((r) => ({
      id: r.id as number,
      personId: r.person_id as number,
      referredTo: r.referred_to as string,
      feeBasisPct: Number(r.fee_basis_pct),
      status: r.status as string,
      createdAt: r.created_at as string,
    })),
  }
}

export type RecordReferralInput = {
  personId: number
  referredTo: string
  feeBasisPct?: number
}

/**
 * Record a referral handoff (broker disposition from /admin/crm/referrals).
 * Feature-detects the table; also stamps a crm_timeline system entry so the
 * handoff shows on the person's timeline.
 */
export async function recordReferralReceivable(
  input: RecordReferralInput,
): Promise<{ ok: boolean; error?: string; unavailable?: boolean }> {
  if (!Number.isFinite(input.personId) || input.personId <= 0) {
    return { ok: false, error: 'invalid person id' }
  }
  const referredTo = input.referredTo?.trim()
  if (!referredTo) return { ok: false, error: 'referred_to is required' }
  const pct = Number.isFinite(input.feeBasisPct) ? Number(input.feeBasisPct) : 25
  if (pct < 0 || pct > 100) return { ok: false, error: 'fee percent must be 0-100' }

  const sb = createServiceClient()
  const { error } = await sb.from('referral_receivables').insert({
    person_id: input.personId,
    referred_to: referredTo.slice(0, 300),
    fee_basis_pct: pct,
    status: 'pending',
  })
  if (error) {
    if (error.code === UNDEFINED_TABLE) {
      return {
        ok: false,
        unavailable: true,
        error: 'referral_receivables table not applied yet (migration 20260722212000_referral_tier.sql)',
      }
    }
    return { ok: false, error: error.message }
  }

  const { error: tlError } = await sb.from('crm_timeline').insert({
    person_id: input.personId,
    kind: 'system',
    title: `Referred to ${referredTo.slice(0, 160)} (${pct}% referral fee basis)`,
    source: 'referral-queue',
  })
  if (tlError) console.warn('[recordReferralReceivable] timeline insert failed:', tlError.message)

  // Stamp the person-level Referred-Out disposition so the handoff is visible +
  // filterable on the person record / smart lists, not only via the receivables
  // join. Read-modify-write (idempotent via withReferredOutTag). Low-frequency
  // admin action, so the rare concurrent-tag-write race is acceptable.
  const { data: personRow, error: readErr } = await sb
    .from('crm_people')
    .select('tags')
    .eq('id', input.personId)
    .maybeSingle()
  if (!readErr && personRow) {
    const current = Array.isArray(personRow.tags) ? (personRow.tags as string[]) : []
    const next = withReferredOutTag(current)
    if (next.length !== current.length) {
      const { error: tagErr } = await sb.from('crm_people').update({ tags: next }).eq('id', input.personId)
      if (tagErr) console.warn('[recordReferralReceivable] referred-out tag write failed:', tagErr.message)
    }
  }

  return { ok: true }
}
