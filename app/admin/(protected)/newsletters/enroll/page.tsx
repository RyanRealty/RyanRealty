// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { newsletterSubscriberCounts } from '@/lib/data'
import { KpiStrip } from '@/components/console/KpiStrip'
import { ConsoleSection } from '@/components/console/ConsoleSection'
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
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Link href="/admin/newsletters" className="hover:underline">Newsletter</Link> · Cohort enrollment
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Enroll the decided audience</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Past clients, leads with an email open or click in the last 180 days, and westside
          cohort homeowners. Every address passes four checks before it enrolls: has an email,
          not a realtor, not suppressed, and not already on the list. A prior unsubscribe is
          never overridden. Enrollment sends nothing — issues still require your approval.
        </p>
      </header>

      <KpiStrip
        items={[
          { label: 'Active subscribers', value: counts.active.toLocaleString('en-US') },
          { label: 'Unsubscribed', value: counts.unsubscribed.toLocaleString('en-US') },
          { label: 'Total on file', value: counts.total.toLocaleString('en-US') },
        ]}
      />

      <ConsoleSection title="Run enrollment">
        <EnrollClient />
      </ConsoleSection>
    </div>
  )
}
