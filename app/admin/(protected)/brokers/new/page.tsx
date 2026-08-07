// @no-parity — internal admin surface, no public mockup contract
//
// Add broker (pattern 6 — config form) — migrated to the LOCKED admin v2
// language (design_system/admin/ADMIN_UI.md) through the shared presentation
// kit (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: getSession + getAdminRoleForEmail and the superuser
// guard `adminRole?.role !== 'superuser' → redirect('/admin/access-denied')`,
// which is the only thing standing between a non-superuser and createBroker;
// `export const dynamic = 'force-dynamic'`; the /admin/brokers back href; and
// AdminBrokerCreateForm mounted unchanged with the same className="mt-6". Every
// form field name, every client-side required check, and the createBroker
// server action are untouched — this file does not reach inside the form.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), and the <h1> page title with it (acceptance bar rule 1). The
// standing sentence became the verdict line, which names the four fields the
// mounted form itself refuses to submit without — slug, display name, title,
// Oregon license number (AdminBrokerCreateForm's own validation). "Dates are
// managed elsewhere" was dropped: the form offers no date control, so the
// sentence explained an absence.
//
// PHONE: this page renders no phone. The mounted form has a phone input that
// writes brokers.phone — the personal-cell column (ci:broker-published-phone) —
// and that is exactly as it was before this migration. Nothing was surfaced.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import AdminBrokerCreateForm from '@/app/components/admin/AdminBrokerCreateForm'
import { VerdictLine } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

export default async function AdminBrokerNewPage() {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (adminRole?.role !== 'superuser') redirect('/admin/access-denied')

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 12px' }}>
        <VerdictLine tone="ok">
          <b>New broker profile.</b> Slug, display name, title, and Oregon license number are
          required.
        </VerdictLine>
      </div>

      <div className="av2-wordrow">
        <Link
          href="/admin/brokers"
          className="av2-btn av2-btn--quiet"
          style={{ textDecoration: 'none' }}
        >
          Brokers
        </Link>
      </div>

      <AdminBrokerCreateForm className="mt-6" />
    </div>
  )
}
