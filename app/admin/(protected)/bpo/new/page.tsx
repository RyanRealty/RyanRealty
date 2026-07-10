// @no-parity — internal admin tool, no public mockup contract.
/**
 * /admin/bpo/new — manual "Build Broker Price Opinion" form. Address or MLS,
 * purpose, signing broker. The deterministic builder runs on submit and the
 * browser lands on the review page for the new draft.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { listActiveBrokersForCma } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { ConsoleSection } from '@/components/console/ConsoleSection'
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Build a broker price opinion</h1>
          <p className="text-sm text-muted-foreground">
            The builder pulls the subject from the MLS record, reconstructs its full listing history, selects closed
            comps, adjusts for time and size, and reconciles to a single opinion of value. It lands as a draft for your
            review. Nothing sends.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/admin/bpo">Back to opinions</Link>
        </Button>
      </header>

      <ConsoleSection title="Subject property">
        <BuildBpoForm brokers={brokers} />
      </ConsoleSection>
    </div>
  )
}
