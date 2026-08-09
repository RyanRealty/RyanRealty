// @no-parity — internal admin tool, no public mockup contract.
//
// /admin/bpo/[slug] — per-opinion review page. P11C: migrated to the LOCKED
// admin v2 language (design_system/admin/ADMIN_UI.md) through the shared
// presentation kit (@/components/admin/v2). Presentation only. This is an
// ENTITY page (ADMIN_UI §3 pattern 5), so the h1 is the subject address —
// content, not page-title chrome — and it renders through EntityTitle.
//
// The broker SEES the rendered opinion (large iframe of the stored document,
// never raw code), reads the listing-history signals that drove it, adjusts
// the opinion of value if warranted (rebuild), and finalizes. Everything is an
// explicit click.
//
// Carried over verbatim: getSession() → getAdminRoleForEmail(), both
// /admin/access-denied redirects (no role, and the report_viewer role), the
// slug normalisation (trim + lowercase), the Promise.all over
// getBpoAdminRowBySlug + listActiveBrokersForCma, notFound() on a missing row,
// the broker { slug, displayName } mapping, status / hasDocument /
// buildError / market / listingHistory / signals / offerHeadline, the
// `/bpo/<slug>?variant=full` preview src and the identical target=_blank link,
// the /admin/bpo href, and every BpoReviewActions prop — bpoId, slug, status,
// opinionValue, priceOverride, purpose, brokerSlug (the signing broker,
// unchanged in value and resolution), brokers, hasDocument.
//
// Every §0 figure is byte-identical to the pre-migration page: opinion of
// value and the supported range still run through formatPriceExact, confidence
// is still String(row.confidence ?? '—'), and the comps · listing-history cell
// still prints `${comps_count ?? '—'} · ${failed_attempts} failed` with the
// same null rule. The market footnote keeps its geo label, months of supply,
// and Math.round on median DOM.
//
// Shape changed, data did not: the KPI card strip became the family's
// typographic numbers strip, the shadcn Badge became a state word carrying the
// same status text, the console panels became v2 section heads, and the
// two-column desktop grid became the locked pattern-5 stack (one 960px lane) —
// which is why the build-error sentence no longer says "the panel on the
// right". The signal severity was a bare colored dot (color alone, WCAG 1.4.1)
// and is now the severity word in the matching state color: strong → down,
// info → waiting, everything else → accent, exactly the old color mapping.
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { listActiveBrokersForCma } from '@/lib/data'
import { getBpoAdminRowBySlug } from '@/lib/data/bpo/reads'
import {
  EntityTitle,
  ReportNumbers,
  SectionHead,
  StateWord,
  type AdminState,
} from '@/components/admin/v2'
import { BpoReviewActions } from '@/app/admin/(protected)/bpo/_components/BpoReviewActions'
import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'

export const dynamic = 'force-dynamic'

const usd = formatPriceExact

type Signal = { code?: string; severity?: string; text?: string }

/** Same split the retired Badge made: 'final' reads finished, anything else waits. */
function statusState(status: string): AdminState {
  return status === 'final' ? 'ok' : 'waiting'
}

