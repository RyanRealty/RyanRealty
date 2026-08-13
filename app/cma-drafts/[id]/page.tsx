/**
 * CMA draft review page, on the v3 barrel.
 *
 * Reached by the assigned broker via the signed link in the auto-CMA review
 * email (sent by `lib/cma-delivery.ts` `processCmaDelivery`). Token in the
 * `?token=` query is HMAC-verified. No admin login.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet (status) then Instrument (the number) then Quiet (lead and email).
 * Send stays the existing POST. No sales Sheet.
 *
 * VISITOR OBJECTIVE: The assigned broker reviews the auto-drafted CMA from
 * their phone and sends it to the lead in one tap.
 * MACHINE OBJECTIVE: Move a queued CMA from draft to delivered inside the
 * 24-hour promise via the HMAC-signed review link.
 * EXITS: none on the public graph (noindex broker tool).
 *
 * THE PAGE CONTRACT: force-dynamic, robots noindex nofollow, HMAC token,
 * signed PDF URL, SendCmaButton POST to /api/cma-drafts/<id>/send.
 *
 * D11: no virtue names. No invented quote. Figures through lib/format
 * (formatPriceExact, formatDateTime) at the call line.
 */

import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyDeliveryToken } from '@/lib/cma-delivery-tokens'
import { formatPriceExact } from '@/lib/format/money'
import { formatDateTime } from '@/lib/format/date'
import { SendCmaButton } from './SendCmaButton'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
  type V3QuietItem,
} from '@/components/site/v3'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Review and send CMA | Ryan Realty',
  robots: { index: false, follow: false },
}

type DeliveryRow = {
  id: string
  status: string
  lead_email: string
  lead_name: string | null
  lead_phone: string | null
  lead_timeline: string | null
  lead_classification: string | null
  raw_address: string
  cma_estimated_value: number | null
  cma_value_low: number | null
  cma_value_high: number | null
  cma_confidence: string | null
  pdf_storage_path: string | null
  assigned_broker_name: string | null
  assigned_broker_email: string | null
  email_subject: string | null
  email_body_html: string | null
  email_body_text: string | null
  sent_at: string | null
  created_at: string
}

