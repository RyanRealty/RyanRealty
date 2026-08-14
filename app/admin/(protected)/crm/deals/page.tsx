// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * One deal entity (deal-track MERGE→tc-close). The CRM kanban was a second
 * store. Closings reads tc_deals. Person → Start a deal writes tc_deal_people.
 */
export default function CrmDealsBridge() {
  redirect('/admin/closings')
}
