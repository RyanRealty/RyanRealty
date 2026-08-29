import 'server-only'
import { getUpcomingOpenHouses } from '@/lib/data'
import { addIsoDays, pacificTodayIso } from '@/app/open-houses/_v3/oh-constants'
import { publishOpenHouseBadgeLabel } from '@/lib/listing/publish-listing-card-badges'

/** listingKey → "Open Sat 10am" for every upcoming public open house this week. */
export async function loadOpenHouseBadgeLabels(
  city?: string | null,
): Promise<Record<string, string>> {
  const todayIso = pacificTodayIso()
  const rows = await getUpcomingOpenHouses({
    dateFromIso: todayIso,
    dateToIso: addIsoDays(todayIso, 6),
    todayIso,
    city: city?.trim() || undefined,
  }).catch(() => [])
  const labels: Record<string, string> = {}
  for (const row of rows) {
    if (labels[row.listing_key]) continue
    labels[row.listing_key] = publishOpenHouseBadgeLabel(row.event_date, row.start_time)
  }
  return labels
}
