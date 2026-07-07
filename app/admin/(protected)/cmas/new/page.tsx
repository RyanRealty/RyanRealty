// @no-parity — internal admin tool, no public mockup contract.
/**
 * /admin/cmas/new — manual "Build CMA" form. Address or MLS lookup, client
 * info, broker select. The deterministic builder runs on submit and the
 * browser lands on the review page for the new draft.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { listActiveBrokersForCma } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { BuildCmaForm } from '@/components/admin/cma/BuildCmaForm'

export const dynamic = 'force-dynamic'

export default async function AdminCmaNewPage() {
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
          <h1 className="text-2xl font-semibold text-foreground">Build a CMA</h1>
          <p className="text-sm text-muted-foreground">
            The builder pulls the subject from the MLS record, selects closed comps, prices with three
            methods, and renders the full report. It lands as a draft for your review. Nothing sends.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/admin/cmas">Back to CMAs</Link>
        </Button>
      </header>

      <ConsoleSection title="Subject and client">
        <BuildCmaForm brokers={brokers} />
      </ConsoleSection>
    </div>
  )
}
