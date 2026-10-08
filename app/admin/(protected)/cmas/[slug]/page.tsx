// @no-parity — internal admin tool, no public mockup contract.
//
// /admin/cmas/[slug] — per-CMA review page. Numbers, editable outbound email,
// then Schedule / Send now on shared EmailBodyEditor. Extra form work under details.
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { CMA_QUEUE_READ_LIMIT, getCmaAdminReviewRowBySlug, getCmaProspectAsk, listActiveBrokersForCma, listCmaQueue } from '@/lib/data'
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
import { canOpenCmaDocument } from '@/lib/cma/draft-access'
import { applySlugStreetDirectional } from '@/lib/cma/address-slug'
import { CmaReviewDocumentButton } from '@/app/admin/(protected)/cmas/_components/CmaReviewDocumentButton'
import { CmaBuildWatch } from '@/app/admin/(protected)/cmas/_components/CmaBuildWatch'
import { CmaOutcomeCell, cmaOutcomeLeftAt } from '@/components/admin/cma/CmaOutcomeCell'
import { cmaProcessPlace } from '@/lib/cma/process-place'
import { getCmaOutcomes } from '@/lib/data/cma/outcomes'
import { classifyCmaOrigin, CMA_ORIGIN_INTENT, sendModeForOrigin, theirPriceLabelFor } from '@/lib/cma/origin'
import { buildCmaFirstContactForRow } from '@/lib/cma/first-contact-for-send'
import { readFirstContactOverride } from '@/lib/cma/first-contact-override'
import {
  cmaQueueFiltersFromSearch,
  cmaQueueHoldLine,
  cmaQueueHref,
  cmaQueueReachNote,
  cmaQueueWalk,
  cmaReviewHref,
  filterCmaQueueRows,
  resolveTheirPrice,
  sortCmaQueueRows,
  toCmaQueueViewRow,
} from '@/lib/cma/queue-view'
import { dripEtaFor, DRIP_CADENCE_LINE } from '@/lib/cma/drip-eta'
import { getSignatureForMailbox } from '@/lib/crm/email-signature'
import { cmaEmailGalleryUrls } from '@/lib/cma/email-gallery'
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
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!adminRole) redirect('/admin/access-denied')
  if (adminRole.role === 'report_viewer') redirect('/admin/access-denied')

  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const safeSlug = String(slug ?? '').trim().toLowerCase()
  const queueFilters = cmaQueueFiltersFromSearch(sp)
  const [row, brokerRows, queue] = await Promise.all([
    getCmaAdminReviewRowBySlug(safeSlug),
    listActiveBrokersForCma(),
    listCmaQueue({ limit: CMA_QUEUE_READ_LIMIT }).catch((err: unknown) => {
      console.error('[admin cma review walk]', err)
      return null
    }),
  ])
  if (!row) notFound()
  const mine = queue?.rows.find((item) => item.docKind === 'cma' && item.slug === safeSlug) ?? null
  const reachNote = mine ? cmaQueueReachNote(mine.contactReach) : null
  const holdLine = mine
    ? cmaQueueHoldLine({
        state: mine.state,
        reviewReason: mine.reviewReason,
        buildError: mine.buildError,
        auditSummary: mine.auditSummary,
        auditCriticalCount: mine.auditCriticalCount,
        holdKind: mine.holdKind,
      })
    : null
  const views = (queue?.rows ?? []).filter((item) => item.docKind === 'cma').map((item) => toCmaQueueViewRow(item))
  const filtered = sortCmaQueueRows(filterCmaQueueRows(views, queueFilters), queueFilters.sort)
  const pool = filtered.some((item) => item.slug === safeSlug)
    ? filtered
    : sortCmaQueueRows(filterCmaQueueRows(views, { state: mine?.state }), queueFilters.sort)
  const poolSlugs = pool.map((item) => item.slug)
  const walk = cmaQueueWalk(poolSlugs, safeSlug)
  const backHref = cmaQueueHref(walk.index >= 0 ? { ...queueFilters, page: walk.page } : queueFilters)
  const stepHref = (slug: string | null) => {
    if (!slug) return null
    return cmaReviewHref(slug, { ...queueFilters, page: cmaQueueWalk(poolSlugs, slug).page })
  }
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
  const isBuilding =
    !hasDocument && !buildError && String(row.html_path ?? '').startsWith('pending:')
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
  const contactEmail = (linkedPerson?.primaryEmail || (row.client_email as string | null) || '').trim()
  const canDeliver =
    hasDocument &&
    Boolean(contactEmail) &&
    auditVerdict !== 'fail' &&
    (status === 'draft' || status === 'finalized')
  const signingBroker = brokers.find((b) => b.slug === String(row.broker_slug ?? ''))
  const brokerRow = brokerRows.find((b) => String(b.slug) === String(row.broker_slug ?? ''))
  const fromMailbox =
    (typeof brokerRow?.email === 'string' && /@ryan-realty\.com$/i.test(brokerRow.email)
      ? brokerRow.email
      : null) || 'matt@ryan-realty.com'
  // The letter renderer adds the report button. The signature is only the signature.
  const signatureHtml = (await getSignatureForMailbox(fromMailbox))?.html ?? ''

  // Drip ETA when this CMA's prospect is currently queued.
  let inDrip = false
  let dripEtaLabel: string | null = null
  let dripCadence: string | null = null
  if (sendMode === 'drip') {
    const { listQueuedFirstTouch, getLastDripSentAt, findProspectForCmaSlug } = await import(
      '@/lib/data/prospecting/drip-queue'
    )
    const prospect = await findProspectForCmaSlug(safeSlug)
    if (prospect) {
      const [queued, last] = await Promise.all([listQueuedFirstTouch(500), getLastDripSentAt()])
      const eta = dripEtaFor({
        queued,
        lastDripSentAt: last,
        now: new Date(),
        target: prospect,
      })
      if (eta) {
        inDrip = true
        dripEtaLabel = eta.label
        dripCadence = eta.cadence
      }
    }
  }
  // What happened after it left. One letter, so the read stays even when the
  // row forgot its send stamp and only the email log has the send.
  const outcome = (await getCmaOutcomes([String(row.id)]))[String(row.id)] ?? null
  const leftAt = cmaOutcomeLeftAt(outcome)
  const countedSent = mine?.state === 'sent' || status === 'delivered' || Boolean(row.delivered_at)
  const place = cmaProcessPlace({
    building: isBuilding,
    buildFailed: Boolean(buildError),
    held: mine?.state === 'flagged' || mine?.state === 'audit-failed' || mine?.state === 'unvetted',
    inDrip,
    sent: Boolean(leftAt),
    countedSent: countedSent && !leftAt,
    hasDocument,
    hasEmail: Boolean(contactEmail),
    sendMode,
    origin,
  })

  const built = await buildCmaFirstContactForRow(row as Record<string, unknown>, {
    origin,
    brokerName: signingBroker?.displayName ?? 'Matt Ryan',
    brokerEmail: typeof brokerRow?.email === 'string' ? brokerRow.email : fromMailbox,
    lastListPrice: lastList,
  })
  const composed = built.copy
  const letterPhotos = origin === 'expired' ? await cmaEmailGalleryUrls(listingKey) : []
  const savedOverride = readFirstContactOverride(summary)
  const firstContact = {
    subject: savedOverride?.subject || composed.subject,
    bodyText: savedOverride?.bodyText || composed.bodyText,
  }

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
      <nav style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href={backHref} style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Back to this list
        </Link>
        {walk.index >= 0 ? (
          <span style={{ color: 'var(--a-text-2)', fontVariantNumeric: 'tabular-nums' }}>
            {walk.index + 1} of {walk.total}
          </span>
        ) : null}
        {walk.prev ? (
          <Link href={stepHref(walk.prev) ?? backHref} style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
            Previous letter
          </Link>
        ) : null}
        {walk.next ? (
          <Link href={stepHref(walk.next) ?? backHref} style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
            Next letter
          </Link>
        ) : null}
        <Link href="/admin/cmas" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          CMAs
        </Link>
        <Link href="/admin/cmas?state=ready" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Ready
        </Link>
        <Link href="/admin/cmas?state=queued" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          In drip
        </Link>
        <Link href="/admin/prospecting" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Prospecting
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
      {reachNote === 'text' ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '4px 0 0' }}>
          Confirmed cell. Nothing on this page sends a text.
        </p>
      ) : null}
      {reachNote === 'phone on file, not a confirmed cell' ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '4px 0 0' }}>
          A phone is on file. It is not a confirmed cell, so nothing on this page texts it.
        </p>
      ) : null}
      {reachNote === 'no email' ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '4px 0 0' }}>
          No email and no phone on file.
        </p>
      ) : null}
      <CmaBuildWatch building={isBuilding} />

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
          last build failed: {buildError}
        </p>
      ) : null}

      {holdLine ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)', margin: '12px 0 0', maxWidth: 640 }}>
          {holdLine}
        </p>
      ) : null}

      <SectionHead>Where this letter is</SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)', margin: '0 0 4px' }}>{place.where}</p>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 12px', maxWidth: 640 }}>
        {place.next}
      </p>
      {leftAt ? (
        <>
          <SectionHead>What happened</SectionHead>
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 12px' }}>
            Every stage this document reached after it left.
          </p>
          <CmaOutcomeCell outcome={outcome} variant="panel" />
          <div style={{ marginTop: 18 }} />
        </>
      ) : null}

      <SectionHead>{!hasDocument ? 'Letter' : leftAt ? 'The email' : 'Review and send'}</SectionHead>
      {hasDocument ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 12px' }}>
          {leftAt
            ? 'The email below is what this letter carries.'
            : 'Read the letter, then the email below. Nothing sends until you schedule or send it.'}
        </p>
      ) : null}
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
        origin={origin}
        sendMode={sendMode}
        inDrip={inDrip}
        dripEtaLabel={dripEtaLabel}
        dripCadence={dripCadence ?? (inDrip ? DRIP_CADENCE_LINE : null)}
        fromMailbox={fromMailbox}
        signatureHtml={signatureHtml}
        emailSubject={firstContact.subject}
        emailBody={firstContact.bodyText}
        letterSubject={composed.subject}
        letterPlain={composed.bodyText}
        letterMarkers={composed.bodyMarkers}
        letterParagraphs={composed.paragraphs}
        letterAddress={built.facts.address}
        letterPhotos={letterPhotos}
        canDeliver={canDeliver}
        scheduleNote={hasDocument && !leftAt ? place.next : null}
        focusRebuild={!hasDocument && !isBuilding}
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
    </div>
  )
}
