// @no-parity — internal admin surface, no public mockup contract

/**
 * /admin/crm/deals/pipelines — §9 Manage Pipelines (full-page navigation from
 * the ⚙ gear on the Deals sub-bar; spec docs/fub-crm-spec/10-deals-pipelines.md).
 *
 * ACCOUNT-OWNER ONLY (AC-7 #33): only the superuser (Matt) may create, rename,
 * reorder, or delete pipelines — every other role gets the access-denied page,
 * and every underlying action re-enforces the same rule server-side.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only. ManagePipelines is a shared client editor outside this
 * family's fence, so it is mounted UNCHANGED — its own heading, "Add Pipeline"
 * action and reorder controls are untouched.
 *
 * Carried over verbatim: the getCrmAccess guard, the
 * `access.role !== 'superuser'` owner check, both redirect('/admin/access-denied')
 * calls, the getDealPipelines read, the metadata title, and the
 * /admin/crm/deals back href.
 *
 * Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
 * the landmark), the back link draws from the admin tokens, and the page leads
 * with one verdict line whose only claim is how many pipelines the editor below
 * is about to list.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getDealPipelines } from '@/lib/data/crm/getDealPipelines'
import { VerdictLine } from '@/components/admin/v2'
import { ManagePipelines } from '@/app/admin/(protected)/crm/deals/_components/ManagePipelines'

export const metadata = { title: 'Manage Pipelines | CRM | Admin' }
export const dynamic = 'force-dynamic'

export default async function ManagePipelinesPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const pipelines = await getDealPipelines()

  return (
    <div className="av2-scope">
      <div style={{ maxWidth: 768, margin: '0 auto', padding: '24px 16px 0' }}>
        <nav
          aria-label="Breadcrumb"
          style={{ margin: '0 0 12px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
        >
          <Link
            href="/admin/crm/deals"
            style={{ color: 'var(--a-accent)', textDecoration: 'none' }}
          >
            ← Back to Deals
          </Link>
        </nav>

        {/* The only claim: the length of the array handed to ManagePipelines. */}
        <VerdictLine tone={pipelines.length ? 'ok' : 'attention'}>
          <b>
            {pipelines.length.toLocaleString('en-US')}{' '}
            {pipelines.length === 1 ? 'pipeline' : 'pipelines'}.
          </b>
        </VerdictLine>
      </div>

      <ManagePipelines pipelines={pipelines} />
    </div>
  )
}
