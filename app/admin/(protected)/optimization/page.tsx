// @no-parity — pure redirect

/** /admin/optimization moved under Operations (consolidation 2026-07-07). */

import { redirect } from 'next/navigation'

export default function OptimizationRedirect() {
  redirect('/admin/operations/optimization')
}
