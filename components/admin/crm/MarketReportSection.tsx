/**
 * MarketReportSection — loads one contact's market-report card and renders it
 * (components/admin/crm/MarketReportCard.tsx). Mounted on the person page
 * (/admin/people/[id], inside the in-scope fold) and in the tools page's
 * "Market reports" sheet, so a broker sees the same card from both doors.
 *
 * Async server component: stream it under its own Suspense.
 */
import { getMarketReportCard } from '@/lib/data/crm/getMarketReportCard'
import { MarketReportCard } from '@/components/admin/crm/MarketReportCard'

export async function MarketReportSection({ personId, returnTo }: { personId: number; returnTo: string }) {
  const card = await getMarketReportCard(personId)
  return <MarketReportCard personId={personId} returnTo={returnTo} card={card} />
}
