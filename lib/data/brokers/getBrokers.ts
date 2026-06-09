/**
 * getBrokers — list of active brokers at Ryan Realty.
 *
 * Three brokers as of 2026-05-22:
 *   - matt-ryan (Matt Ryan, Principal)
 *   - paul-stevenson (Paul Stevenson)
 *   - rebecca-ryser-peterson (Rebecca Ryser Peterson)
 *
 * Source: `public.brokers` table. Cached for 24h (brokers rarely change).
 *
 * Hardcoded fallback exists for when the DB is unreachable — the brokerage
 * facts are locked per docs/SITE_SPEC.md and brand-voice rules.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon, supabaseServer } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import type { Broker } from '@/lib/data/types/broker'
import { BROKERS, type BrokerKey } from '@/lib/brand/contact'

/** Canonical local transparent headshots, keyed by slug (+ known aliases). */
const HEADSHOT_PNG: Record<string, string> = {
  'matthew-ryan': '/images/brokers/ryan-matt.png',
  'matt-ryan': '/images/brokers/ryan-matt.png',
  'paul-stevenson': '/images/brokers/stevenson-paul.png',
  'rebecca-peterson': '/images/brokers/peterson-rebecca.png',
  'rebecca-ryser-peterson': '/images/brokers/peterson-rebecca.png',
}
const HEADSHOT_JPG: Record<string, string> = {
  'matthew-ryan': '/images/brokers/ryan-matt.jpg',
  'matt-ryan': '/images/brokers/ryan-matt.jpg',
  'paul-stevenson': '/images/brokers/stevenson-paul.jpg',
  'rebecca-peterson': '/images/brokers/peterson-rebecca.jpg',
  'rebecca-ryser-peterson': '/images/brokers/peterson-rebecca.jpg',
}

/** Normalize a stored phone to the brand-voice dotted format (541.703.3095). */
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  if (digits.length === 11 && digits.startsWith('1')) {
    const d = digits.slice(1)
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  }
  return raw.trim() || null
}

/**
 * Canonical broker fallback — used ONLY when the brokers table is unreachable.
 * Slugs + contact + licenses + specialties mirror the live public.brokers rows
 * (verified 2026-06-02). Bios are long-form and live in the DB, so they stay
 * null here; the detail page supplies a factual fallback sentence when absent.
 */
/** Render extras not carried in the canonical identity module, keyed by BrokerKey. */
const FALLBACK_SPECIALTIES: Record<BrokerKey, string[]> = {
  matt: ['Residential', 'Buyer Representation', 'Seller Services', 'Relocation'],
  paul: ['Redmond Area', 'Rural Properties', 'First-Time Buyers', 'Family Homes'],
  rebecca: ['First-Time Buyers', 'Investment Properties', 'Residential Sales', 'Relocation'],
}

const FALLBACK_BROKERS: Broker[] = (Object.keys(BROKERS) as BrokerKey[]).map((key) => {
  const b = BROKERS[key]
  return {
    slug: b.slug,
    fullName: b.name,
    title: b.title,
    email: b.email,
    phoneDirect: b.phone,
    phoneFub: b.phone,
    headshotPng: HEADSHOT_PNG[b.slug] ?? null,
    headshotJpg: HEADSHOT_JPG[b.slug] ?? null,
    licenseNumber: b.license,
    bio: null,
    isPrincipal: b.isPrincipal,
    specialties: FALLBACK_SPECIALTIES[key],
  }
})

/** Look up "Matt Ryan" broker (used by FUB pipeline snapshots). */
export async function getMattBrokerRecord(): Promise<{ id: string; slug?: string | null; email?: string | null } | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data } = await sb
    .from('brokers')
    .select('id, slug, display_name, email')
    .or('slug.eq.matt-ryan,display_name.ilike.%matt%ryan%,email.ilike.%matt%')
    .limit(1)
    .maybeSingle()
  return (data ?? null) as { id: string; slug?: string | null; email?: string | null } | null
}

