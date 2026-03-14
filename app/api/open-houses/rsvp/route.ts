import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { pushToFub } from '@/lib/fub'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function getServiceSupabase() {
  if (!url?.trim() || !serviceKey?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, serviceKey)
}

type RsvpBody = { openHouseId: string; listingId: string }

/**
 * POST /api/open-houses/rsvp
 * Body: { openHouseId, listingId } (listingId = listing_key).
 * Requires auth. Creates open_house_rsvps, increments rsvp_count, queues reminders, pushes to FUB.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: RsvpBody
  try {
    body = (await request.json()) as RsvpBody
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const openHouseId = body.openHouseId?.trim()
  const listingId = body.listingId?.trim()
  if (!openHouseId || !listingId) {
    return Response.json({ error: 'openHouseId and listingId required' }, { status: 400 })
  }

  const service = getServiceSupabase()

  const { data: oh, error: ohError } = await service
    .from('open_houses')
    .select('id, listing_key, event_date, start_time, end_time, rsvp_count')
    .eq('id', openHouseId)
    .eq('listing_key', listingId)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .maybeSingle()

  if (ohError || !oh) {
    return Response.json({ error: 'Open house not found' }, { status: 404 })
  }

  const { error: insertError } = await service.from('open_house_rsvps').insert({
    open_house_id: oh.id,
    user_id: user.id,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return Response.json({ ok: true, alreadyRsvped: true })
    }
    return Response.json({ error: insertError.message }, { status: 500 })
  }

  const currentCount = (oh as { rsvp_count?: number }).rsvp_count ?? 0
  await service.from('open_houses').update({ rsvp_count: currentCount + 1, updated_at: new Date().toISOString() }).eq('id', oh.id)

  const eventDate = oh.event_date as string
  const eventDateTime = new Date(`${eventDate}T${(oh.start_time ?? '09:00') as string}`)
  const in24h = new Date(eventDateTime.getTime() - 24 * 60 * 60 * 1000)
  const in1h = new Date(eventDateTime.getTime() - 60 * 60 * 1000)
  const now = new Date()
  const listingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/listing/${encodeURIComponent(listingId)}`
  if (in24h > now) {
    await service.from('notification_queue').insert({
      user_id: user.id,
      notification_type: 'open_house_reminder_24h',
      payload: { open_house_id: oh.id, listing_key: listingId, event_date: eventDate, listing_url: listingUrl, send_at: in24h.toISOString() },
      channel: 'email',
      status: 'pending',
    })
  }
  if (in1h > now) {
    await service.from('notification_queue').insert({
      user_id: user.id,
      notification_type: 'open_house_reminder_1h',
      payload: { open_house_id: oh.id, listing_key: listingId, event_date: eventDate, listing_url: listingUrl, send_at: in1h.toISOString() },
      channel: 'email',
      status: 'pending',
    })
  }

  const email = user.email ?? ''
  const name = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? '').toString().trim()
  const [firstName, ...rest] = name.split(/\s+/)
  const lastName = rest.join(' ') || undefined
  await pushToFub('Open House RSVP', { email, firstName: firstName || undefined, lastName }, {
    listingUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/listing/${encodeURIComponent(listingId)}`,
    eventDate,
    tags: ['open-house-rsvp'],
  })

  return Response.json({ ok: true })
}
