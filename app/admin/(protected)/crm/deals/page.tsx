// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, listCrmDeals } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import {
  CrmList,
  CrmListRow,
  CrmSectionLabel,
} from '@/components/admin/crm/mobile/CrmMobileKit'

export const metadata = { title: 'Pipeline | CRM | Admin' }
export const dynamic = 'force-dynamic'

function money(v: number | null): string {
  if (!v) return '—'
  return '$' + Math.round(v).toLocaleString('en-US')
}

/** Compact money for mobile meta column: $655K / $1.2M */
function moneyCompact(v: number | null): string {
  if (!v) return '—'
  const r = Math.round(v)
  if (r >= 1_000_000) return '$' + (r / 1_000_000).toFixed(r % 1_000_000 === 0 ? 0 : 1) + 'M'
  if (r >= 1_000) return '$' + Math.round(r / 1_000) + 'K'
  return '$' + r.toLocaleString('en-US')
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
      <div className="mb-1 hidden text-sm text-muted-foreground md:block">
        <Link href="/admin/crm" className="inline-flex min-h-10 items-center hover:text-foreground">← Back to CRM</Link>
      </div>
      <h1 className="text-xl font-bold text-foreground md:text-2xl">Pipeline</h1>
      <p className="mt-1 hidden text-sm text-muted-foreground md:block">
        Pre-contract pipeline imported from FUB. Vault remains the system of record once a transaction opens.
      </p>

      {/* ── Mobile: vertical stacked groups (FUB-style) ──────────────────── */}
      <div className="md:hidden">
        {deals.length === 0 ? (
          <p className="mt-6 py-6 text-center text-sm text-muted-foreground">No deals yet.</p>
        ) : (
          pipelines.map((pipe) => {
            const pipeRows = deals.filter((d) => (d.pipeline ?? 'Other') === pipe)
            const stages = [...new Set(pipeRows.map((d) => d.stage ?? 'No stage'))]
            return (
              <section key={pipe} className="mt-6">
                {/* Pipeline header — shown only when there's more than one pipeline */}
                {pipelines.length > 1 ? (
                  <h2 className="mb-1 text-base font-semibold text-foreground">
                    {pipe}{' '}
                    <span className="font-normal text-muted-foreground">({pipeRows.length})</span>
                  </h2>
                ) : null}
                <div className="-mx-3 overflow-hidden rounded-none border-y border-border bg-card sm:-mx-6">
                  {stages.map((stage) => {
                    const stageRows = pipeRows.filter((d) => (d.stage ?? 'No stage') === stage)
                    return (
                      <div key={stage}>
                        <CrmSectionLabel>
                          {stage.toUpperCase()} · {stageRows.length}
                        </CrmSectionLabel>
                        <CrmList>
                          {stageRows.map((d) => {
                            const personName = d.person?.name ?? null
                            const dealName = d.name ?? personName ?? `Deal #${d.id}`
                            // avatar seed: prefer person name (gives a stable color tied to the person)
                            const avatarSeed = personName ?? dealName
                            // title = deal name (or person name if no deal name set)
                            // subtitle = stage (context for the viewer scanning down the list)
                            const subtitle = d.name && personName && d.name !== personName
                              ? personName
                              : stage
                            return (
                              <CrmListRow
                                key={d.id}
                                href={d.person_id ? `/admin/crm/${d.person_id}` : undefined}
                                name={avatarSeed}
                                title={dealName}
                                subtitle={subtitle}
                                meta={
                                  <span className="tabular-nums text-foreground">
                                    {moneyCompact(d.value)}
                                  </span>
                                }
                              />
                            )
                          })}
                        </CrmList>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })
        )}
      </div>

      {/* ── Desktop: kanban columns (unchanged) ──────────────────────────── */}
      <div className="hidden md:block">
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
      </div>
    </main>
  )
}
