// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, listCrmDeals } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { DealsBoard } from './DealsBoard'
import { NewDealButton } from './NewDealButton'

export const metadata = { title: 'Pipeline | CRM | Admin' }
export const dynamic = 'force-dynamic'

export default async function CrmDealsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  // GAP-7: scope the pipeline to the caller's own contacts (crm_deals scopes
  // through the embedded crm_people). A superuser (Matt) sees every broker's deals.
  const deals = await listCrmDeals(scopeBroker(access))

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <div className="mb-1 hidden text-sm text-muted-foreground md:block">
        <Link href="/admin/crm" className="inline-flex min-h-10 items-center hover:text-foreground">
          ← Back to CRM
        </Link>
      </div>
      <h1 className="mb-3 text-xl font-bold text-foreground md:hidden">Pipeline</h1>

      <ConsoleSection
        title="Pipeline"
        count={`${deals.length} ${deals.length === 1 ? 'deal' : 'deals'}`}
        action={<NewDealButton />}
      >
        <p className="mb-4 hidden text-sm text-muted-foreground md:block">
          Buyer and seller pipelines imported from FUB. Drag a deal to change its stage.
        </p>
        <DealsBoard deals={deals} />
      </ConsoleSection>
    </main>
  )
}
