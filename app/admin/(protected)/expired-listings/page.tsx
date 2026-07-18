import { redirect } from 'next/navigation'

/**
 * /admin/expired-listings — retired index (consolidation 2026-07-15; retarget
 * to the unified prospecting hub 2026-07-18, admin rebuild spec 07 §3 step 3).
 *
 * The manual-research index is superseded by the unified prospecting worklist
 * at /admin/prospecting (skip-trace status, audit build, approve-and-send,
 * engagement trail, expired + FSBO in one surface). The per-listing review
 * detail at /admin/expired-listings/[key] is load-bearing (linked from
 * /admin/prospecting and /admin/cmas) and remains.
 */
export default function ExpiredListingsIndexRedirect() {
  redirect('/admin/prospecting')
}
