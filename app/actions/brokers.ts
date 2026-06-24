'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { revalidatePath, unstable_cache } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { logAdminAction } from '@/app/actions/log-admin-action'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

export type BrokerRow = {
  id: string
  slug: string
  display_name: string
  title: string
  license_number: string | null
  bio: string | null
  photo_url: string | null
  email: string | null
  phone: string | null
  google_review_url: string | null
  zillow_review_url: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  tagline?: string | null
  specialties?: string[] | null
  designations?: string[] | null
  years_experience?: number | null
  social_instagram?: string | null
  social_facebook?: string | null
  social_linkedin?: string | null
  social_youtube?: string | null
  social_tiktok?: string | null
  social_x?: string | null
  mls_id?: string | null
  zillow_id?: string | null
  realtor_id?: string | null
  yelp_id?: string | null
  google_business_id?: string | null
  intro_video_url?: string | null
  saved_headshot_urls?: string[] | null
}

const BROKER_SELECT =
  'id, slug, display_name, title, license_number, bio, photo_url, email, phone, twilio_number, google_review_url, zillow_review_url, sort_order, is_active, created_at, updated_at, tagline, specialties, designations, years_experience, social_instagram, social_facebook, social_linkedin, social_youtube, social_tiktok, social_x, mls_id, zillow_id, realtor_id, yelp_id, google_business_id, intro_video_url, saved_headshot_urls'

/**
 * Public display phone = the broker's Twilio business line (brokers.twilio_number),
 * falling back to the legacy phone column, in brand-voice dotted format. Inbound
 * to the Twilio line is recorded, logged to the CRM timeline, and forwarded to
 * the broker's private cell. forward_to_cell is never selected here. This is the
 * source the public /team pages render (via getAgentBySlug). (Twilio cutover
 * 2026-06-24.)
 */
function withPublicPhone(broker: BrokerRow | null): BrokerRow | null {
  if (!broker) return broker
  const raw = (broker as { twilio_number?: string | null }).twilio_number ?? broker.phone
  if (raw) {
    const digits = String(raw).replace(/\D/g, '')
    const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
    if (ten.length === 10) broker.phone = `${ten.slice(0, 3)}.${ten.slice(3, 6)}.${ten.slice(6)}`
  }
  return broker
}

async function _getActiveBrokersUncached(): Promise<BrokerRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return []
  const supabase = createClient(url, anonKey)
  const { data } = await supabase
    .from('brokers')
    .select(BROKER_SELECT)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('display_name', { ascending: true })
  return ((data ?? []) as BrokerRow[]).map((b) => withPublicPhone(b) as BrokerRow)
}

const _getActiveBrokersCached = unstable_cache(
  _getActiveBrokersUncached,
  // v2: cache-key bump on the Twilio-cutover phone change (public phone is now
  // twilio_number) so the deploy orphans stale pre-migration cached rows.
  ['active-brokers-v2'],
  { revalidate: 900, tags: ['brokers'] }
)

export async function getActiveBrokers(): Promise<BrokerRow[]> {
  return _getActiveBrokersCached()
}

/**
 * Broker slug aliases → the canonical slug stored in the `brokers` table.
 *
 * BUG FIX 2026-05-31: /team links (and CLAUDE.md agent-attribution params, and
 * inbound/printed links) use several slug variants, but the DB rows are
 * `matthew-ryan`, `paul-stevenson`, `rebecca-peterson`. /team linked to
 * `matt-ryan` + `rebecca-ryser-peterson`, which matched no DB row → notFound()
 * (rendered as a soft-404) → "there are no broker pages." Resolve every known
 * variant to the canonical row so every link works.
 */
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

/**
 * Per-broker Oregon real estate license numbers, confirmed by Matt from the
 * official OREA registry (2026-06-01, ACTIVE Central Oregon brokers). Used to
 * fill license_number ONLY when the brokers-table row has it null, so the public
 * broker pages always show the compliant Oregon license. Remove an entry once it
 * is set in the DB via the admin brokers panel. Oregon advertising compliance.
 */
const CONFIRMED_LICENSES: Record<string, string> = {
  'paul-stevenson': '201259123',
  'rebecca-peterson': '201254727',
}

