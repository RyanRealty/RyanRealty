// @no-parity — internal admin surface, no public mockup contract
//
// Cohort enrollment — P11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the shared presentation kit
// (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: the requireAdminPage('content.marketing') guard, the
// superuser-only redirect to /admin/access-denied, `maxDuration = 300`, the
// newsletterSubscriberCounts() read and its three figures, the EnrollClient
// mount, the /admin/newsletters href, and the eligibility copy — the four
// checks, the never-override-an-unsubscribe rule, and "enrollment sends
// nothing" are the operator's safety contract and are unchanged word for word.
//
// Shape changed, data did not: the KPI tile board became the family's
// typographic numbers strip, the console panel became a v2 section head, and
// the page title is gone — the nav names this page.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { newsletterSubscriberCounts } from '@/lib/data'
import { ReportNumbers, SectionHead, VerdictLine } from '@/components/admin/v2'
import { EnrollClient } from './EnrollClient'

export const metadata = { title: 'Cohort enrollment | Newsletter | Admin' }
export const dynamic = 'force-dynamic'
// The dry run walks three cohorts and runs the fail-closed per-address
// suppression check — give the server actions invoked from this route room to
// finish on a large book instead of dying at the default action timeout.
export const maxDuration = 300

/**
 * Admin runner for the consent-respecting cohort enrollment (past clients +
 * engaged leads + westside cohort — Matt's YES 2026-07-21). Dry run first,
 * then a typed-confirmation real run. Enrollment only writes subscriber rows.
 * No issue is sent from here — sends stay in the approve-then-drain queue.
 * Superuser-only: same posture as the other bulk newsletter tools.
 */
export default async function NewsletterEnrollPage() {
  const ctx = await requireAdminPage('content.marketing')
  // Company-wide reach: superuser only (same posture as the other bulk
  // newsletter tools). The server action re-enforces this independently.
  if (ctx.role !== 'superuser') redirect('/admin/access-denied')

  const counts = await newsletterSubscriberCounts()

  return (
    <div className="av2-scope" style={{ maxWidth: 880, margin: '0 auto', padding: 16 }}>
      <nav style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)' }}>
        <Link href="/admin/newsletters" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Newsletter
        </Link>
      </nav>

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone="ok">
          <b>{counts.active.toLocaleString('en-US')} active subscribers on the list.</b> Enrollment
          adds to it and sends nothing.
        </VerdictLine>
      </div>

      <ReportNumbers
        items={[
          { key: 'active', label: 'Active subscribers', value: counts.active.toLocaleString('en-US') },
          { key: 'unsubscribed', label: 'Unsubscribed', value: counts.unsubscribed.toLocaleString('en-US') },
          { key: 'total', label: 'Total on file', value: counts.total.toLocaleString('en-US') },
        ]}
      />

      <SectionHead>Who enrolls</SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 4px' }}>
        Past clients, leads with an email open or click in the last 180 days, and westside cohort
        homeowners. Every address passes four checks before it enrolls: has an email, not a realtor,
        not suppressed, and not already on the list. A prior unsubscribe is never overridden.
        Enrollment sends nothing — issues still require your approval.
      </p>

      <SectionHead>Run enrollment</SectionHead>
      <EnrollClient />
    </div>
  )
}
