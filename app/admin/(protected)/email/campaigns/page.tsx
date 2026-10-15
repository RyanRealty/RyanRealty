// @no-parity — admin-internal redirect, no public mockup contract.
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'
import { EMAIL_CAMPAIGNS_REDIRECT } from '@/lib/admin/queue-defaults'

export const dynamic = 'force-dynamic'

/**
 * Retired 2026-10-14 (Matt audit): this screen duplicated Audiences /
 * Newsletters / Compose and shipped an empty engineering leftover. The Reach
 * destination is Audiences.
 */
export default function EmailCampaignsBridge() {
  redirect(EMAIL_CAMPAIGNS_REDIRECT)
}