/** Read full broker row for self-service editor (license, social, tagline, etc.). */
export async function getBrokerSelfRecord(brokerId: string): Promise<Record<string, unknown> | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data } = await sb
    .from('brokers')
    .select(
      'id, slug, display_name, title, bio, phone, email, tagline, social_instagram, social_facebook, social_linkedin, social_youtube, social_tiktok, social_x, license_number'
    )
    .eq('id', brokerId)
    .maybeSingle()
  return (data ?? null) as Record<string, unknown> | null
}

/** Patch a broker row by id (self-service editor). */
export async function updateBrokerById(
  id: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const sb = supabaseAnon()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('brokers').update(payload).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// ── Slug alias map (mirrors app/actions/brokers.ts BROKER_SLUG_ALIASES) ──────
const BROKER_SLUG_ALIASES: Record<string, string> = {
  matt: 'matthew-ryan',
  'matt-ryan': 'matthew-ryan',
  matthew: 'matthew-ryan',
  'matthew-ryan': 'matthew-ryan',
  rebecca: 'rebecca-peterson',
  'rebecca-peterson': 'rebecca-peterson',
  'rebecca-ryser-peterson': 'rebecca-peterson',
  'rebecca-ryser': 'rebecca-peterson',
  paul: 'paul-stevenson',
  'paul-stevenson': 'paul-stevenson',
}

// OREA-confirmed license numbers (filled when brokers table row has null).
const CONFIRMED_LICENSES: Record<string, string> = {
  'paul-stevenson': '201259123',
  'rebecca-peterson': '201254727',
}

const BROKER_FULL_SELECT =
  'id, slug, display_name, title, license_number, bio, photo_url, email, phone, google_review_url, zillow_review_url, sort_order, is_active, created_at, updated_at, tagline, specialties, designations, years_experience, social_instagram, social_facebook, social_linkedin, social_youtube, social_tiktok, social_x, mls_id, zillow_id, realtor_id, yelp_id, google_business_id, intro_video_url, saved_headshot_urls'

/**
 * getBrokerBySlug — full broker row for the /team/[slug] detail page.
 *
 * Resolves slug aliases (e.g. 'matt-ryan' → 'matthew-ryan') and fills the
 * OREA-confirmed license number when the DB row has none.
 *
 * Uses supabaseAnon() (NOT supabaseServer) so this is safe inside
 * unstable_cache. Cached 1h (brokers change rarely, but we want slug redirects
 * to take effect the same day without a full deploy).
 */
export const getBrokerBySlug = unstable_cache(
  async (slug: string): Promise<Record<string, unknown> | null> => {
    const sb = supabaseAnon()
    if (!sb) return null
    const requested = slug.trim().toLowerCase()
    const canonical = BROKER_SLUG_ALIASES[requested]
    const candidates =
      canonical && canonical !== requested ? [requested, canonical] : [requested]

    const { data, error } = await sb
      .from('brokers')
      .select(BROKER_FULL_SELECT)
      .in('slug', candidates)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(`[getBrokerBySlug] ${error.message}`)
    const broker = (data ?? null) as Record<string, unknown> | null
    if (broker && !String(broker.license_number ?? '').trim() && CONFIRMED_LICENSES[String(broker.slug)]) {
      broker.license_number = CONFIRMED_LICENSES[String(broker.slug)]!
    }
    return broker
  },
  ['broker-by-slug-v1'],
  { revalidate: 3600, tags: [cacheTag.brokers] }
)

/** Read one active broker by slug — used by OG image generator + profile pages. */
export async function getBrokerForOgBySlug(
  slug: string
): Promise<{ display_name?: string; title?: string; photo_url?: string } | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data } = await sb
    .from('brokers')
    .select('display_name, title, photo_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  return (data ?? null) as { display_name?: string; title?: string; photo_url?: string } | null
}

/** Read one blog_posts row by slug — used by OG image generator. */
export async function getBlogPostForOgBySlug(
  slug: string
): Promise<{ title?: string; hero_image_url?: string; category?: string } | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data } = await sb
    .from('blog_posts')
    .select('title, hero_image_url, category')
    .eq('slug', slug)
    .maybeSingle()
  return (data ?? null) as { title?: string; hero_image_url?: string; category?: string } | null
}

