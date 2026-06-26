// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmDeal } from '@/lib/data/crm/getCrmDeal'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { DealHeader } from './DealHeader'
import { DealMilestones } from './DealMilestones'
import { DealCommission } from './DealCommission'
import { DealFiles } from './DealFiles'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deal = await getCrmDeal(Number(id))
  return { title: deal?.name ?? `Deal #${id}` + ' | CRM | Admin' }
}

function fmt(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const numId = Number(id)
  if (!numId) notFound()

  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const deal = await getCrmDeal(numId)
  if (!deal) notFound()

  const dealLabel = deal.name ?? deal.person?.name ?? `Deal #${deal.id}`

  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-6 sm:py-8">
      {/* breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="hover:text-foreground">CRM</Link>
        <span>›</span>
        <Link href="/admin/crm/deals" className="hover:text-foreground">Pipeline</Link>
        <span>›</span>
        <span className="text-foreground">{dealLabel}</span>
      </nav>

      <div className="space-y-4">
        {/* ── Header: name / address / price / close date / description ─── */}
        <ConsoleSection title="Deal">
          <div className="px-4 pb-4 pt-1 sm:px-5">
            <DealHeader
              dealId={deal.id}
              initialName={deal.name}
              initialAddress={deal.property_address}
              initialValue={deal.value}
              initialCloseDate={deal.close_date}
              initialDescription={deal.description}
              stage={deal.stage}
              pipeline={deal.pipeline}
            />
          </div>
        </ConsoleSection>

        {/* ── Milestones ─────────────────────────────────────────────────── */}
        <ConsoleSection title="Milestone dates">
          <div className="px-4 pb-5 pt-1 sm:px-5">
            <DealMilestones
              dealId={deal.id}
              initial={{
                mutual_acceptance: deal.mutual_acceptance,
                earnest_money_due: deal.earnest_money_due,
                due_diligence: deal.due_diligence,
                final_walkthrough: deal.final_walkthrough,
                possession: deal.possession,
              }}
            />
          </div>
        </ConsoleSection>

        {/* ── Commission + splits ─────────────────────────────────────────── */}
        <ConsoleSection title="Commission">
          <div className="px-4 pb-5 pt-1 sm:px-5">
            <DealCommission
              dealId={deal.id}
              initialCommissionDollars={deal.commission_dollars}
              initialCommissionPercent={deal.commission_percent}
              splits={deal.splits}
            />
          </div>
        </ConsoleSection>

        {/* ── People ─────────────────────────────────────────────────────── */}
        <ConsoleSection title="People">
          <div className="px-4 pb-4 pt-1 sm:px-5">
            {deal.person ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {deal.person.name ?? 'Unnamed contact'}
                  </p>
                  {deal.person.assigned_broker ? (
                    <p className="text-xs text-muted-foreground capitalize">
                      {deal.person.assigned_broker}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/admin/crm/${deal.person_id}`}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  View contact →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No contact linked.</p>
            )}
          </div>
        </ConsoleSection>

        {/* ── Files ──────────────────────────────────────────────────────── */}
        <ConsoleSection title="Files" count={deal.files.length ? `${deal.files.length}` : undefined}>
          <div className="px-4 pb-5 pt-1 sm:px-5">
            <DealFiles dealId={deal.id} files={deal.files} />
          </div>
        </ConsoleSection>

        {/* ── Meta strip ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-1 text-xs text-muted-foreground">
          <span>ID {deal.id}</span>
          {deal.entered_stage_at ? (
            <span>Stage since {fmt(deal.entered_stage_at.slice(0, 10))}</span>
          ) : null}
          {deal.listing_key ? <span>MLS {deal.listing_key}</span> : null}
          {deal.status ? <span>Status: {deal.status}</span> : null}
        </div>
      </div>
    </main>
  )
}