export default async function CmaDraftReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string | string[] }>
}) {
  const { id } = await params
  const { token } = await searchParams
  const tokenStr = Array.isArray(token) ? token[0] : token

  const verification = verifyDeliveryToken(id, tokenStr ?? null)
  if (!verification.ok) {
    const reason =
      verification.reason === 'expired'
        ? 'This review link has expired. Have the broker request a fresh link from the admin queue.'
        : 'This review link is not valid. Have the broker request a fresh link from the admin queue.'
    return (
      <>
        <main className={V3_ROOT_CLASS}>
          <V3SectionTracker pageType="utility" />
          <V3Quiet
            id="cma-draft"
            heading="Link not valid"
            headingLevel={1}
            items={[{ kind: 'prose', body: reason }]}
          />
        </main>
        {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
            when it is NOT nested in sectioning content, and <main> is sectioning
            content, so inside it the element is a generic and the page ships no
            contentinfo landmark. ci:default-chrome-footer counts footers without
            checking placement. */}
        <V3Footer columns={V3_FOOTER_COLUMNS} />
      </>
    )
  }

  const sb = createServiceClient()
  const { data: row } = await sb
    .from('cma_deliveries')
    .select(
      'id, status, lead_email, lead_name, lead_phone, lead_timeline, lead_classification, raw_address, cma_estimated_value, cma_value_low, cma_value_high, cma_confidence, pdf_storage_path, assigned_broker_name, assigned_broker_email, email_subject, email_body_html, email_body_text, sent_at, created_at',
    )
    .eq('id', id)
    .maybeSingle()

  if (!row) return notFound()
  const r = row as DeliveryRow

  let pdfDownloadUrl: string | null = null
  if (r.pdf_storage_path) {
    const { data: signed } = await sb.storage
      .from('cma-deliveries')
      .createSignedUrl(r.pdf_storage_path, 300)
    pdfDownloadUrl = signed?.signedUrl ?? null
  }

  const heading =
    r.status === 'sent'
      ? 'CMA sent'
      : r.status === 'no_match'
        ? 'No MLS match. Manual CMA needed'
        : 'Review and send the CMA'

  const who = (r.lead_name ?? r.lead_email).trim() || 'Lead'
  const address = r.raw_address.trim() || 'Address withheld'

  const quietLead: V3QuietItem[] = [
    { kind: 'prose', term: 'Lead', body: `${who}. ${address}` },
    { kind: 'prose', term: 'Email', body: r.lead_email },
    { kind: 'prose', term: 'Phone', body: (r.lead_phone ?? '').trim() || 'None on file' },
    {
      kind: 'prose',
      term: 'Timeline',
      body: `${r.lead_timeline ?? 'unspecified'} (${r.lead_classification ?? 'unknown'})`,
    },
  ]

  const figures: V3InstrumentFigure[] = []
  if (r.cma_estimated_value != null && Number.isFinite(r.cma_estimated_value) && r.cma_estimated_value > 0) {
    figures.push({
      value: v3Text(formatPriceExact(r.cma_estimated_value)),
      label: v3Text('estimated value'),
    })
  }
  if (r.cma_value_low != null && Number.isFinite(r.cma_value_low) && r.cma_value_low > 0) {
    figures.push({
      value: v3Text(formatPriceExact(r.cma_value_low)),
      label: v3Text('range low'),
    })
  }
  if (r.cma_value_high != null && Number.isFinite(r.cma_value_high) && r.cma_value_high > 0) {
    figures.push({
      value: v3Text(formatPriceExact(r.cma_value_high)),
      label: v3Text('range high'),
    })
  }
  const [firstFigure, ...restFigures] = figures

  const sentStamp = r.sent_at ? formatDateTime(r.sent_at) : null
  const quietAfter: V3QuietItem[] = []
  if (r.email_subject?.trim()) {
    quietAfter.push({ kind: 'prose', term: 'Subject', body: r.email_subject.trim() })
  }
  if (r.assigned_broker_email?.trim()) {
    quietAfter.push({
      kind: 'prose',
      term: 'From',
      body: r.assigned_broker_email.trim(),
    })
  }
  if (pdfDownloadUrl) {
    quietAfter.push({ label: 'Open the generated PDF', href: pdfDownloadUrl })
  }
  if (r.status === 'sent') {
    quietAfter.push({
      kind: 'prose',
      body: sentStamp
        ? `Sent to ${r.lead_email} on ${sentStamp}. This send is recorded on the lead.`
        : `Sent to ${r.lead_email}. This send is recorded on the lead.`,
    })
  } else if (r.status === 'no_match') {
    quietAfter.push({
      kind: 'prose',
      body: 'We could not match this address to an MLS property record, so the auto-CMA did not run. Open the lead in the CRM to send a manual CMA.',
    })
  }

  const confidence = (r.cma_confidence ?? '').trim()
  const source =
    'auto-CMA delivery row for this token, estimated value and range from cma_deliveries. Exact dollars, not rounded to thousands.' +
    (confidence ? ` Confidence ${confidence}.` : '')
  const leadItems = firstFigure ? quietLead : [...quietLead, ...quietAfter]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="utility" />
        <V3Quiet
          id="cma-draft"
          eyebrow="Ryan Realty auto-CMA"
          heading={heading}
          headingLevel={1}
          items={leadItems}
        />

        {firstFigure ? (
          <V3Instrument
            id="cma-value"
            level={2}
            headline={v3Text(address)}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(source)}
          />
        ) : null}

        {firstFigure && quietAfter.length > 0 ? (
          <V3Quiet id="cma-mail" heading="Email to the lead" items={quietAfter} />
        ) : null}

        {r.email_body_html ? (
          <div
            className="v3"
            dangerouslySetInnerHTML={{ __html: r.email_body_html }}
          />
        ) : null}

        {r.status !== 'sent' && r.status !== 'no_match' ? (
          <SendCmaButton deliveryId={id} token={tokenStr ?? ''} />
        ) : null}
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