/** Search brokers by display_name ilike (active only). Used by search-suggestions. */
export async function searchBrokersByDisplayName(
  pattern: string,
  limit = 10
): Promise<Array<{ slug?: string | null; display_name?: string | null }>> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data } = await sb
    .from('brokers')
    .select('slug, display_name')
    .eq('is_active', true)
    .ilike('display_name', `%${pattern}%`)
    .limit(Math.min(Math.max(limit, 1), 50))
  return (data ?? []) as Array<{ slug?: string | null; display_name?: string | null }>
}

export const getBrokers = unstable_cache(
  async (): Promise<Broker[]> => {
    // Public `brokers` table — no RLS, no cookies. Using supabaseAnon
    // here so this function is safe to call from inside any cached
    // scope (Next.js forbids cookies()/supabaseServer() inside
    // unstable_cache). The previous supabaseServer() call broke every
    // page that depended on resolveListingAgent → getBrokers.
    const supabase = supabaseAnon()
    if (!supabase) return FALLBACK_BROKERS
    // NOTE: the brokers table uses display_name / phone / photo_url (NOT
    // full_name / phone_direct / headshot_png). The prior select queried
    // non-existent columns, so every call errored and silently served the
    // fallback roster — hiding the real bios, specialties, and contact info.
    const { data, error } = await supabase
      .from('brokers')
      .select(
        'slug, display_name, title, email, phone, photo_url, license_number, bio, ' +
          'sort_order, is_active, tagline, specialties, designations, years_experience, ' +
          'google_review_url, zillow_review_url, intro_video_url, ' +
          'social_instagram, social_facebook, social_linkedin, social_youtube, social_tiktok, social_x'
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('display_name', { ascending: true })

    if (error || !data || data.length === 0) {
      if (error) console.error('[getBrokers] falling back to hardcoded roster', { error })
      return FALLBACK_BROKERS
    }

    return (data as unknown as Array<Record<string, unknown>>).map((row) => {
      const slug = (row.slug as string) ?? ''
      const title = (row.title as string) ?? 'Broker'
      const phone = normalizePhone(row.phone as string | null)
      const photoUrl = (row.photo_url as string | null) ?? null
      return {
        slug,
        fullName: (row.display_name as string) ?? '',
        title,
        email: (row.email as string | null) ?? null,
        phoneDirect: phone,
        phoneFub: phone,
        headshotPng: HEADSHOT_PNG[slug] ?? photoUrl ?? '/images/brokers/ryan-matt.png',
        headshotJpg: HEADSHOT_JPG[slug] ?? photoUrl ?? '/images/brokers/ryan-matt.jpg',
        licenseNumber: (row.license_number as string | null) ?? null,
        bio: (row.bio as string | null) ?? null,
        isPrincipal: /principal/i.test(title) || (row.sort_order as number) === 0,
        tagline: (row.tagline as string | null) ?? null,
        specialties: Array.isArray(row.specialties) ? (row.specialties as string[]) : [],
        designations: Array.isArray(row.designations) ? (row.designations as string[]) : [],
        yearsExperience: (row.years_experience as number | null) ?? null,
        photoUrl,
        reviews: {
          google: (row.google_review_url as string | null) ?? null,
          zillow: (row.zillow_review_url as string | null) ?? null,
        },
        social: {
          instagram: (row.social_instagram as string | null) ?? null,
          facebook: (row.social_facebook as string | null) ?? null,
          linkedin: (row.social_linkedin as string | null) ?? null,
          youtube: (row.social_youtube as string | null) ?? null,
          tiktok: (row.social_tiktok as string | null) ?? null,
          x: (row.social_x as string | null) ?? null,
        },
        introVideoUrl: (row.intro_video_url as string | null) ?? null,
      }
    })
  },
  ['brokers-v2'],
  {
    revalidate: CACHE_WINDOWS.brokers,
    tags: [cacheTag.brokers],
  }
)
