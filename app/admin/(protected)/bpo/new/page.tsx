// @no-parity — internal admin tool, no public mockup contract.
//
// /admin/bpo/new — manual "Build Broker Price Opinion" form. P11C: migrated to
// the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md) through the
// shared presentation kit (@/components/admin/v2). Presentation only. This is
// a CONFIG FORM (ADMIN_UI §3 pattern 6): single column, label-above, one lane.
//
// Carried over verbatim: getSession() → getAdminRoleForEmail(), both
// /admin/access-denied redirects (no role, and the report_viewer role), the
// listActiveBrokersForCma() read and the { slug, displayName } mapping fed to
// the form, the BuildBpoForm mount (which still runs the deterministic builder
// on submit and lands on the new draft's review page), the /admin/bpo href,
// the "Subject property" section heading, and the description of what the
// builder does.
//
// Shape changed, data did not: the page title is gone (the nav names this page
// — acceptance bar rule 1), the "Back to opinions" shadcn button became the
// breadcrumb link to the same href, and the console panel became a v2 section
// head.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { listActiveBrokersForCma } from '@/lib/data'
import { SectionHead } from '@/components/admin/v2'
import { BuildBpoForm } from '@/components/admin/bpo/BuildBpoForm'

export const dynamic = 'force-dynamic'

export default async function AdminBpoNewPage() {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!adminRole) redirect('/admin/access-denied')
  if (adminRole.role === 'report_viewer') redirect('/admin/access-denied')

  const brokerRows = await listActiveBrokersForCma()
  const brokers = brokerRows.map((b) => ({
    slug: String(b.slug),
    displayName: String(b.display_name ?? b.slug),
  }))

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <nav style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)' }}>
        <Link href="/admin/bpo" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Price opinions
        </Link>
      </nav>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 4px' }}>
        The builder pulls the subject from the MLS record, reconstructs its full listing history,
        selects closed comps, adjusts for time and size, and reconciles to a single opinion of value.
        It lands as a draft for your review. Nothing sends.
      </p>

      <SectionHead>Subject property</SectionHead>
      <BuildBpoForm brokers={brokers} />
    </div>
  )
}
