// @no-parity — internal admin tool, no public mockup contract.
/**
 * /admin/cmas/[slug] — per-CMA review page.
 *
 * Matt SEES the CMA (large rendered iframe of the stored document — never raw
 * code), edits client info + price adjustment (rebuild), approves the draft,
 * and sends through the CRM — a tracked email from the signing broker's own
 * mailbox (Resend fallback). Sending is an explicit click.
 */

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getCmaAdminRowBySlug, listActiveBrokersForCma } from '@/lib/data'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { KpiStrip } from '@/components/console/KpiStrip'
import { CmaReviewActions } from '@/components/admin/cma/CmaReviewActions'
import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'

export const dynamic = 'force-dynamic'

const usd = formatPriceExact


function statusVariant(status: string) {
  switch (status) {
    case 'finalized':
      return 'default' as const
    case 'delivered':
      return 'secondary' as const
    default:
      return 'outline' as const
  }
}

export default async function AdminCmaReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!adminRole) redirect('/admin/access-denied')
  if (adminRole.role === 'report_viewer') redirect('/admin/access-denied')

  const { slug } = await params
  const safeSlug = String(slug ?? '').trim().toLowerCase()
  const [row, brokerRows] = await Promise.all([
    getCmaAdminRowBySlug(safeSlug),
    listActiveBrokersForCma(),
  ])
  if (!row) notFound()

  const brokers = brokerRows.map((b) => ({
    slug: String(b.slug),
    displayName: String(b.display_name ?? b.slug),
  }))

  const status = String(row.status ?? 'draft')
  const hasStoredHtml = Boolean(row.html_content)
  const isLegacyFile = !hasStoredHtml && String(row.html_path ?? '').startsWith('public/cmas/')
  const hasDocument = hasStoredHtml || isLegacyFile
  const buildError = (row.build_error as string | null) ?? null
  const summary = (row.build_summary as Record<string, unknown> | null) ?? null
  const marketSummary = (summary?.market as Record<string, unknown> | null) ?? null

  const previewSrc = hasStoredHtml
    ? `/cma/${safeSlug}`
    : isLegacyFile
      ? String(row.html_path).replace(/^public/, '')
      : null

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{String(row.subject_address ?? safeSlug)}</h1>
            <Badge variant={statusVariant(status)} className="capitalize">{status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {row.client_name ? `Prepared for ${String(row.client_name)}` : 'No client on file'}
            {row.client_email ? ` · ${String(row.client_email)}` : ''}
            {row.broker_slug ? ` · signed by ${String(row.broker_slug)}` : ''}
            {` · built ${formatDate((row.built_at as string | null) ?? (row.created_at as string | null))}`}
          </p>
        </div>
        <div className="flex gap-2">
          {hasDocument ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/api/cma/${safeSlug}/pdf`} target="_blank" rel="noopener noreferrer">
                Open PDF
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/admin/cmas">Back to CMAs</Link>
          </Button>
        </div>
      </header>

      <KpiStrip
        items={[
          { label: 'Recommended list', value: usd((row.recommended_list as number | null) ?? null) },
          {
            label: 'Value range',
            value: `${usd((row.value_low as number | null) ?? null)} – ${usd((row.value_high as number | null) ?? null)}`,
          },
          { label: 'Comps', value: String(row.comps_count ?? '—') },
          {
            label: 'Market',
            value: marketSummary
              ? `${String(marketSummary.geo_label ?? '—')} · ${marketSummary.months_of_supply != null ? `${marketSummary.months_of_supply} MoS` : '—'}`
              : '—',
          },
        ]}
      />

      {buildError ? (
        <Alert variant="destructive">
          <AlertDescription>
            The last build did not finish: {buildError}. Fix the input (address or MLS) and rebuild from the
            panel on the right.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <ConsoleSection title="Document preview">
          {previewSrc ? (
            <div className="overflow-hidden rounded-lg border border-border bg-muted">
              <iframe
                src={previewSrc}
                title={`CMA preview for ${String(row.subject_address ?? safeSlug)}`}
                className="w-full bg-background"
                style={{ height: '75vh', minHeight: 600 }}
              />
            </div>
          ) : (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              No document yet. Use Save and rebuild to generate it.
            </p>
          )}
        </ConsoleSection>

        <ConsoleSection title="Review and send">
          <CmaReviewActions
            cmaId={String(row.id)}
            slug={safeSlug}
            status={status}
            clientName={(row.client_name as string | null) ?? null}
            clientEmail={(row.client_email as string | null) ?? null}
            clientPhone={(row.client_phone as string | null) ?? null}
            recommendedList={(row.recommended_list as number | null) ?? null}
            priceOverride={(row.price_override as number | null) ?? null}
            brokerSlug={(row.broker_slug as string | null) ?? null}
            brokers={brokers}
            hasDocument={hasDocument}
          />
        </ConsoleSection>
      </div>
    </div>
  )
}
