// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Pipeline config died with the standalone CRM deals board (cut-list §1). */
export default function CrmDealPipelinesBridge() {
  redirect('/admin/closings')
}
