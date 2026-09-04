// @no-parity — internal admin tool, no public mockup contract.
//
// /admin/cmas/[slug] — per-CMA review page. P11C: migrated to the LOCKED admin
// v2 language (design_system/admin/ADMIN_UI.md) through the shared
// presentation kit (@/components/admin/v2). Presentation only. This is an
// ENTITY page (ADMIN_UI §3 pattern 5), so the h1 is the subject address —
// content, not page-title chrome — and it renders through EntityTitle.
//
// Matt SEES the CMA (large rendered iframe of the stored document — never raw
// code), edits client info + price adjustment (rebuild), approves the draft,
// and sends through the CRM — a tracked email from the signing broker's own
// mailbox (Resend fallback). Sending is an explicit click.
//
// Carried over verbatim: getSession() → getAdminRoleForEmail(), both
// /admin/access-denied redirects (no role, and the report_viewer role), the
// slug normalisation (trim + lowercase), the Promise.all over
// getCmaAdminRowBySlug + listActiveBrokersForCma, notFound() on a missing row,
// the broker { slug, displayName } mapping, status / hasStoredHtml /
// isLegacyFile / hasDocument / buildError / summary / marketSummary, the
// listingKey trim, cmaPublishRefusals(row) and cmaPublishConcerns(row) — the
// same functions the publish action enforces, so the panel can never offer a
// button the server would refuse — the three-way previewSrc (stored → /cma/<slug>,
// legacy file → html_path minus the public prefix, otherwise null), the
// `/api/cma/<slug>/pdf` target=_blank link, the /admin/cmas href, every
// CmaReviewActions prop (cmaId, slug, status, clientName, clientEmail,
// clientPhone, recommendedList, priceOverride, brokerSlug — the signing
// broker, unchanged in value and resolution — brokers, hasDocument), and every
// CmaPublishControl prop (slug, subjectAddress, listingKey, valueLow,
// valueHigh, published, publishedAt, publishedBy, blockers, concerns).
//
// Every §0 figure is byte-identical to the pre-migration page: recommended
// list and the value range still run through formatPriceExact, comps is still
// String(row.comps_count ?? '—'), and the market cell still prints
// `${geo_label ?? '—'} · ${months_of_supply} MoS` with the same null rules.
//
// Shape changed, data did not: the KPI card strip became the family's
// typographic numbers strip, the shadcn Badge became a state word carrying the
// same status text, the console panels became v2 section heads, and the
// two-column desktop grid became the locked pattern-5 stack (one 960px lane) —
// which is why the build-error sentence no longer says "the panel on the
// right".
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getCmaAdminReviewRowBySlug, listActiveBrokersForCma } from '@/lib/data'
import { getPersonForCmaKickoff } from '@/lib/data/crm/cmaKickoff'
import { parseCmaClientIntent } from '@/lib/cma/client-intent'
import {
  EntityTitle,
  ReportNumbers,
  SectionHead,
  StateWord,
  type AdminState,
} from '@/components/admin/v2'
import { CmaReviewActions } from '@/app/admin/(protected)/cmas/_components/CmaReviewActions'
import { CmaPublishControl } from '@/app/admin/(protected)/cmas/_components/CmaPublishControl'
import { cmaPublishConcerns, cmaPublishRefusals } from '@/app/actions/cma-publish-preconditions'
import { formatPriceExact } from '@/lib/format/money'
import { formatDateTime } from '@/lib/format/date'
import { brokerCmaViewHref, canOpenCmaDocument } from '@/lib/cma/draft-access'
import { applySlugStreetDirectional } from '@/lib/cma/address-slug'
import { CmaReviewDocumentButton } from '@/app/admin/(protected)/cmas/_components/CmaReviewDocumentButton'

export const dynamic = 'force-dynamic'

const usd = formatPriceExact

/** The retired Badge variants, one for one: default → ok, secondary → accent,
 *  outline → waiting. Same three-way split, now carried by text + color. */
