/**
 * Process notification queue every 30s. Send emails via Resend per user preferences.
 * Section 29.
 */
import { inngest } from '@/lib/inngest'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/resend'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

export const processNotifications = inngest.createFunction(
  {
    id: 'notifications/process-queue',
    name: 'Process notification queue',
    retries: 3,
  },
  { cron: '*/1 * * * *' },
  async () => {
    const supabase = getServiceSupabase()
    const { data: pending } = await supabase
      .from('notification_queue')
      .select('id, user_id, notification_type, payload, created_at')
      .eq('status', 'pending')
      .eq('channel', 'email')
      .order('created_at', { ascending: true })
      .limit(100)

    if (!pending?.length) return { processed: 0 }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://ryan-realty.com'

    for (const row of pending) {
      const payload = (row.payload as Record<string, unknown>) ?? {}
      const sendAt = payload.send_at != null ? new Date(payload.send_at as string) : null
      if (sendAt && sendAt.getTime() > Date.now()) continue
      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('user_id', row.user_id)
        .maybeSingle()

      const prefs = (profile?.notification_preferences as Record<string, unknown>) ?? {}
      const emailEnabled = prefs.emailEnabled !== false
      if (!emailEnabled) {
        await supabase.from('notification_queue').update({ status: 'skipped', sent_at: new Date().toISOString() }).eq('id', row.id)
        continue
      }

      const { data: user } = await supabase.auth.admin.getUserById(row.user_id)
      const to = user?.user?.email
      if (!to) {
        await supabase.from('notification_queue').update({ status: 'error', error: 'No email' }).eq('id', row.id)
        continue
      }

      let subject = 'Update from Ryan Realty'
      let html = '<p>You have a notification from Ryan Realty.</p>'
      if (row.notification_type === 'saved_search_match') {
        const listingKey = typeof payload.listing_key === 'string' ? payload.listing_key : ''
        subject = 'New homes match your search'
        html = `<p>New listings match your saved search. <a href="${siteUrl}/listing/${encodeURIComponent(listingKey)}">View listing</a>.</p>`
      } else if (row.notification_type === 'price_drop') {
        const listingKey = typeof payload.listing_key === 'string' ? payload.listing_key : ''
        const newPrice = payload.new_price != null ? Number(payload.new_price) : null
        subject = 'Price drop on a saved home'
        html = `<p>A home you saved has a price update. ${newPrice != null ? `New price: $${newPrice.toLocaleString()}.` : ''} <a href="${siteUrl}/listing/${encodeURIComponent(listingKey)}">View listing</a>.</p>`
      } else if (row.notification_type === 'status_change') {
        const listingKey = typeof payload.listing_key === 'string' ? payload.listing_key : ''
        subject = 'Status update on a saved home'
        html = `<p>A home you saved has a status update. <a href="${siteUrl}/listing/${encodeURIComponent(listingKey)}">View listing</a>.</p>`
      } else if (row.notification_type === 'open_house_reminder_24h') {
        const listingUrl = typeof payload.listing_url === 'string' ? payload.listing_url : `${siteUrl}/listings`
        const eventDate = typeof payload.event_date === 'string' ? payload.event_date : ''
        subject = 'Open house tomorrow — reminder'
        html = `<p>Reminder: You're signed up for an open house${eventDate ? ` on ${eventDate}` : ''}. <a href="${listingUrl}">View listing and details</a>.</p>`
      } else if (row.notification_type === 'open_house_reminder_1h') {
        const listingUrl = typeof payload.listing_url === 'string' ? payload.listing_url : `${siteUrl}/listings`
        subject = 'Open house in 1 hour'
        html = `<p>Your open house is in about an hour. <a href="${listingUrl}">View listing and address</a>.</p>`
      }

      const result = await sendEmail({ to, subject, html })
      if (result.error) {
        await supabase.from('notification_queue').update({ status: 'error', error: result.error }).eq('id', row.id)
        continue
      }
      await supabase.from('notification_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', row.id)
    }

    return { processed: pending.length }
  }
)
