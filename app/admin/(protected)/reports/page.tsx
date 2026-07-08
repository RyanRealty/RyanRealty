import { redirect } from 'next/navigation'

/**
 * /admin/reports — MERGED into the Performance hub at /admin/analytics
 * (admin consolidation 2026-07-07, docs/plans/ADMIN_CONSOLIDATION_AUDIT.md).
 *
 * The two launchpads (Reports + Analytics) served the same job. The report
 * catalog, the weekly market report tool, and the city/period builder all
 * live on the hub now. The /admin/reports/* sub-reports keep their routes.
 */
export default function AdminReportsRedirect() {
  redirect('/admin/analytics')
}
