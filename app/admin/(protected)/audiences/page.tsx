// @no-parity — internal admin surface, no public mockup contract
// Audiences (P9 roll:remaining-families, IA lock 2026-08-05): manage what we
// send to whom on cadence — market-report subscriptions, listing alerts, the
// newsletter list, segments, and cohort compose, unified behind ONE home
// (they were three unrelated doors). Counts are live; each door opens the
// existing machinery until it migrates.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getAudienceCounts } from '@/lib/data/audiences/counts'
import { VerdictLine } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

function fig(n: number | null): string {
  return n == null ? 'unreadable' : n.toLocaleString('en-US')
}

export default async function AudiencesPage() {
  await requireAdminPage('audiences.view')
  const counts = await getAudienceCounts()
  const anyUnreadable =
    counts.marketReportSubs == null || counts.listingAlerts == null || counts.newsletterSubscribers == null

  const doors: Array<{ name: string; figure: string; question: string; href: string }> = [
    {
      name: 'Market report subscriptions',
      figure: fig(counts.marketReportSubs),
      question: 'Who gets a monthly market report, for which place?',
      href: '/admin/crm/settings/market-reports',
    },
    {
      name: 'Listing alerts',
      figure: fig(counts.listingAlerts),
      question: 'Who gets told when matching listings move?',
      href: '/admin/crm/subscriptions',
    },
    {
      name: 'Newsletter list',
      figure: fig(counts.newsletterSubscribers),
      question: 'Who gets the newsletter?',
      href: '/admin/newsletters/subscribers',
    },
    {
      name: 'Segments',
      figure: '',
      question: 'Reusable people filters for sends and lists.',
      href: '/admin/crm/settings/segments',
    },
    {
      name: 'Compose to a cohort',
      figure: '',
      question: 'One-off email to a filtered audience.',
      href: '/admin/email/compose',
    },
    {
      name: 'Meta custom audiences',
      figure: '',
      question: 'CRM + West Side list refresh. Spend stays Matt-gated.',
      href: '/admin/analytics/meta-health',
    },
  ]

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={anyUnreadable ? 'attention' : 'ok'}>
          {anyUnreadable ? (
            <>
              <b>A count is unreadable.</b> Do not trust the zeros below until it reads.
            </>
          ) : (
            <>
              <b>
                {fig(
                  (counts.marketReportSubs ?? 0) + (counts.listingAlerts ?? 0) + (counts.newsletterSubscribers ?? 0),
                )}{' '}
                active subscriptions
              </b>{' '}
              across the three cadence rails.
            </>
          )}
        </VerdictLine>
      </div>

      <h2 className="av2-lane-head">The rails</h2>
      <ul className="av2-quietlist">
        {doors.map((d) => (
          <li key={d.href} className="av2-quiet">
            <Link href={d.href} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)', minWidth: 220 }}>
              {d.name}
            </Link>
            <span style={{ color: 'var(--a-text-2)' }}>{d.question}</span>
            {d.figure ? <span className="av2-quiet__fig">{d.figure}</span> : null}
          </li>
        ))}
      </ul>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Per-person subscriptions live on the person page. Suppression and the block list live in{' '}
        <Link href="/admin/crm/settings/suppression" style={{ color: 'var(--a-accent)' }}>
          Settings → Compliance
        </Link>
        .
      </p>
    </div>
  )
}
