// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, listCrmDeals } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { ConsoleSection } from '@/components/console/ConsoleSection'

export const metadata = { title: 'Pipeline | CRM | Admin' }
export const dynamic = 'force-dynamic'

function money(v: number | null): string {
  if (!v) return '—'
  return '$' + Math.round(v).toLocaleString('en-US')
}

export default async function CrmDealsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  // GAP-7: scope the pipeline to the caller's own contacts (crm_deals has no
  // assigned_broker, so the scope routes through the embedded crm_people).
  const deals = await listCrmDeals(scopeBroker(access))

  const pipelines = [...new Set(deals.map((d) => d.pipeline ?? 'Other'))]

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <div className="mb-1 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="inline-flex min-h-10 items-center hover:text-foreground">← Back to CRM</Link>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pre-contract pipeline imported from FUB. Vault remains the system of record once a transaction opens.
      </p>

      {pipelines.map((pipe) => {
        const rows = deals.filter((d) => (d.pipeline ?? 'Other') === pipe)
        const stages = [...new Set(rows.map((d) => d.stage ?? 'No stage'))]
        return (
          <section key={pipe} className="mt-8">
            <h2 className="text-lg font-semibold text-foreground">{pipe} <span className="font-normal text-muted-foreground">({rows.length})</span></h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {stages.map((stage) => (
                <ConsoleSection key={stage} title={stage}>
                  <div className="space-y-2">
                    {(() => {
                      const stageRows = rows.filter((d) => (d.stage ?? 'No stage') === stage)
                      const STAGE_PREVIEW = 8
                      const preview = stageRows.slice(0, STAGE_PREVIEW)
                      const rest = stageRows.slice(STAGE_PREVIEW)
                      const renderCard = (d: (typeof stageRows)[number]) => {
                        const label = d.name ?? d.person?.name ?? `Deal #${d.id}`
                        const inner = (
                          <div className="flex min-h-10 items-center justify-between gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{label}</span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{money(d.value)}</span>
                          </div>
                        )
                        return d.person_id ? (
                          <Link
                            key={d.id}
                            href={`/admin/crm/${d.person_id}`}
                            className="block rounded-md border border-border px-3 py-2 transition-colors hover:bg-muted/50"
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div key={d.id} className="rounded-md border border-border px-3 py-2">
                            {inner}
                          </div>
                        )
                      }
                      return (
                        <>
                          {preview.map(renderCard)}
                          {rest.length > 0 ? (
                            <details className="group space-y-2">
                              <summary className="flex min-h-10 cursor-pointer list-none items-center text-xs font-medium text-muted-foreground hover:text-foreground">
                                See all {stageRows.length} in {stage}
                              </summary>
                              <div className="space-y-2">{rest.map(renderCard)}</div>
                            </details>
                          ) : null}
                        </>
                      )
                    })()}
                  </div>
                </ConsoleSection>
              ))}
            </div>
          </section>
        )
      })}
      {deals.length === 0 ? (
        <ConsoleSection title="Pipeline" className="mt-6">
          <p className="py-6 text-center text-sm text-muted-foreground">No deals yet.</p>
        </ConsoleSection>
      ) : null}
    </main>
  )
}
