// @no-parity — internal admin tool, no public mockup contract.
/**
 * /admin/bpo/[slug] — per-opinion review page.
 *
 * The broker SEES the rendered opinion (large iframe of the stored document,
 * never raw code), reads the listing-history signals that drove it, adjusts the
 * opinion of value if warranted (rebuild), and finalizes. Everything is an
 * explicit click.
 */

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { listActiveBrokersForCma } from '@/lib/data'
import { getBpoAdminRowBySlug } from '@/lib/data/bpo/reads'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { KpiStrip } from '@/components/console/KpiStrip'
import { BpoReviewActions } from '@/components/admin/bpo/BpoReviewActions'
import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const usd = formatPriceExact

type Signal = { code?: string; severity?: string; text?: string }

export default async function AdminBpoReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!adminRole) redirect('/admin/access-denied')
  if (adminRole.role === 'report_viewer') redirect('/admin/access-denied')

  const { slug } = await params
  const safeSlug = String(slug ?? '').trim().toLowerCase()
  const [row, brokerRows] = await Promise.all([getBpoAdminRowBySlug(safeSlug), listActiveBrokersForCma()])
  if (!row) notFound()

  const brokers = brokerRows.map((b) => ({ slug: String(b.slug), displayName: String(b.display_name ?? b.slug) }))
  const status = String(row.status ?? 'draft')
  const hasDocument = Boolean(row.html_content)
  const buildError = (row.build_error as string | null) ?? null
  const market = (row.market_snapshot as Record<string, unknown> | null) ?? null
  const listingHistory = (row.listing_history as Record<string, unknown> | null) ?? null
  const signals = (listingHistory?.signals as Signal[] | null) ?? []
  const offer = (row.offer_strategy as Record<string, unknown> | null) ?? null
  const offerHeadline = typeof offer?.headline === 'string' ? offer.headline : null
  // Admin sees the full document (offer strategy intact); the public /bpo route
  // is client-safe by default.
  const previewSrc = hasDocument ? `/bpo/${safeSlug}?variant=full` : null

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{String(row.subject_address ?? safeSlug)}</h1>
            <Badge variant={status === 'final' ? 'default' : 'outline'} className="capitalize">
              {status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {row.purpose ? `${String(row.purpose)} · ` : ''}
            {row.subject_status ? `${String(row.subject_status)} listing · ` : ''}
            {row.broker_slug ? `signed by ${String(row.broker_slug)} · ` : ''}
            built {formatDate((row.built_at as string | null) ?? (row.created_at as string | null))}
          </p>
        </div>
        <div className="flex gap-2">
          {hasDocument ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/bpo/${safeSlug}?variant=full`} target="_blank" rel="noopener noreferrer">
                Open full page
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/admin/bpo">Back to opinions</Link>
          </Button>
        </div>
      </header>

      <KpiStrip
        items={[
          { label: 'Opinion of value', value: usd((row.opinion_value as number | null) ?? null) },
          {
            label: 'Supported range',
            value: `${usd((row.value_low as number | null) ?? null)} – ${usd((row.value_high as number | null) ?? null)}`,
          },
          { label: 'Confidence', value: String(row.confidence ?? '—') },
          {
            label: 'Comps · listing history',
            value: `${row.comps_count ?? '—'} · ${
              listingHistory?.failed_attempts != null ? `${listingHistory.failed_attempts} failed` : '—'
            }`,
          },
        ]}
      />

      {offerHeadline ? (
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Offer strategy</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">{offerHeadline}</p>
        </div>
      ) : null}

      {buildError ? (
        <Alert variant="destructive">
          <AlertDescription>
            The last build did not finish: {buildError}. Fix the input and rebuild from the panel on the right.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {signals.length > 0 ? (
            <ConsoleSection title="Listing-history signals">
              <ul className="space-y-2">
                {signals.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        s.severity === 'strong' ? 'bg-destructive' : s.severity === 'info' ? 'bg-muted-foreground' : 'bg-primary',
                      )}
                      aria-hidden
                    />
                    <span className="text-foreground">{s.text}</span>
                  </li>
                ))}
              </ul>
            </ConsoleSection>
          ) : null}

          <ConsoleSection title="Opinion document">
            {previewSrc ? (
              <div className="overflow-hidden rounded-lg border border-border bg-muted">
                <iframe
                  src={previewSrc}
                  title={`Broker price opinion for ${String(row.subject_address ?? safeSlug)}`}
                  className="w-full bg-background"
                  style={{ height: '78vh', minHeight: 600 }}
                />
              </div>
            ) : (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                No document yet. Use Save and rebuild to generate it.
              </p>
            )}
          </ConsoleSection>
        </div>

        <ConsoleSection title="Review">
          <BpoReviewActions
            bpoId={String(row.id)}
            slug={safeSlug}
            status={status}
            opinionValue={(row.opinion_value as number | null) ?? null}
            priceOverride={(row.price_override as number | null) ?? null}
            purpose={(row.purpose as string | null) ?? null}
            brokerSlug={(row.broker_slug as string | null) ?? null}
            brokers={brokers}
            hasDocument={hasDocument}
          />
          {market ? (
            <p className="mt-4 text-xs text-muted-foreground">
              {String(market.geo_label ?? '')}
              {market.months_of_supply != null ? ` · ${String(market.months_of_supply)} months of supply` : ''}
              {market.median_dom != null ? ` · median ${Math.round(Number(market.median_dom))} days` : ''}
            </p>
          ) : null}
        </ConsoleSection>
      </div>
    </div>
  )
}
