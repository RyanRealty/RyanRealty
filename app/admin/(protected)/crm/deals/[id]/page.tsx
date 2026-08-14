// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * crm_deals ids are not tc_deal keys. Bookmarks land on Closings.
 * Open the file from the person or the Closings board.
 */
export default function CrmDealEntityBridge() {
  redirect('/admin/closings')
}
