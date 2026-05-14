/**
 * CMA draft review page.
 *
 * Reached by the assigned broker via the signed link in the auto-CMA review
 * email (sent by `lib/cma-delivery.ts` `processCmaDelivery`). Token in the
 * `?token=` query is HMAC-verified — no admin login required so the broker
 * can act from their phone in seconds.
 *
 * Renders:
 *   • lead identity (name, email, phone, timeline classification)
 *   • CMA value + range + confidence
 *   • signed link to download the generated PDF
 *   • the drafted email-to-lead body (HTML preview)
 *   • a Send-to-lead button (POSTs to /api/cma-drafts/<id>/send)
 *
 * If `status='sent'` already, shows the post-send confirmation instead.
 */

import { notFound } from 'next/navigation'

import { createServiceClient } from '@/lib/supabase/service'
import { verifyDeliveryToken } from '@/lib/cma-delivery-tokens'

import { SendCmaButton } from './SendCmaButton'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Review and send CMA — Ryan Realty',
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

function formatUsd(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return '—'
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
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
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-primary">Link not valid</h1>
        <p className="mt-3 text-foreground/80">
          This review link {verification.reason === 'expired' ? 'has expired' : "isn't valid"}.
          Have the broker request a fresh link from the admin queue.
        </p>
      </main>
    )
  }

  const sb = createServiceClient()
  const { data: row } = await sb
    .from('cma_deliveries')
    .select(
      'id, status, lead_email, lead_name, lead_phone, lead_timeline, lead_classification, raw_address, cma_estimated_value, cma_value_low, cma_value_high, cma_confidence, pdf_storage_path, assigned_broker_name, assigned_broker_email, email_subject, email_body_html, email_body_text, sent_at, created_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (!row) return notFound()
  const r = row as DeliveryRow

  // Signed PDF URL (5-minute lifetime; regenerated on every page load).
  let pdfDownloadUrl: string | null = null
  if (r.pdf_storage_path) {
    const { data: signed } = await sb.storage
      .from('cma-deliveries')
      .createSignedUrl(r.pdf_storage_path, 300)
    pdfDownloadUrl = signed?.signedUrl ?? null
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary/70">
          Ryan Realty · Auto-CMA
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
          {r.status === 'sent'
            ? 'CMA sent'
            : r.status === 'no_match'
              ? 'No MLS match — manual CMA needed'
              : 'Review and send the CMA'}
        </h1>
        <p className="mt-2 text-foreground/70">
          {r.lead_name ?? r.lead_email} · {r.raw_address}
        </p>
      </header>

      {/* ── Lead identity ── */}
      <section className="rounded-2xl border border-primary/10 bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-primary/70">
          Lead
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Dt label="Name" value={r.lead_name ?? '—'} />
          <Dt label="Email" value={r.lead_email} mono />
          <Dt label="Phone" value={r.lead_phone ?? '—'} mono />
          <Dt
            label="Timeline"
            value={`${r.lead_timeline ?? 'unspecified'} (${r.lead_classification ?? 'unknown'})`}
          />
        </dl>
      </section>

      {/* ── CMA result ── */}
      <section className="mt-6 rounded-2xl border border-primary/10 bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-primary/70">
          CMA estimate
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Estimated value
            </p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-primary">
              {formatUsd(r.cma_estimated_value)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Range</p>
            <p className="mt-1 tabular-nums text-foreground">
              {formatUsd(r.cma_value_low)} – {formatUsd(r.cma_value_high)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Confidence
            </p>
            <p className="mt-1 capitalize text-foreground">{r.cma_confidence ?? '—'}</p>
          </div>
        </div>
        {pdfDownloadUrl && (
          <p className="mt-4">
            <a
              href={pdfDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Open the generated PDF →
            </a>
          </p>
        )}
      </section>

      {/* ── Draft email preview ── */}
      {r.email_body_html && (
        <section className="mt-6 rounded-2xl border border-primary/10 bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-primary/70">
            Email to the lead
          </h2>
          <dl className="mt-3 mb-4 grid grid-cols-1 gap-2 text-sm">
            <Dt label="To" value={r.lead_email} mono />
            <Dt label="From" value={r.assigned_broker_email ?? 'Ryan Realty'} mono />
            <Dt label="Subject" value={r.email_subject ?? '—'} />
          </dl>
          <div
            className="rounded-xl border border-primary/10 bg-background p-5"
            dangerouslySetInnerHTML={{ __html: r.email_body_html }}
          />
        </section>
      )}

      {/* ── Action area ── */}
      <section className="mt-8">
        {r.status === 'sent' ? (
          <div className="rounded-2xl border border-primary/10 bg-card p-6 text-foreground/85">
            <p>
              Sent to <strong>{r.lead_email}</strong> on{' '}
              {r.sent_at ? new Date(r.sent_at).toLocaleString() : 'recently'}.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              A FUB note has been recorded against this lead.
            </p>
          </div>
        ) : r.status === 'no_match' ? (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 p-6 text-foreground/85">
            <p>
              We couldn&rsquo;t match this address to an MLS property record, so the auto-CMA
              didn&rsquo;t run.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Open the lead in Follow Up Boss to send a manual CMA.
            </p>
          </div>
        ) : (
          <SendCmaButton deliveryId={id} token={tokenStr ?? ''} />
        )}
      </section>
    </main>
  )
}

function Dt({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-0.5 ${mono ? 'font-mono text-sm' : 'text-base'} text-foreground`}>
        {value}
      </dd>
    </div>
  )
}
