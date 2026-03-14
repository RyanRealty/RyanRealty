import { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { generateICS } from '@/lib/ics'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'

function getSupabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

/**
 * GET /api/calendar?listingKey=...&openHouseId=...
 * Returns .ics file for the open house event.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const listingKey = searchParams.get('listingKey')?.trim()
  const openHouseId = searchParams.get('openHouseId')?.trim()

  if (!listingKey || !openHouseId) {
    return new Response('Missing listingKey or openHouseId', { status: 400 })
  }

  const supabase = getSupabase()
  const { data: oh, error: ohError } = await supabase
    .from('open_houses')
    .select('id, listing_key, event_date, start_time, end_time, host_agent_name')
    .eq('id', openHouseId)
    .eq('listing_key', listingKey)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .maybeSingle()

  if (ohError || !oh) {
    return new Response('Open house not found', { status: 404 })
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('listing_key')
    .or(`listing_key.eq.${listingKey},ListingKey.eq.${listingKey}`)
    .maybeSingle()

  const listingRow = listing as { listing_key?: string; ListingKey?: string } | null
  const key = listingRow?.listing_key ?? listingRow?.ListingKey ?? listingKey
  const listingUrl = `${siteUrl.replace(/\/$/, '')}/listing/${encodeURIComponent(key)}`
  const address = await getAddress(supabase, listingKey)

  const startTime = (oh.start_time ?? '09:00:00').toString().slice(0, 8)
  const endTime = (oh.end_time ?? '12:00:00').toString().slice(0, 8)
  const description = [
    listingUrl,
    oh.host_agent_name ? `Host: ${oh.host_agent_name}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const ics = generateICS({
    title: `Open House at ${address || 'Property'}`,
    description,
    location: address || 'See listing',
    startDate: oh.event_date,
    endDate: oh.event_date,
    startTime: startTime.replace(/(\d{2}):(\d{2})(?::(\d{2}))?/, (_: string, h: string, m: string, s?: string) => `${h}:${m}${s ? `:${s}` : ':00'}`),
    endTime: endTime.replace(/(\d{2}):(\d{2})(?::(\d{2}))?/, (_: string, h: string, m: string, s?: string) => `${h}:${m}${s ? `:${s}` : ':00'}`),
    url: listingUrl,
  })

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="open-house-${oh.event_date}.ics"`,
    },
  })
}

async function getAddress(supabase: SupabaseClient, listingKey: string): Promise<string> {
  const { data: row } = await supabase
    .from('listings')
    .select('property_id')
    .or(`listing_key.eq.${listingKey},ListingKey.eq.${listingKey}`)
    .maybeSingle()
  const listing = row as { property_id?: string } | null
  if (!listing?.property_id) return ''
  const { data: prop } = await supabase
    .from('properties')
    .select('unparsed_address, street_number, street_name, city, state, postal_code')
    .eq('id', listing.property_id)
    .maybeSingle()
  const p = prop as { unparsed_address?: string; street_number?: string; street_name?: string; city?: string; state?: string; postal_code?: string } | null
  if (!p) return ''
  if (p.unparsed_address) return p.unparsed_address
  const parts = [p.street_number, p.street_name].filter(Boolean).join(' ')
  return [parts, p.city, p.state, p.postal_code].filter(Boolean).join(', ')
}