export async function getBrokerBySlug(slug: string): Promise<BrokerRow | null> {
  const supabase = await createServerClient()
  const requested = slug.trim().toLowerCase()
  const canonical = BROKER_SLUG_ALIASES[requested]
  // Try the requested slug AND its canonical alias (if any) in one query, so a
  // link using any known variant resolves. maybeSingle (not single) returns
  // null cleanly on a genuine miss instead of throwing.
  const candidates = canonical && canonical !== requested ? [requested, canonical] : [requested]
  const { data } = await supabase
    .from('brokers')
    .select(BROKER_SELECT)
    .in('slug', candidates)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  const broker = data as BrokerRow | null
  // Fill the OREA-confirmed license when the DB row has none, so the broker page
  // stays Oregon-advertising compliant until the number is entered in the admin panel.
  if (broker && !broker.license_number?.trim() && CONFIRMED_LICENSES[broker.slug]) {
    broker.license_number = CONFIRMED_LICENSES[broker.slug]!
  }
  // Public display phone = the broker's Twilio business line (twilio_number),
  // dotted, falling back to the legacy phone column. (Twilio cutover 2026-06-24.)
  return withPublicPhone(broker)
}

/** All brokers for admin (including inactive). */
export async function getBrokersForAdmin(): Promise<BrokerRow[]> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('brokers')
    .select(BROKER_SELECT)
    .order('sort_order', { ascending: true })
    .order('display_name', { ascending: true })
  return (data ?? []) as BrokerRow[]
}

/** Single broker by id (for admin edit). */
export async function getBrokerById(id: string): Promise<BrokerRow | null> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('brokers')
    .select(BROKER_SELECT)
    .eq('id', id.trim())
    .single()
  return data as BrokerRow | null
}

export type BrokerUpdateInput = {
  display_name?: string
  title?: string
  license_number?: string | null
  bio?: string | null
  photo_url?: string | null
  email?: string | null
  phone?: string | null
  google_review_url?: string | null
  zillow_review_url?: string | null
  sort_order?: number
  is_active?: boolean
  tagline?: string | null
  specialties?: string[] | null
  designations?: string[] | null
  years_experience?: number | null
  social_instagram?: string | null
  social_facebook?: string | null
  social_linkedin?: string | null
  social_youtube?: string | null
  social_tiktok?: string | null
  social_x?: string | null
  mls_id?: string | null
  zillow_id?: string | null
  realtor_id?: string | null
  yelp_id?: string | null
  google_business_id?: string | null
  intro_video_url?: string | null
  saved_headshot_urls?: string[] | null
}

/** Update broker (admin only; uses service role). */
export async function updateBroker(id: string, input: BrokerUpdateInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getServiceSupabase()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.display_name !== undefined) payload.display_name = input.display_name
  if (input.title !== undefined) payload.title = input.title
  if (input.license_number !== undefined) payload.license_number = input.license_number
  if (input.bio !== undefined) payload.bio = input.bio
  if (input.photo_url !== undefined) payload.photo_url = input.photo_url
  if (input.email !== undefined) payload.email = input.email
  if (input.phone !== undefined) payload.phone = input.phone
  if (input.google_review_url !== undefined) payload.google_review_url = input.google_review_url
  if (input.zillow_review_url !== undefined) payload.zillow_review_url = input.zillow_review_url
  if (input.sort_order !== undefined) payload.sort_order = input.sort_order
  if (input.is_active !== undefined) payload.is_active = input.is_active
  if (input.tagline !== undefined) payload.tagline = input.tagline
  if (input.specialties !== undefined) payload.specialties = input.specialties
  if (input.designations !== undefined) payload.designations = input.designations
  if (input.years_experience !== undefined) payload.years_experience = input.years_experience
  if (input.social_instagram !== undefined) payload.social_instagram = input.social_instagram
  if (input.social_facebook !== undefined) payload.social_facebook = input.social_facebook
  if (input.social_linkedin !== undefined) payload.social_linkedin = input.social_linkedin
  if (input.social_youtube !== undefined) payload.social_youtube = input.social_youtube
  if (input.social_tiktok !== undefined) payload.social_tiktok = input.social_tiktok
  if (input.social_x !== undefined) payload.social_x = input.social_x
  if (input.mls_id !== undefined) payload.mls_id = input.mls_id
  if (input.zillow_id !== undefined) payload.zillow_id = input.zillow_id
  if (input.realtor_id !== undefined) payload.realtor_id = input.realtor_id
  if (input.yelp_id !== undefined) payload.yelp_id = input.yelp_id
  if (input.google_business_id !== undefined) payload.google_business_id = input.google_business_id
  if (input.intro_video_url !== undefined) payload.intro_video_url = input.intro_video_url
  if (input.saved_headshot_urls !== undefined) payload.saved_headshot_urls = input.saved_headshot_urls
  const { error } = await supabase.from('brokers').update(payload).eq('id', id.trim())
  if (error) return { ok: false, error: error.message }
  const session = await getSession()
  const role = session?.user?.email ? (await getAdminRoleForEmail(session.user.email))?.role ?? null : null
  await logAdminAction({ adminEmail: session?.user?.email ?? '', role, actionType: 'update', resourceType: 'broker', resourceId: id, details: payload })
  revalidatePath('/team')
  revalidatePath('/admin/brokers')
  return { ok: true }
}

