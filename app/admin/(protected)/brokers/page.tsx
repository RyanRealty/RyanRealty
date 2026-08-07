// @no-parity — internal admin surface, no public mockup contract
//
// Brokers roster — migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the shared presentation kit
// (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: the getSession + getAdminRoleForEmail guard chain and
// all three redirects (no admin role · report_viewer · broker with no brokerId),
// the own-broker scoping (a broker sees only getBrokerById(adminRole.brokerId);
// everyone else gets getBrokersForAdmin()), that DAL's sort_order-then-
// display_name order, the superuser-only gating of both actions and of the
// second prose sentence, `export const dynamic = 'force-dynamic'`, and every
// href: /admin/brokers/new, /admin/crm/settings/team, /team, /team/<slug>, and
// /admin/brokers/edit?id=<encodeURIComponent(id)>.
//
// Shape changed, data did not. Four things moved:
//   1. The page rendered its own <main> INSIDE ConsoleShell's <main> — two
//      landmarks on one screen. The shell owns the landmark; this file renders
//      an av2-scope div, which is styling, not a landmark.
//   2. At 375px the page scrolled sideways (scrollWidth 395 > clientWidth 375).
//      The widest offender was the superuser action row, a non-wrapping
//      `flex items-center gap-2` holding two buttons. It is now av2-wordrow,
//      which wraps.
//   3. The same six fields were written twice — a md:hidden Card list for
//      phones and a hidden md:block shadcn Table for desktop. One ReportGrid
//      replaces both: one block per broker at 375px, a column grid at 720px,
//      and any sideways overflow lives inside the grid's own scroll box.
//   4. The standalone <h1> is gone (acceptance bar rule 1 — the nav names the
//      page), and the Actions cell folded into the broker's name, which now
//      carries the same /admin/brokers/edit?id= href (rule 3 — every entity
//      name is a door).
//
// PHONE: this page rendered no phone before and renders none now. brokers.phone
// is a personal cell for two of the three brokers (ci:broker-published-phone);
// brokers.twilio_number is the publishable line. Neither is surfaced here.
// SLUG: the Slug column is brokers.slug, the full web slug that /team/<slug>
// resolves — not brokers.crm_slug, the short CRM key. Unchanged.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getBrokerById, getBrokersForAdmin } from '@/app/actions/brokers'
import {
  ReportGrid,
  SectionHead,
  StateWord,
  VerdictLine,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

const COLUMNS: ReportColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'title', label: 'Title' },
  { key: 'slug', label: 'Slug' },
  { key: 'status', label: 'Status' },
  { key: 'profile', label: 'Profile' },
]

export default async function AdminBrokersPage() {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!adminRole) redirect('/admin/access-denied')
  if (adminRole.role === 'report_viewer') redirect('/admin/access-denied')
  if (adminRole.role === 'broker' && !adminRole.brokerId) redirect('/admin/access-denied')

  const ownBroker = adminRole.role === 'broker' && adminRole.brokerId
    ? await getBrokerById(adminRole.brokerId)
    : null
  const brokers = ownBroker ? [ownBroker] : await getBrokersForAdmin()

  const isSuperuser = adminRole.role === 'superuser'
  const activeCount = brokers.filter((b) => b.is_active).length

  const rows: ReportGridRow[] = brokers.map((b) => ({
    key: b.id,
    cells: [
      <Link
        key="name"
        href={`/admin/brokers/edit?id=${encodeURIComponent(b.id)}`}
        style={{ color: 'var(--a-accent)' }}
      >
        {b.display_name}
      </Link>,
      b.title,
      <span key="slug" style={{ overflowWrap: 'anywhere' }}>
        {b.slug}
      </span>,
      b.is_active ? (
        <StateWord key="status" state="ok">
          Active
        </StateWord>
      ) : (
        <StateWord key="status" state="waiting">
          Inactive
        </StateWord>
      ),
      b.is_active ? (
        <Link
          key="profile"
          href={`/team/${b.slug}`}
          target="_blank"
          rel="noopener"
          style={{ color: 'var(--a-accent)' }}
        >
          View
        </Link>
      ) : (
        <span key="profile" style={{ color: 'var(--a-text-2)' }}>
          —
        </span>
      ),
    ],
  }))

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 12px' }}>
        <VerdictLine tone={brokers.length === 0 ? 'attention' : 'ok'}>
          {brokers.length === 0 ? (
            <>
              <b>No broker profiles.</b> Nothing to show here yet.
            </>
          ) : (
            <>
              <b>
                {brokers.length} broker {brokers.length === 1 ? 'profile' : 'profiles'}.
              </b>{' '}
              {activeCount === brokers.length
                ? brokers.length === 1
                  ? 'Active.'
                  : 'All active.'
                : `${activeCount} active, ${brokers.length - activeCount} inactive.`}
            </>
          )}
        </VerdictLine>
      </div>

      {isSuperuser ? (
        <div className="av2-wordrow" style={{ margin: '0 0 12px' }}>
          <Link href="/admin/brokers/new" className="av2-btn" style={{ textDecoration: 'none' }}>
            Add broker
          </Link>
          <Link
            href="/admin/crm/settings/team"
            className="av2-btn av2-btn--quiet"
            style={{ textDecoration: 'none' }}
          >
            Roles &amp; permissions
          </Link>
        </div>
      ) : null}

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 4px' }}>
        Team members appear on the public{' '}
        <Link href="/team" style={{ color: 'var(--a-accent)' }}>
          /team
        </Link>{' '}
        page. Required: display name, title, Oregon license number.
        {isSuperuser ? (
          <>
            {' '}
            Admin access and CRM permissions are managed on the{' '}
            <Link href="/admin/crm/settings/team" style={{ color: 'var(--a-accent)' }}>
              team page
            </Link>
            .
          </>
        ) : null}
      </p>

      <SectionHead>Roster</SectionHead>
      <ReportGrid
        label="Broker roster"
        columns={COLUMNS}
        template="minmax(150px, 1.4fr) minmax(120px, 1.2fr) minmax(120px, 1.2fr) minmax(88px, 0.6fr) minmax(64px, 0.5fr)"
        minWidth={620}
        rows={rows}
        empty={
          isSuperuser ? (
            <>
              No brokers yet.{' '}
              <Link href="/admin/brokers/new" style={{ color: 'var(--a-accent)' }}>
                Add broker
              </Link>{' '}
              to create one — display name, slug, title, and Oregon license number are required.
            </>
          ) : (
            <>No brokers yet. A superuser creates the first profile.</>
          )
        }
      />
    </div>
  )
}
