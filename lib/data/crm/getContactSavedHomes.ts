/**
 * getContactSavedHomes — the homes a CRM contact has liked or saved on the
 * consumer site, resolved through the person → auth-user identity chain and
 * joined to LIVE listing tiles (§0: prices/statuses shown to a broker must be
 * current, so tiles come from listing_tile_mv, not a snapshot).
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * public.likes and public.saved_listings key on the Supabase auth user_id
 * (uuid) — see app/actions/likes.ts:35-38 and app/actions/saved-listings.ts:45-48.
 * The CRM keys on crm_people.id (bigint). Without this join, "they liked this
 * home" was invisible to brokers.
 *
 * ── IDENTITY CHAIN (person → auth user_id) ──────────────────────────────────
 *   1. visitor_identity_map.user_id where the map row matches the person by
 *      crm_person_id, fub_person_id (lockstep native id per
 *      lib/visitor-backfill.ts:97-99), or normalized email. Writer:
 *      stitchVisitorIdentity (lib/visitor-backfill.ts:56-112), called with the
 *      auth userId from app/auth/callback/route.ts:55 on every OAuth /
 *      magic-link sign-in.
 *   2. profiles.user_id where profiles.crm_person_id = personId — the 1:1
 *      bridge merge-people maintains (lib/crm/merge-people.ts:194-201).
 *
 * A "hidden homes" store does not exist in the schema
 * (docs/DATABASE_SCHEMA_SNAPSHOT.md has no hidden_listings table) — when one
 * lands, add it as a third source here.
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */
import { cache as reactCache } from 'react'
import { createServiceClient } from '@/lib/data/client'
import type { ViewedListing } from '@/lib/data/crm/getViewedListings'

export type SavedHomeSource = 'liked' | 'saved'

export type ContactSavedHome = {
  listingKey: string
  address: string
  city: string | null
  status: string | null
  photoUrl: string | null
  listPrice: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  addressSlug: string | null
  /** Which consumer stores hold this home (badge per source). */
  sources: SavedHomeSource[]
  /** Most recent created_at across the matching store rows. */
  savedAt: string
}

/** Minimal row shape shared by likes and saved_listings. */
export type ConsumerStoreRow = { listing_key: string; created_at: string }

/**
 * Pure helper (unit-tested): roll the two consumer stores up per listing key.
 * Source order is stable (liked before saved); savedAt is the most recent
 * created_at across both stores. Rows with empty keys are skipped.
 */
export function rollupSavedHomeRows(
  likeRows: ReadonlyArray<ConsumerStoreRow>,
  savedRows: ReadonlyArray<ConsumerStoreRow>,
): Map<string, { sources: SavedHomeSource[]; savedAt: string }> {
  const out = new Map<string, { sources: SavedHomeSource[]; savedAt: string }>()
  const ingest = (rows: ReadonlyArray<ConsumerStoreRow>, source: SavedHomeSource) => {
    for (const row of rows ?? []) {
      const key = String(row?.listing_key ?? '').trim()
      if (!key) continue
      const at = String(row?.created_at ?? '')
      const existing = out.get(key)
      if (!existing) {
        out.set(key, { sources: [source], savedAt: at })
        continue
      }
      if (!existing.sources.includes(source)) existing.sources.push(source)
      if (at > existing.savedAt) existing.savedAt = at
    }
  }
  ingest(likeRows, 'liked')
  ingest(savedRows, 'saved')
  return out
}

/**
 * Pure helper (unit-tested): union the event-derived viewed homes with the
 * real consumer-store saves for the person page's homes panel.
 *
 *   - A home in BOTH lists keeps its view count and gains consumerSources;
 *     its `saved` flag flips true when a real store holds it (real store
 *     beats the event heuristic — matches the /account/saved-homes union
 *     semantics where a like IS a saved home, app/actions/saved-listings.ts:108).
 *   - A liked/saved-but-never-viewed home still appears (views 0, saved true).
 *   - Sorted most-recent activity first (lastViewedAt vs savedAt), capped.
 */
export function buildHomesPanelUnion(
  viewed: ReadonlyArray<ViewedListing>,
  saved: ReadonlyArray<ContactSavedHome>,
  cap = 12,
): ViewedListing[] {
  const byKey = new Map<string, ViewedListing>()
  for (const v of viewed ?? []) {
    byKey.set(v.listingKey, { ...v })
  }
  for (const s of saved ?? []) {
    const existing = byKey.get(s.listingKey)
    if (existing) {
      existing.saved = true
      existing.consumerSources = s.sources
      if (s.savedAt > existing.lastViewedAt) existing.lastViewedAt = s.savedAt
      continue
    }
    byKey.set(s.listingKey, {
      listingKey: s.listingKey,
      address: s.address,
      city: s.city,
      status: s.status,
      photoUrl: s.photoUrl,
      listPrice: s.listPrice,
      beds: s.beds,
      baths: s.baths,
      sqft: s.sqft,
      addressSlug: s.addressSlug,
      views: 0,
      saved: true,
      lastViewedAt: s.savedAt,
      consumerSources: s.sources,
    })
  }
  const out = [...byKey.values()]
  out.sort((a, b) => (a.lastViewedAt < b.lastViewedAt ? 1 : -1))
  return out.slice(0, Math.max(0, cap))
}

