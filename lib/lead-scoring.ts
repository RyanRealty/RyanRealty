/**
 * Lead scoring engine. Points from user_activities; weekly decay; tiers.
 * Step 18.
 */

export const LEAD_TIERS = ['cold', 'warm', 'hot', 'very_hot'] as const
export type LeadTier = (typeof LEAD_TIERS)[number]

export const POINTS: Record<string, number> = {
  account_creation: 10,
  property_view: 1,
  property_save: 5,
  saved_search_created: 10,
  cma_downloaded: 25,
  tour_requested: 30,
  open_house_rsvp: 20,
  contact_form_submitted: 15,
  comparison_created: 10,
  return_visit: 15,
  bonus_5_views_session: 5,
  bonus_same_listing_3_views: 10,
  bonus_saved_5_plus: 10,
  price_drop_email_opened: 3,
  price_drop_email_clicked: 5,
  time_on_site_5_min: 3,
  time_on_site_15_min: 5,
}

const WEEKLY_DECAY = 0.2 // 20% per week

export function scoreToTier(score: number): LeadTier {
  if (score >= 101) return 'very_hot'
  if (score >= 51) return 'hot'
  if (score >= 21) return 'warm'
  return 'cold'
}

export function applyDecay(score: number, weeksSinceBase: number): number {
  if (weeksSinceBase <= 0) return score
  const decay = Math.pow(1 - WEEKLY_DECAY, weeksSinceBase)
  return Math.round(score * decay)
}

export function activityTypeToPoints(activityType: string): number {
  return POINTS[activityType] ?? 0
}