/** Same split the retired severity dot made, now carried by the word too. */
function severityState(severity: string | undefined): AdminState {
  if (severity === 'strong') return 'down'
  if (severity === 'info') return 'waiting'
  return 'accent'
}

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
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <nav style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)' }}>
        <Link href="/admin/bpo" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Price opinions
        </Link>
      </nav>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <EntityTitle>{String(row.subject_address ?? safeSlug)}</EntityTitle>
        <StateWord state={statusState(status)}>{status}</StateWord>
      </div>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '4px 0 0' }}>
        {row.purpose ? `${String(row.purpose)} · ` : ''}
        {row.subject_status ? `${String(row.subject_status)} listing · ` : ''}
        {row.broker_slug ? `signed by ${String(row.broker_slug)} · ` : ''}
        built {formatDate((row.built_at as string | null) ?? (row.created_at as string | null))}
      </p>

      {hasDocument ? (
        <p style={{ margin: '12px 0 0' }}>
          <Link
            href={`/bpo/${safeSlug}?variant=full`}
            target="_blank"
            rel="noopener noreferrer"
            className="av2-btn av2-btn--quiet av2-btn--touch"
            style={{ textDecoration: 'none' }}
          >
            Open full page
          </Link>
        </p>
      ) : null}

      <div style={{ marginTop: 18 }} />
      <ReportNumbers
        items={[
          {
            key: 'opinion',
            label: 'Opinion of value',
            value: usd((row.opinion_value as number | null) ?? null),
          },
          {
            key: 'range',
            label: 'Supported range',
            value: `${usd((row.value_low as number | null) ?? null)} – ${usd((row.value_high as number | null) ?? null)}`,
          },
          { key: 'confidence', label: 'Confidence', value: String(row.confidence ?? '—') },
          {
            key: 'comps',
            label: 'Comps · listing history',
            value: `${row.comps_count ?? '—'} · ${
              listingHistory?.failed_attempts != null ? `${listingHistory.failed_attempts} failed` : '—'
            }`,
          },
        ]}
      />

      {offerHeadline ? (
        <p
          style={{
            border: '1px solid var(--a-border)',
            background: 'var(--a-accent-wash)',
            borderRadius: 'var(--a-r-lg)',
            padding: '12px 16px',
            margin: '0 0 8px',
            fontSize: 'var(--a-text-md)',
            color: 'var(--a-text)',
          }}
        >
          <span
            style={{
              display: 'block',
              fontSize: 'var(--a-text-xs)',
              fontWeight: 600,
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              color: 'var(--a-text-2)',
              marginBottom: 2,
            }}
          >
            Offer strategy
          </span>
          {offerHeadline}
        </p>
      ) : null}

      {buildError ? (
        <p
          style={{
            background: 'var(--a-danger-wash)',
            borderRadius: 'var(--a-r-lg)',
            padding: '12px 16px',
            margin: '0 0 8px',
            fontSize: 'var(--a-text-sm)',
            color: 'var(--a-danger)',
          }}
        >
          The last build did not finish: {buildError}. Fix the input and rebuild from the review
          panel.
        </p>
      ) : null}

      {signals.length > 0 ? (
        <>
          <SectionHead>Listing-history signals</SectionHead>
          <ul className="av2-quietlist">
            {signals.map((s, i) => (
              <li key={i} className="av2-quiet">
                {s.severity ? (
                  <StateWord state={severityState(s.severity)}>{s.severity}</StateWord>
                ) : null}
                <span style={{ color: 'var(--a-text)' }}>{s.text}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <SectionHead>Review</SectionHead>
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
        <p style={{ marginTop: 16, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {String(market.geo_label ?? '')}
          {market.months_of_supply != null ? ` · ${String(market.months_of_supply)} months of supply` : ''}
          {market.median_dom != null ? ` · median ${Math.round(Number(market.median_dom))} days` : ''}
        </p>
      ) : null}

      <SectionHead>Opinion document</SectionHead>
      {previewSrc ? (
        <div
          style={{
            overflow: 'hidden',
            borderRadius: 'var(--a-r-lg)',
            border: '1px solid var(--a-border)',
            background: 'var(--a-inset)',
          }}
        >
          <iframe
            src={previewSrc}
            title={`Broker price opinion for ${String(row.subject_address ?? safeSlug)}`}
            style={{ width: '100%', height: '78vh', minHeight: 600, background: 'var(--a-bg)', border: 0 }}
          />
        </div>
      ) : (
        <p
          style={{
            padding: '32px 8px',
            textAlign: 'center',
            fontSize: 'var(--a-text-sm)',
            color: 'var(--a-text-2)',
          }}
        >
          No document yet. Use Save and rebuild to generate it.
        </p>
      )}
    </div>
  )
}
