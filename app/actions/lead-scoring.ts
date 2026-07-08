'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { countListingAlertsForUser } from '@/lib/data/leads/listingAlerts'

/**
 * Lead Scoring System
 *
 * Computes a 0-100 lead score based on user behavior signals.
 * Higher scores indicate higher purchase intent.
 *
 * Score components:
 * - Page views (0-15): More views = more engaged
 * - Listings viewed (0-20): Viewing many listings = actively shopping
 * - Saves (0-20): Saving homes = strong intent
 * - Return visits (0-15): Coming back = serious buyer
 * - Time depth (0-10): Viewing details, not just browsing
 * - Contact actions (0-20): Inquiries, showing requests = ready to act
 *
 * Thresholds:
 * - 70+: Hot lead — immediate follow-up
 * - 50-69: Warm lead — prioritize outreach
 * - 30-49: Engaged — nurture sequence
 * - 0-29: Cold — passive monitoring
 */

export type LeadScore = {
  score: number
  label: 'hot' | 'warm' | 'engaged' | 'cold'
  components: {
    pageViews: number
    listingsViewed: number
    saves: number
    returnVisits: number
    timeDepth: number
    contactActions: number
  }
  computedAt: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getLabel(score: number): LeadScore['label'] {
  if (score >= 70) return 'hot'
  if (score >= 50) return 'warm'
  if (score >= 30) return 'engaged'
  return 'cold'
}

/**
 * Compute lead score for a user based on their behavior data.
 */
export async function computeLeadScore(userId: string): Promise<LeadScore> {
  const supabase = createServiceClient()
  const components = {
    pageViews: 0,
    listingsViewed: 0,
    saves: 0,
    returnVisits: 0,
    timeDepth: 0,
    contactActions: 0,
  }

  if (!supabase) {
    return { score: 0, label: 'cold', components, computedAt: new Date().toISOString() }
  }

  try {
    // Count page views (from user_activities or listing_views)
    const { count: viewCount } = await supabase
      .from('listing_views')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    const views = viewCount ?? 0
    components.pageViews = clamp(Math.round((views / 20) * 15), 0, 15)
    components.listingsViewed = clamp(Math.round((views / 15) * 20), 0, 20)

    // Count saved listings
    const { count: saveCount } = await supabase
      .from('saved_listings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    const saves = saveCount ?? 0
    components.saves = clamp(Math.round((saves / 5) * 20), 0, 20)

    // Count listing inquiries (contact actions)
    const { count: inquiryCount } = await supabase
      .from('listing_inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    const inquiries = inquiryCount ?? 0
    components.contactActions = clamp(inquiries * 10, 0, 20)

    // Count saved searches (indicates intent depth) — unified listing_alerts.
    const searches = await countListingAlertsForUser(userId)
    components.timeDepth = clamp(searches * 5, 0, 10)

    // Return visits — check distinct dates of activity
    const { data: activityDates } = await supabase
      .from('listing_views')
      .select('viewed_at')
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .limit(100)

    if (activityDates) {
      const uniqueDays = new Set(
        activityDates.map(r => new Date(r.viewed_at as string).toISOString().slice(0, 10))
      )
      components.returnVisits = clamp(Math.round((uniqueDays.size / 5) * 15), 0, 15)
    }
  } catch (err) {
    console.error('[computeLeadScore]', err)
  }

  const score = Object.values(components).reduce((sum, v) => sum + v, 0)

  return {
    score: clamp(score, 0, 100),
    label: getLabel(score),
    components,
    computedAt: new Date().toISOString(),
  }
}

/**
 * Get the lead score for a user, computing if needed.
 * Returns null for anonymous/non-existent users.
 */
export async function getLeadScore(userId: string): Promise<LeadScore | null> {
  if (!userId) return null

  try {
    return await computeLeadScore(userId)
  } catch (err) {
    console.error('[getLeadScore]', err)
    return null
  }
}
