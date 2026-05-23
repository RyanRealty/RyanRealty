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
import type { Broker, BrokerSlug } from '@/lib/data/types/broker'

/**
 * Canonical broker fallback — used when the brokers table is unreachable
 * or unpopulated. Mirrors the locked roster in docs/SITE_SPEC.md.
 */
const FALLBACK_BROKERS: Broker[] = [
  {
    slug: 'matt-ryan',
    fullName: 'Matt Ryan',
    title: 'Owner & Principal Broker',
    email: 'matt@ryan-realty.com',
    phoneDirect: '541.213.6706',
    phoneFub: '541.703.3095',
    headshotPng: '/images/brokers/ryan-matt.png',
    headshotJpg: '/images/brokers/ryan-matt.jpg',
    licenseNumber: '201206613',
    bio: null,
    isPrincipal: true,
  },
  {
    slug: 'paul-stevenson',
    fullName: 'Paul Stevenson',
    title: 'Broker',
    email: null,
    phoneDirect: null,
    phoneFub: '541.977.6841',
    headshotPng: '/images/brokers/stevenson-paul.png',
    headshotJpg: '/images/brokers/stevenson-paul.jpg',
    licenseNumber: null,
    bio: null,
    isPrincipal: false,
  },
  {
    slug: 'rebecca-ryser-peterson',
    fullName: 'Rebecca Ryser Peterson',
    title: 'Broker',
    email: null,
    phoneDirect: null,
    phoneFub: '415.308.9087',
    headshotPng: '/images/brokers/peterson-rebecca.png',
    headshotJpg: '/images/brokers/peterson-rebecca.jpg',
    licenseNumber: null,
    bio: null,
    isPrincipal: false,
  },
]

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
    const supabase = await supabaseServer()
    const { data, error } = await supabase
      .from('brokers')
      .select(
        'slug, full_name, title, email, phone_direct, phone_fub, ' +
          'headshot_png, headshot_jpg, license_number, bio, is_principal'
      )
      .order('is_principal', { ascending: false })
      .order('full_name', { ascending: true })

    if (error || !data || data.length === 0) {
      if (error) console.error('[getBrokers] falling back to hardcoded roster', { error })
      return FALLBACK_BROKERS
    }

    return data.map((row: Record<string, unknown>) => ({
      slug: row.slug as BrokerSlug,
      fullName: row.full_name as string,
      title: row.title as string,
      email: row.email as string | null,
      phoneDirect: row.phone_direct as string | null,
      phoneFub: row.phone_fub as string | null,
      headshotPng: row.headshot_png as string,
      headshotJpg: row.headshot_jpg as string,
      licenseNumber: row.license_number as string | null,
      bio: row.bio as string | null,
      isPrincipal: Boolean(row.is_principal),
    }))
  },
  ['brokers'],
  {
    revalidate: CACHE_WINDOWS.brokers,
    tags: [cacheTag.brokers],
  }
)
