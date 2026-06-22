import { NextRequest } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { pushToFub } from '@/lib/fub'
import { findPersonByEmail } from '@/lib/followupboss'
import { canonicallyTagLead } from '@/lib/canonical-lead-tagger'
import { listingDetailPath } from '@/lib/slug'

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

  const {
    getOpenHouseByIdAndListing,
    insertOpenHouseRsvp,
    bumpOpenHouseRsvpCount,
  } = await import('@/lib/data')

  const oh = await getOpenHouseByIdAndListing(openHouseId, listingId)
  if (!oh) {
    return Response.json({ error: 'Open house not found' }, { status: 404 })
  }

  const insertRes = await insertOpenHouseRsvp({ open_house_id: oh.id, user_id: user.id })
  if (!insertRes.ok) return Response.json({ error: insertRes.error }, { status: 500 })
  if (insertRes.alreadyRsvped) return Response.json({ ok: true, alreadyRsvped: true })

  const currentCount = oh.rsvp_count ?? 0
  await bumpOpenHouseRsvpCount(oh.id, currentCount)

  const eventDate = oh.event_date as string
  const eventDateTime = new Date(`${eventDate}T${(oh.start_time ?? '09:00') as string}`)
  const in24h = new Date(eventDateTime.getTime() - 24 * 60 * 60 * 1000)
  const in1h = new Date(eventDateTime.getTime() - 60 * 60 * 1000)
  const now = new Date()
  const listingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}${listingDetailPath(listingId)}`
  if (in24h > now) {
      const { insertNotificationQueueRow } = await import('@/lib/data')
    await insertNotificationQueueRow({
      user_id: user.id,
      notification_type: 'open_house_reminder_24h',
      payload: { open_house_id: oh.id, listing_key: listingId, event_date: eventDate, listing_url: listingUrl, send_at: in24h.toISOString() },
      channel: 'email',
      status: 'pending',
    })
  }
  if (in1h > now) {
      const { insertNotificationQueueRow } = await import('@/lib/data')
    await insertNotificationQueueRow({
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
    listingUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}${listingDetailPath(listingId)}`,
    eventDate,
    tags: ['open-house-rsvp'],
  })

  // An open-house RSVP is a clear BUYER-intent lead — tag it into the canonical
  // buyer audience so it enters the buyer workflow + is counted in
  // qualified_buyer_leads, instead of carrying only the bare open-house-rsvp tag.
  // Best-effort, after the push; never blocks the RSVP response.
  if (email) {
    try {
      const person = await findPersonByEmail(email)
      if (person?.id) {
        await canonicallyTagLead({ fubPersonId: person.id, audience: 'buyer', source: 'open-house-rsvp', tier: 'warm' })
      }
    } catch (err) {
      console.warn('[open-house-rsvp] canonical tag failed (non-blocking):', err)
    }
  }

  return Response.json({ ok: true })
}
