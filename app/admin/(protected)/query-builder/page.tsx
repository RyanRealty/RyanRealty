import { redirect } from 'next/navigation'

/**
 * /admin/query-builder — MERGED into the listings browser
 * (admin consolidation 2026-07-07, docs/plans/ADMIN_CONSOLIDATION_AUDIT.md).
 *
 * The ad-hoc query + CSV export panel lives at the bottom of /admin/listings
 * now (ListingsCsvExport). One listings surface, one place to export.
 */
export default function AdminQueryBuilderRedirect() {
  redirect('/admin/listings')
}