function statusState(status: string): AdminState {
  switch (status) {
    case 'finalized':
      return 'ok'
    case 'delivered':
      return 'accent'
    default:
      return 'waiting'
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
    getCmaAdminReviewRowBySlug(safeSlug),
    listActiveBrokersForCma(),
  ])
  if (!row) notFound()
  const subjectAddress = applySlugStreetDirectional(String(row.subject_address ?? ''), safeSlug)
  const personId = row.person_id == null ? null : Number(row.person_id)
  const linkedPerson = personId ? await getPersonForCmaKickoff(personId) : null
  const clientLabel = linkedPerson?.name || (row.client_name as string | null) || null

  const brokers = brokerRows.map((b) => ({
    slug: String(b.slug),
    displayName: String(b.display_name ?? b.slug),
  }))

  const status = String(row.status ?? 'draft')
  const hasStoredHtml = String(row.html_path ?? '').startsWith('db:cmas.html_content:')
  const isLegacyFile = !hasStoredHtml && String(row.html_path ?? '').startsWith('public/cmas/')
  const hasDocument = hasStoredHtml || isLegacyFile || Boolean(row.built_at)
  const canOpenDocument = canOpenCmaDocument(row)
  const buildError = (row.build_error as string | null) ?? null
  const summary = (row.build_summary as Record<string, unknown> | null) ?? null
  const marketSummary = (summary?.market as Record<string, unknown> | null) ?? null

  // Publish eligibility is computed HERE, by the SAME function the publish
  // action enforces (which is itself the public guard's own rules, stated in
  // words). The control renders these reasons verbatim, so the panel can never
  // offer a button the server would refuse.
  const listingKey = String(row.subject_listing_key ?? '').trim()
  const blockers = cmaPublishRefusals(row)
  // The other half of the same rule: what does not block, stated in the audit's
  // own words rather than summarised into a flag.
  const concerns = cmaPublishConcerns(row)

  const previewSrc = canOpenDocument
    ? brokerCmaViewHref(safeSlug)
    : isLegacyFile
      ? String(row.html_path).replace(/^public/, '')
      : null

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      {canOpenDocument ? (
        <div style={{ margin: '0 0 16px' }}>
          <CmaReviewDocumentButton slug={safeSlug} />
        </div>
      ) : null}

      <nav style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)' }}>
        <Link href="/admin/cmas" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          CMAs
        </Link>
      </nav>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <EntityTitle>{subjectAddress || safeSlug}</EntityTitle>
        <StateWord state={statusState(status)}>{status}</StateWord>
      </div>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '4px 0 0' }}>
        {clientLabel && personId ? (
          <>
            Prepared for{' '}
            <Link href={`/admin/people/${personId}`} style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
              {clientLabel}
            </Link>
          </>
        ) : clientLabel ? (
          `Prepared for ${clientLabel}`
        ) : (
          'No client on file'
        )}
        {(linkedPerson?.primaryEmail || row.client_email)
          ? ` · ${String(linkedPerson?.primaryEmail || row.client_email)}`
          : ''}
        {row.broker_slug ? ` · signed by ${String(row.broker_slug)}` : ''}
        {` · built ${formatDateTime((row.built_at as string | null) ?? (row.created_at as string | null))}`}
      </p>

      {hasDocument ? (
        <p style={{ margin: '12px 0 0' }}>
          <a
            href={`/api/cma/${safeSlug}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="av2-btn av2-btn--quiet av2-btn--touch"
            style={{ textDecoration: 'none' }}
          >
            Open PDF
          </a>
        </p>
      ) : null}

      <div style={{ marginTop: 18 }} />
      <ReportNumbers
        items={[
          {
            key: 'recommended',
            label: 'Recommended list',
            value: usd((row.recommended_list as number | null) ?? null),
          },
          {
            key: 'range',
            label: 'Value range',
            value: `${usd((row.value_low as number | null) ?? null)} – ${usd((row.value_high as number | null) ?? null)}`,
          },
          { key: 'comps', label: 'Comps', value: String(row.comps_count ?? '—') },
          {
            key: 'market',
            label: 'Market',
            value: marketSummary
              ? `${String(marketSummary.geo_label ?? '—')} · ${marketSummary.months_of_supply != null ? `${marketSummary.months_of_supply} MoS` : '—'}`
              : '—',
          },
        ]}
      />

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
          The last build did not finish: {buildError}. Fix the input (address or MLS) and rebuild
          from the review panel.
        </p>
      ) : null}

      <SectionHead>Review and send</SectionHead>
      <CmaReviewActions
        cmaId={String(row.id)}
        slug={safeSlug}
        status={status}
        clientName={clientLabel}
        clientEmail={(linkedPerson?.primaryEmail || (row.client_email as string | null)) ?? null}
        clientPhone={(linkedPerson?.primaryPhone || (row.client_phone as string | null)) ?? null}
        personId={personId}
        personName={linkedPerson?.name ?? null}
        subjectBeds={(row.subject_beds as number | null) ?? null}
        subjectBaths={(row.subject_baths as number | null) ?? null}
        subjectSqft={(row.subject_sqft as number | null) ?? null}
        clientIntent={parseCmaClientIntent((row.client_notes as string | null) ?? null)}
        recommendedList={(row.recommended_list as number | null) ?? null}
        priceOverride={(row.price_override as number | null) ?? null}
        brokerSlug={(row.broker_slug as string | null) ?? null}
        brokers={brokers}
        hasDocument={hasDocument}
        builtAt={(row.built_at as string | null) ?? null}
      />

      <SectionHead>Listing page</SectionHead>
      <CmaPublishControl
        slug={safeSlug}
        subjectAddress={subjectAddress || safeSlug}
        listingKey={listingKey || null}
        valueLow={(row.value_low as number | null) ?? null}
        valueHigh={(row.value_high as number | null) ?? null}
        published={row.published_to_listing === true}
        publishedAt={(row.published_at as string | null) ?? null}
        publishedBy={(row.published_by as string | null) ?? null}
        blockers={blockers}
        concerns={concerns}
      />

      <SectionHead>Document preview</SectionHead>
      {previewSrc ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Open Review CMA above to read the document. The preview is not inlined here so this
          page stays fast.
        </p>
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
