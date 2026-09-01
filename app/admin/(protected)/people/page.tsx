// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * People-list fold (Matt lock 2026-09-01, decisions.md "UX CONSOLIDATION
 * LOCKS" #2): one list surface — /admin/crm survives. The real hop is the
 * next.config.ts redirects() entry (it runs above the streamed admin shell
 * and carries ?q= across); this SYNC body is the belt for any render path
 * that slips past it. Person ENTITY pages stay under /admin/people/[id]*.
 */
export default function PeopleListBridge() {
  redirect('/admin/crm')
}
