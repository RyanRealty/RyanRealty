import { redirect } from 'next/navigation'

/**
 * /admin/expired-listings — retired index (consolidation 2026-07-15).
 *
 * The manual-research index is superseded by the consolidated Expireds
 * dashboard at /admin/expireds (skip-trace status, audit build, approve-and-
 * send, engagement trail). The per-listing review detail at
 * /admin/expired-listings/[key] is load-bearing (linked from /admin/expireds
 * and /admin/cmas) and remains.
 */
export default function ExpiredListingsIndexRedirect() {
  redirect('/admin/expireds')
}
