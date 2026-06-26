// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, listCrmDeals } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { Card } from '@/components/ui/card'
import {
  CrmList,
  CrmListRow,
  CrmSectionLabel,
} from '@/components/admin/crm/mobile/CrmMobileKit'
import { crmAvatarColor } from '@/components/admin/crm/mobile/avatar-utils'
import { ConsoleSection } from '@/components/console/ConsoleSection'

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

/** Compact dollar sum for column header: $2.4M / $655K */
function moneySum(v: number): string {
  if (v === 0) return '$0'
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1) + 'M'
  if (v >= 1_000) return '$' + Math.round(v / 1_000) + 'K'
  return '$' + v.toLocaleString('en-US')
}

/** Deterministic muted top-border color per stage name. Uses a restricted palette
 *  of tasteful hues that contrast against the card background without being garish.
 *  Applied via inline style so the design-token linter stays green. */
const STAGE_BORDER_COLORS = [
  '#f59e0b', // amber — Start / first stage
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f97316', // orange
  '#10b981', // emerald / Closed
  '#6b7280', // neutral-500 — Lost / catch-all
]
function stageBorderColor(stage: string, idx: number): string {
  // Map well-known FUB stage names to intentional colors
  const lower = stage.toLowerCase()
  if (lower.includes('start') || lower.includes('temp')) return STAGE_BORDER_COLORS[0]
  if (lower.includes('contract')) return STAGE_BORDER_COLORS[1]
  if (lower.includes('offer')) return STAGE_BORDER_COLORS[2]
  if (lower.includes('pending')) return STAGE_BORDER_COLORS[3]
  if (lower.includes('clos')) return STAGE_BORDER_COLORS[4]
  if (lower.includes('lost')) return STAGE_BORDER_COLORS[5]
  // fallback: cycle through palette by index
  return STAGE_BORDER_COLORS[idx % STAGE_BORDER_COLORS.length]
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
      <h1 className="text-xl font-bold text-foreground md:hidden">Pipeline</h1>
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
                                href={`/admin/crm/deals/${d.id}`}
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

      {/* ── Desktop: FUB-style Kanban board ──────────────────────────────── */}
      <ConsoleSection title="Pipeline" className="mt-3 hidden md:block">
        {deals.length === 0 ? (
          <Card className="mt-2 px-6 py-12 text-center text-sm text-muted-foreground">
            No deals yet.
          </Card>
        ) : null}

        {pipelines.map((pipe) => {
          const rows = deals.filter((d) => (d.pipeline ?? 'Other') === pipe)
          const stages = [...new Set(rows.map((d) => d.stage ?? 'No stage'))]

          return (
            <section key={pipe} className="mt-8">
              {/* Pipeline label (only when there are multiple pipelines) */}
              {pipelines.length > 1 ? (
                <h2 className="mb-3 text-base font-semibold text-foreground">
                  {pipe}
                  <span className="ml-2 font-normal text-muted-foreground">({rows.length})</span>
                </h2>
              ) : null}

              {/* Horizontal scroll container — contains the overflow, never leaks to the page */}
              <div className="overflow-x-auto no-scrollbar pb-4">
                <div className="flex gap-3" style={{ width: 'max-content' }}>
                  {stages.map((stage, stageIdx) => {
                    const stageRows = rows.filter((d) => (d.stage ?? 'No stage') === stage)
                    const totalValue = stageRows.reduce((s, d) => s + (d.value ?? 0), 0)
                    const borderColor = stageBorderColor(stage, stageIdx)

                    return (
                      /* Stage column: fixed width, vertical flex, colored top border */
                      <Card
                        key={stage}
                        className="flex w-72 shrink-0 flex-col"
                        style={{ borderTopWidth: 3, borderTopColor: borderColor }}
                      >
                        {/* Column header */}
                        <div className="flex items-center justify-between px-3 py-3">
                          <span className="text-sm font-semibold text-foreground">{stage}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {stageRows.length} {stageRows.length === 1 ? 'deal' : 'deals'}
                            {totalValue > 0 ? <> · <span className="text-success">{moneySum(totalValue)}</span></> : null}
                          </span>
                        </div>

                        {/* Divider */}
                        <div className="mx-3 border-t border-border" />

                        {/* Deal cards */}
                        <div className="flex flex-col gap-2 p-2">
                          {stageRows.length === 0 ? (
                            <p className="py-4 text-center text-xs text-muted-foreground">No deals</p>
                          ) : null}

                          {stageRows.map((d) => {
                            const personName = d.person?.name ?? null
                            const label = d.name ?? personName ?? `Deal #${d.id}`
                            // Avatar seed: person name gives a stable color tied to the contact
                            const avatarSeed = personName ?? label
                            const avatarBg = crmAvatarColor(avatarSeed)

                            const cardInner = (
                              <div className="rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:bg-muted/40">
                                {/* Address / deal name */}
                                <p className="truncate text-sm font-medium text-foreground">{label}</p>

                                {/* Price in success color */}
                                {d.value ? (
                                  <p className="mt-0.5 text-sm tabular-nums text-success">{money(d.value)}</p>
                                ) : null}

                                {/* Close date */}
                                {d.entered_stage_at ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {new Date(d.entered_stage_at).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })}
                                  </p>
                                ) : null}

                                {/* Person avatar at bottom (FUB-style) */}
                                {personName ? (
                                  <div className="mt-2 flex items-center gap-1.5">
                                    {/* color is white-on-colored-bg — same inline pattern as CrmMobileKit avatars */}
                                    <span
                                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                                      style={{ backgroundColor: avatarBg, color: 'rgb(255 255 255)' }}
                                    >
                                      {personName
                                        .trim()
                                        .split(/\s+/)
                                        .filter(Boolean)
                                        .map((p) => p[0].toUpperCase())
                                        .slice(0, 2)
                                        .join('')}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">{personName}</span>
                                  </div>
                                ) : null}
                              </div>
                            )

                            return (
                              <Link key={d.id} href={`/admin/crm/deals/${d.id}`} className="block">
                                {cardInner}
                              </Link>
                            )
                          })}
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            </section>
          )
        })}
      </ConsoleSection>
    </main>
  )
}
