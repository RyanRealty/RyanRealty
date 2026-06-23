/**
 * resolvePersonIdentity — the keystone identity resolver (CONTACT360 Phase 1.2).
 *
 * Given a crm_people.id, assemble the contact's full identity bundle the
 * enrichment panels all key off:
 *
 *   { crmPersonId, fubLegacyId, emails[], phones[], authUserId, sessionIds[] }
 *
 * The join key is FUB-INDEPENDENT: a NORMALIZED email (lowercased) or phone
 * (last-10 digits). FUB's legacy id is carried through for back-compat reads,
 * but resolution never depends on it — a native lead with no fub_legacy_id
 * resolves the same way as a FUB-imported one.
 *
 * Sources (this is a v1 against the CURRENT schema — no bridge columns yet):
 *   - crm_people.fub_legacy_id            — the legacy FUB key, carried through
 *   - crm_contact_points (kind/value)     — every email/phone for the person
 *   - visitor_identity_map                — rr_vid -> {email, fub_person_id,
 *                                            user_id, session_id}; currently
 *                                            WRITE-ONLY in the codebase, made
 *                                            READ here. Yields sessionIds + the
 *                                            authUserId (user_id uuid).
 *   - visitor_sessions                    — sessions tied to the fub_person_id,
 *                                            unioned with identity-map sessions.
 *
 * authUserId NOTE (FLAGGED): the Supabase JS service client exposes
 * `auth.admin.getUserById(uuid)` and a paginated `auth.admin.listUsers()`, but
 * NO `getUserByEmail`, and PostgREST cannot read the `auth.users` table by
 * email. So there is no clean single-lookup service-role path from an email to
 * an auth uuid. We resolve authUserId deterministically from
 * visitor_identity_map.user_id instead (populated by the identify flow when a
 * signed-in visitor is stitched). If the contact was never stitched to an auth
 * session, authUserId stays null — never a full listUsers scan.
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */
import { createServiceClient } from '@/lib/supabase/service'

export type PersonIdentity = {
  crmPersonId: number
  fubLegacyId: number | null
  emails: string[]
  phones: string[]
  authUserId: string | null
  sessionIds: string[]
}

/** Lowercase + trim an email; returns null when empty. */
export function normalizeEmail(value: string | null | undefined): string | null {
  const v = String(value ?? '').trim().toLowerCase()
  return v || null
}

/** Reduce a phone to its last 10 digits (the FUB-independent join key). */
export function normalizePhone(value: string | null | undefined): string | null {
  const d = String(value ?? '').replace(/\D/g, '')
  if (d.length >= 10) return d.slice(-10)
  return d || null
}

/**
 * Pure helper (unit-tested directly): normalize + dedupe a mixed list of
 * email/phone contact points into a stable, order-preserving deduped pair.
 * First-seen order wins so the primary contact point stays first.
 */
export function dedupeContactPoints(
  points: Array<{ kind: string; value: string | null | undefined }>,
): { emails: string[]; phones: string[] } {
  const emails: string[] = []
  const phones: string[] = []
  const seenEmail = new Set<string>()
  const seenPhone = new Set<string>()
  for (const p of points) {
    const kind = String(p.kind ?? '').toLowerCase()
    if (kind === 'email') {
      const norm = normalizeEmail(p.value)
      if (norm && !seenEmail.has(norm)) {
        seenEmail.add(norm)
        emails.push(norm)
      }
    } else if (kind === 'phone') {
      const norm = normalizePhone(p.value)
      if (norm && !seenPhone.has(norm)) {
        seenPhone.add(norm)
        phones.push(norm)
      }
    }
  }
  return { emails, phones }
}

/** Merge two id lists, dedupe, drop falsy. Order-preserving (a then b). */
function unionIds<T>(a: Iterable<T>, b: Iterable<T>): T[] {
  const seen = new Set<T>()
  const out: T[] = []
  for (const v of a) {
    if (v && !seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  for (const v of b) {
    if (v && !seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  return out
}

/**
 * Resolve a crm_people.id into its full FUB-independent identity bundle.
 * Single source of truth — every Contact-360 enrichment panel calls this
 * instead of threading a bare fub id around.
 */
export async function resolvePersonIdentity(crmPersonId: number): Promise<PersonIdentity> {
  const empty: PersonIdentity = {
    crmPersonId,
    fubLegacyId: null,
    emails: [],
    phones: [],
    authUserId: null,
    sessionIds: [],
  }
  if (!Number.isFinite(crmPersonId) || crmPersonId <= 0) return empty

  const sb = createServiceClient()

  // 1. The person row (fub_legacy_id) + every contact point.
  const [personRes, pointsRes] = await Promise.all([
    sb.from('crm_people').select('id,fub_legacy_id').eq('id', crmPersonId).maybeSingle(),
    sb.from('crm_contact_points').select('kind,value').eq('person_id', crmPersonId),
  ])

  if (personRes.error || !personRes.data) return empty

  const fubLegacyId =
    personRes.data.fub_legacy_id === null || personRes.data.fub_legacy_id === undefined
      ? null
      : Number(personRes.data.fub_legacy_id)

  const { emails, phones } = dedupeContactPoints(
    (pointsRes.data ?? []).map((r) => ({ kind: r.kind as string, value: r.value as string | null })),
  )

  // 2. visitor_identity_map (made READ here) — resolve sessions + auth uuid by
  // the FUB-independent keys we already hold: any normalized email, OR the
  // legacy fub id. This is the richer identity graph the panels want.
  const identityRows: Array<{ user_id: string | null; session_id: string | null }> = []
  const orFilters: string[] = []
  if (emails.length > 0) {
    // PostgREST in.(...) needs the values; emails are already lowercased to match
    // how the identify flow stores visitor_identity_map.email.
    orFilters.push(`email.in.(${emails.map((e) => `"${e}"`).join(',')})`)
  }
  if (fubLegacyId !== null) {
    orFilters.push(`fub_person_id.eq.${fubLegacyId}`)
  }
  if (orFilters.length > 0) {
    const { data: idmap } = await sb
      .from('visitor_identity_map')
      .select('user_id,session_id')
      .or(orFilters.join(','))
      .limit(500)
    for (const r of idmap ?? []) {
      identityRows.push({
        user_id: (r.user_id as string | null) ?? null,
        session_id: (r.session_id as string | null) ?? null,
      })
    }
  }

  // authUserId: the auth.users uuid stitched onto the identity map. First
  // non-null wins (a person maps to at most one auth account). See the FLAG in
  // the file header — there is no clean auth.users-by-email service-role path,
  // so this is the deterministic source.
  const authUserId = identityRows.map((r) => r.user_id).find((u): u is string => !!u) ?? null

  // 3. Sessions: union the identity-map sessions with sessions keyed directly to
  // the fub id on visitor_sessions (the path getViewedListings already uses).
  const idmapSessions = identityRows.map((r) => r.session_id).filter((s): s is string => !!s)
  let directSessions: string[] = []
  if (fubLegacyId !== null) {
    const { data: sessions } = await sb
      .from('visitor_sessions')
      .select('session_id')
      .eq('fub_person_id', fubLegacyId)
      .limit(500)
    directSessions = (sessions ?? []).map((s) => s.session_id as string).filter(Boolean)
  }
  const sessionIds = unionIds(idmapSessions, directSessions)

  return {
    crmPersonId,
    fubLegacyId,
    emails,
    phones,
    authUserId,
    sessionIds,
  }
}
