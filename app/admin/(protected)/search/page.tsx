// @no-parity — pure redirect, no UI (admin route, not a mockup surface)
import { redirect } from 'next/navigation'

/**
 * Consolidation 2026-07-07: the standalone admin search page duplicated the
 * listings browser (address/MLS search) and the command palette (brokers,
 * users). The listings browser is the destination now.
 */
export default async function AdminSearchRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const term = q.trim()
  redirect(term ? `/admin/listings?search=${encodeURIComponent(term)}` : '/admin/listings')
}
