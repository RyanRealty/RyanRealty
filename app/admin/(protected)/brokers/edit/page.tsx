// @no-parity — internal admin surface, no public mockup contract
//
// Edit broker (pattern 5 identity header over pattern 6 — config form) —
// migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md)
// through the shared presentation kit (@/components/admin/v2). Presentation
// only.
//
// Carried over verbatim: getSession + getAdminRoleForEmail, the no-role and
// report_viewer redirects, the `?id=` search param and its notFound() on a
// miss, the own-profile guard (`role === 'broker' && brokerId !== id →
// redirect('/admin/access-denied')`) that keeps one broker out of another's
// record, the parallel getBrokerById + listBrokerGeneratedMedia read and the
// notFound() when the broker row is missing, `export const dynamic =
// 'force-dynamic'`, the /admin/brokers back href, and AdminBrokerForm mounted
// unchanged with the same broker / initialGeneratedMedia props and
// className="mt-6". Every field name and every write path inside that form —
// updateBroker, deleteBroker, the headshot and video studios — is untouched.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark). The generic "Edit broker" <h1> became the identity line this
// entity page should have led with — the broker's own name and title, with
// their active state, which is the is_active control the mounted form carries.
// The slug sentence is unchanged in wording; it is restyled onto the admin
// tokens instead of the shadcn `bg-muted` chip.
//
// PHONE: this page renders no phone. brokers.phone is a personal cell for two
// of the three brokers (ci:broker-published-phone); brokers.twilio_number is
// the publishable line. The mounted form's own phone inputs are exactly as they
// were. SLUG: the line prints brokers.slug, the full web slug behind
// /team/<slug> — not brokers.crm_slug, the short CRM key. Unchanged.
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getBrokerById } from '@/app/actions/brokers'
import { listBrokerGeneratedMedia } from '@/app/actions/broker-generated-media'
import AdminBrokerForm from '@/app/components/admin/AdminBrokerForm'
import { VerdictLine } from '@/components/admin/v2'

type PageProps = { searchParams: Promise<{ id?: string }> }

export const dynamic = 'force-dynamic'

export default async function AdminBrokerEditPage({ searchParams }: PageProps) {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!adminRole) redirect('/admin/access-denied')
  if (adminRole.role === 'report_viewer') redirect('/admin/access-denied')

  const { id } = await searchParams
  if (!id) notFound()

  // A broker may only edit their own profile; superusers/admins may edit any.
  if (adminRole.role === 'broker' && adminRole.brokerId !== id) {
    redirect('/admin/access-denied')
  }

  const [broker, generatedMedia] = await Promise.all([
    getBrokerById(id),
    listBrokerGeneratedMedia(id),
  ])
  if (!broker) notFound()

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 12px' }}>
        <VerdictLine tone={broker.is_active ? 'ok' : 'attention'}>
          <b>{broker.display_name}</b> — {broker.title}.{' '}
          {broker.is_active ? 'Active.' : 'Inactive.'}
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

      <p
        style={{
          fontSize: 'var(--a-text-sm)',
          color: 'var(--a-text-2)',
          margin: '12px 0 0',
          overflowWrap: 'anywhere',
        }}
      >
        Slug:{' '}
        <code
          style={{
            fontFamily: 'var(--a-font-mono)',
            background: 'var(--a-inset)',
            borderRadius: 'var(--a-r-sm)',
            padding: '1px 5px',
          }}
        >
          {broker.slug}
        </code>{' '}
        (used in URL /team/{broker.slug})
      </p>

      <AdminBrokerForm broker={broker} initialGeneratedMedia={generatedMedia} className="mt-6" />
    </div>
  )
}
