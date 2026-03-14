/**
 * Lead conversion workflows: silent browser, CMA followup, active saver, price watcher, seller curious, ghosted reengagement.
 * Step 18.
 */

import { inngest } from '@/lib/inngest'
import { createClient } from '@supabase/supabase-js'
import { pushToFub } from '@/lib/fub'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

export const leadWorkflows = [
  inngest.createFunction(
    { id: 'leads/silent-browser-to-registered', name: 'Silent browser to registered', retries: 2 },
    { event: 'leads/silent-browser-to-registered' },
    async ({ data }: { data: { userId: string; email: string; firstName?: string; lastName?: string } }) => {
      await pushToFub('Registration', { email: data.email, firstName: data.firstName, lastName: data.lastName }, { tags: ['high-engagement-new-lead'] })
      return { ok: true }
    }
  ),
  inngest.createFunction(
    { id: 'leads/cma-downloader-followup', name: 'CMA downloader follow-up', retries: 2 },
    { event: 'leads/cma-downloader-followup' },
    async ({ data }: { data: { userId: string; email: string; address?: string } }) => {
      await pushToFub('General Inquiry', { email: data.email }, { message: `Follow up on CMA download for ${data.address ?? 'property'}`, tags: ['cma-followup'] })
      return { ok: true }
    }
  ),
  inngest.createFunction(
    { id: 'leads/active-saver-detection', name: 'Active saver detection', retries: 2 },
    { event: 'leads/active-saver-detection' },
    async ({ data }: { data: { userId: string; email: string; communities?: string[]; priceMin?: number; priceMax?: number } }) => {
      await pushToFub('Property Saved', { email: data.email }, { tags: ['active-saver'], preferred_communities: data.communities?.join(', '), listingUrls: [] })
      return { ok: true }
    }
  ),
  inngest.createFunction(
    { id: 'leads/price-watcher-detection', name: 'Price watcher detection', retries: 2 },
    { event: 'leads/price-watcher-detection' },
    async ({ data }: { data: { userId: string; email: string; listingKey: string; listingUrl?: string } }) => {
      await pushToFub('Property Viewed', { email: data.email }, { tags: ['price-watcher'], listingUrl: data.listingUrl })
      return { ok: true }
    }
  ),
  inngest.createFunction(
    { id: 'leads/seller-curious-detection', name: 'Seller curious detection', retries: 2 },
    { event: 'leads/seller-curious-detection' },
    async ({ data }: { data: { userId: string; email: string } }) => {
      await pushToFub('General Inquiry', { email: data.email, customFields: { is_seller_curious: true } }, { tags: ['seller-curious'] })
      return { ok: true }
    }
  ),
  inngest.createFunction(
    { id: 'leads/ghosted-lead-reengagement', name: 'Ghosted lead reengagement', retries: 2 },
    { event: 'leads/ghosted-lead-reengagement' },
    async ({ data }: { data: { userId: string; email: string; name?: string } }) => {
      await pushToFub('General Inquiry', { email: data.email }, { message: `Re-engage ${data.name ?? 'lead'} — no activity for 14 days`, tags: ['ghosted-reengagement'] })
      return { ok: true }
    }
  ),
]
