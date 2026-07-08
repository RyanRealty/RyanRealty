// @no-parity — pure redirect

/** /admin/spark-status moved under System health (consolidation 2026-07-07). */

import { redirect } from 'next/navigation'

export default function SparkStatusRedirect() {
  redirect('/admin/sync/spark')
}
