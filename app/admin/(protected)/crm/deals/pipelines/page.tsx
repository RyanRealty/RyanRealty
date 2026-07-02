// @no-parity — internal admin surface, no public mockup contract

/**
 * /admin/crm/deals/pipelines — §9 Manage Pipelines (full-page navigation from
 * the ⚙ gear on the Deals sub-bar; spec docs/fub-crm-spec/10-deals-pipelines.md).
 *
 * ACCOUNT-OWNER ONLY (AC-7 #33): only the superuser (Matt) may create, rename,
 * reorder, or delete pipelines — every other role gets the access-denied page,
 * and every underlying action re-enforces the same rule server-side.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getDealPipelines } from '@/lib/data/crm/getDealPipelines'
import { ManagePipelines } from '@/components/admin/crm/deals/ManagePipelines'

export const metadata = { title: 'Manage Pipelines | CRM | Admin' }
export const dynamic = 'force-dynamic'

export default async function ManagePipelinesPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const pipelines = await getDealPipelines()

  return (
    <main>
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 text-sm text-muted-foreground">
        <Link href="/admin/crm/deals" className="hover:text-foreground">
          ← Back to Deals
        </Link>
      </div>
      <ManagePipelines pipelines={pipelines} />
    </main>
  )
}
