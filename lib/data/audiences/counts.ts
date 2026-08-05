import 'server-only'

/**
 * Audiences counts (P9 roll:remaining-families, IA lock 2026-08-05): who we
 * send to on cadence — market-report subscriptions, listing alerts, newsletter
 * list — as honest counts for the one Audiences home. Unreadable ≠ 0 (§0):
 * a failed count reports null, never a healthy-looking zero.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface AudienceCounts {
  marketReportSubs: number | null
  listingAlerts: number | null
  newsletterSubscribers: number | null
}

export async function getAudienceCounts(): Promise<AudienceCounts> {
  const sb = createServiceClient()
  const [mr, la, nl] = await Promise.all([
    sb.from('crm_report_subscriptions').select('id', { count: 'exact', head: true }).eq('is_active', true),
    sb.from('listing_alerts').select('id', { count: 'exact', head: true }).eq('is_active', true),
    sb.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])
  const count = (r: { count: number | null; error: { message: string } | null }, label: string) => {
    if (r.error) {
      console.error(`[audiences] ${label} count failed:`, r.error.message)
      return null
    }
    return r.count ?? null
  }
  return {
    marketReportSubs: count(mr, 'crm_report_subscriptions'),
    listingAlerts: count(la, 'listing_alerts'),
    newsletterSubscribers: count(nl, 'newsletter_subscribers'),
  }
}