/**
 * person → auth-user or-filter for the visitor_identity_map lookup: matches on
 * crm_person_id, fub_person_id (both the crm id AND the legacy fub id, since a
 * CRM-imported person can be keyed either way — this is exactly the leg a native
 * lead's saved homes were silently missing), and, when known, the person's
 * normalized emails. PURE, and pinned by the identity-join contract test — the
 * saved-homes counterpart to buildSessionOrFilter for the viewed-listings chain.
 */
export function buildSavedHomesIdentityOrFilter(
  crmPersonId: number,
  fubLegacyId?: number | null,
  emails?: string[],
): string {
  const parts = [`crm_person_id.eq.${crmPersonId}`, `fub_person_id.eq.${crmPersonId}`]
  if (fubLegacyId != null && fubLegacyId !== crmPersonId) parts.push(`fub_person_id.eq.${fubLegacyId}`)
  const cleanEmails = (emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (cleanEmails.length > 0) parts.push(`email.in.(${cleanEmails.map((e) => `"${e}"`).join(',')})`)
  return parts.join(',')
}

/**
 * Resolve every auth user_id linked to a CRM person (see identity chain in the
 * file header), then read their likes + saved_listings joined to live tiles.
 * Empty/safe [] on any miss — a contact with no auth account has no consumer
 * stores, which is a normal state, never an error.
 */
export async function getContactSavedHomes(params: {
  crmPersonId: number
  fubLegacyId?: number | null
  /** Normalized (lowercased) emails — strengthens the identity-map match. */
  emails?: string[]
}): Promise<ContactSavedHome[]> {
  return getContactSavedHomesCached(
    params.crmPersonId,
    params.fubLegacyId ?? null,
    (params.emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean).sort().join(' '),
  )
}

/** Request-memoized (React cache): desktop and mobile regions both read this store. */
const getContactSavedHomesCached = reactCache(async (
  crmPersonId: number,
  fubLegacyId: number | null,
  emailsKey: string,
): Promise<ContactSavedHome[]> => {
  const emails = emailsKey ? emailsKey.split(' ') : []
  if (!Number.isFinite(crmPersonId) || crmPersonId <= 0) return []
  const sb = createServiceClient()

  // ── 1. person → auth user ids ─────────────────────────────────────────────
  const orFilter = buildSavedHomesIdentityOrFilter(crmPersonId, fubLegacyId, emails)

  const [idmapRes, profileRes] = await Promise.all([
    sb.from('visitor_identity_map').select('user_id').or(orFilter).not('user_id', 'is', null).limit(50),
    sb.from('profiles').select('user_id').eq('crm_person_id', crmPersonId).limit(10),
  ])

  const userIds = [
    ...new Set(
      [...(idmapRes.data ?? []), ...(profileRes.data ?? [])]
        .map((r) => (r.user_id ? String(r.user_id) : ''))
        .filter(Boolean),
    ),
  ]
  if (userIds.length === 0) return []

  // ── 2. the consumer stores ────────────────────────────────────────────────
  const [likesRes, savedRes] = await Promise.all([
    sb.from('likes').select('listing_key,created_at').in('user_id', userIds).order('created_at', { ascending: false }).limit(100),
    sb.from('saved_listings').select('listing_key,created_at').in('user_id', userIds).order('created_at', { ascending: false }).limit(100),
  ])

  const rollup = rollupSavedHomeRows(
    (likesRes.data ?? []) as ConsumerStoreRow[],
    (savedRes.data ?? []) as ConsumerStoreRow[],
  )
  const keys = [...rollup.keys()]
  if (keys.length === 0) return []

  // ── 3. live tiles for the saved keys ──────────────────────────────────────
  const { data: live } = await sb
    .from('listing_tile_mv')
    .select('listing_key,street_number,street_name,city,standard_status,photo_url,list_price,beds,baths,sqft,address_slug')
    .in('listing_key', keys)
  const liveByKey = new Map((live ?? []).map((r) => [String(r.listing_key), r]))

  const out: ContactSavedHome[] = keys.map((key) => {
    const agg = rollup.get(key)!
    const r = liveByKey.get(key)
    return {
      listingKey: key,
      // Off-market homes drop out of the tile MV — keep the row (the intent
      // signal is real) with the same fallback label getViewedListings uses.
      address: r ? [r.street_number, r.street_name].filter(Boolean).join(' ') : 'Listing',
      city: (r?.city as string | null) ?? null,
      status: (r?.standard_status as string | null) ?? null,
      photoUrl: (r?.photo_url as string | null) ?? null,
      listPrice: r && r.list_price !== null ? Number(r.list_price) : null,
      beds: r && r.beds !== null ? Number(r.beds) : null,
      baths: r && r.baths !== null ? Number(r.baths) : null,
      sqft: r && r.sqft !== null ? Number(r.sqft) : null,
      addressSlug: (r?.address_slug as string | null) ?? null,
      sources: agg.sources,
      savedAt: agg.savedAt,
    }
  })

  out.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
  return out
})
