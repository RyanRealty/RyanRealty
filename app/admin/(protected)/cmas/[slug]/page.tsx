// @no-parity — internal admin tool, no public mockup contract.
//
// /admin/cmas/[slug] — per-CMA review page. Numbers, origin, the email that
// will go out, then Approve & send. Extra form work sits under details.
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getCmaAdminReviewRowBySlug, getCmaProspectAsk, listActiveBrokersForCma } from '@/lib/data'
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
import { formatDate } from '@/lib/format/date'
import { brokerCmaViewHref, canOpenCmaDocument } from '@/lib/cma/draft-access'
import { applySlugStreetDirectional } from '@/lib/cma/address-slug'
import { CmaReviewDocumentButton } from '@/app/admin/(protected)/cmas/_components/CmaReviewDocumentButton'
import { classifyCmaOrigin, CMA_ORIGIN_INTENT, sendModeForOrigin, theirPriceLabelFor } from '@/lib/cma/origin'
import { composeCmaFirstContact, cmaFirstContactFactsFromRow } from '@/lib/cma/first-contact'
import { resolveTheirPrice } from '@/lib/cma/queue-view'
import '../_components/cma-review.css'

export const dynamic = 'force-dynamic'

const usd = formatPriceExact

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
  const listingKey = String(row.subject_listing_key ?? '').trim()
  const blockers = cmaPublishRefusals(row)
  const concerns = cmaPublishConcerns(row)
  const origin = classifyCmaOrigin(
    (row.request_source as string | null) ?? null,
    (row.doc_type as string | null) ?? null,
  )
  const lastList = resolveTheirPrice(origin, summary, await getCmaProspectAsk(String(row.id)))
  const lastListLabel = theirPriceLabelFor(origin) ?? 'Last list'
  const auditVerdict = String((summary?.audit as { verdict?: string } | null)?.verdict ?? '').toLowerCase()
  const sendMode = sendModeForOrigin(origin)
  const sendLabel =
    status === 'draft' &&
    hasDocument &&
    Boolean(linkedPerson?.primaryEmail || row.client_email) &&
    auditVerdict !== 'fail'
      ? sendMode === 'now'
        ? 'Approve & send'
        : sendMode === 'drip'
          ? 'Approve & queue'
          : 'Approve'
      : null
  const signingBroker = brokers.find((b) => b.slug === String(row.broker_slug ?? ''))
  const firstContact = composeCmaFirstContact(origin, {
    ...cmaFirstContactFactsFromRow(row, {
      brokerName: signingBroker?.displayName ?? 'Matt Ryan',
      firstName: (clientLabel ?? '').trim().split(/\s+/)[0] || null,
      lastListPrice: lastList,
    }),
    address: subjectAddress || null,
  })

  const previewSrc = canOpenDocument
    ? brokerCmaViewHref(safeSlug)
    : isLegacyFile
      ? String(row.html_path).replace(/^public/, '')
      : null

  return (
    <div
      className="av2-scope"
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: 16,
        paddingBottom: 'calc(var(--a-tabbar-h, 56px) + 80px)',
      }}
    >
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
        {CMA_ORIGIN_INTENT[origin]}
      </p>
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
        {linkedPerson?.primaryEmail || row.client_email
          ? ` · ${String(linkedPerson?.primaryEmail || row.client_email)}`
          : ''}
        {row.broker_slug ? ` · signed by ${String(row.broker_slug)}` : ''}
        {` · built ${formatDate((row.built_at as string | null) ?? (row.created_at as string | null))}`}
      </p>

      {canOpenDocument || hasDocument ? (
        <p style={{ margin: '12px 0 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {canOpenDocument ? <CmaReviewDocumentButton slug={safeSlug} /> : null}
          {hasDocument ? (
            <a
              href={`/api/cma/${safeSlug}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="av2-btn av2-btn--quiet av2-btn--touch"
              style={{ textDecoration: 'none' }}
            >
              Open PDF
            </a>
          ) : null}
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
            value: `${usd((row.value_low as number | null) ?? null)}-${usd((row.value_high as number | null) ?? null)}`,
          },
          ...(lastList != null
            ? [{ key: 'last-list', label: lastListLabel, value: usd(lastList) }]
            : []),
          { key: 'comps', label: 'Comps', value: String(row.comps_count ?? '—') },
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
      <p
        className="cma-review-copy"
        style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', whiteSpace: 'pre-wrap' }}
      >
        {firstContact.bodyText}
      </p>
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
        sendLabel={sendLabel}
      />

      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Listing page
        </summary>
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
      </details>
      {!previewSrc ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 16 }}>
          No document yet. Use Save and rebuild to generate it.
        </p>
      ) : null}
    </div>
  )
}