export type BrokerCreateInput = {
  slug: string
  display_name: string
  title: string
  license_number: string
  bio?: string | null
  photo_url?: string | null
  email?: string | null
  phone?: string | null
  google_review_url?: string | null
  zillow_review_url?: string | null
  sort_order?: number
  is_active?: boolean
  tagline?: string | null
  specialties?: string[] | null
  designations?: string[] | null
  years_experience?: number | null
  social_instagram?: string | null
  social_facebook?: string | null
  social_linkedin?: string | null
  social_youtube?: string | null
  social_tiktok?: string | null
  social_x?: string | null
  mls_id?: string | null
  zillow_id?: string | null
  realtor_id?: string | null
  yelp_id?: string | null
  google_business_id?: string | null
  intro_video_url?: string | null
}

/** Create broker (admin only; uses service role). Required: slug, display_name, title, license_number. */
export async function createBroker(input: BrokerCreateInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const slug = input.slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (!slug) return { ok: false, error: 'Slug is required.' }
  if (!input.display_name?.trim()) return { ok: false, error: 'Display name is required.' }
  if (!input.title?.trim()) return { ok: false, error: 'Title is required.' }
  if (!input.license_number?.trim()) return { ok: false, error: 'License number is required (Oregon advertising compliance).' }
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('brokers')
    .insert({
      slug,
      display_name: input.display_name.trim(),
      title: input.title.trim(),
      license_number: input.license_number.trim(),
      bio: input.bio?.trim() || null,
      photo_url: input.photo_url?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      google_review_url: input.google_review_url?.trim() || null,
      zillow_review_url: input.zillow_review_url?.trim() || null,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
      tagline: input.tagline?.trim() || null,
      specialties: input.specialties ?? null,
      designations: input.designations ?? null,
      years_experience: input.years_experience ?? null,
      social_instagram: input.social_instagram?.trim() || null,
      social_facebook: input.social_facebook?.trim() || null,
      social_linkedin: input.social_linkedin?.trim() || null,
      social_youtube: input.social_youtube?.trim() || null,
      social_tiktok: input.social_tiktok?.trim() || null,
      social_x: input.social_x?.trim() || null,
      mls_id: input.mls_id?.trim() || null,
      zillow_id: input.zillow_id?.trim() || null,
      realtor_id: input.realtor_id?.trim() || null,
      yelp_id: input.yelp_id?.trim() || null,
      google_business_id: input.google_business_id?.trim() || null,
      intro_video_url: input.intro_video_url?.trim() || null,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  const session = await getSession()
  const role = session?.user?.email ? (await getAdminRoleForEmail(session.user.email))?.role ?? null : null
  await logAdminAction({ adminEmail: session?.user?.email ?? '', role, actionType: 'create', resourceType: 'broker', resourceId: data.id, details: { slug } })
  revalidatePath('/team')
  revalidatePath('/admin/brokers')
  return { ok: true, id: data.id }
}

/** Delete broker (admin only; uses service role). Removes broker row; admin_roles.broker_id will be set NULL by FK. */
export async function deleteBroker(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getServiceSupabase()
  const { error } = await supabase.from('brokers').delete().eq('id', id.trim())
  if (error) return { ok: false, error: error.message }
  const session = await getSession()
  const role = session?.user?.email ? (await getAdminRoleForEmail(session.user.email))?.role ?? null : null
  await logAdminAction({ adminEmail: session?.user?.email ?? '', role, actionType: 'delete', resourceType: 'broker', resourceId: id })
  revalidatePath('/team')
  revalidatePath('/admin/brokers')
  return { ok: true }
}
