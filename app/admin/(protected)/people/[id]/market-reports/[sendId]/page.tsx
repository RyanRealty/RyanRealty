// @no-parity — internal admin surface, no public mockup contract
/**
 * One market report as it went out (Matt's decisions 2026-09-29: admins see
 * the same reports the contact sees). The stored copy from crm_report_sends,
 * which carries no open pixel and no click wraps, so opening it here never
 * counts as the contact opening it; and beside it, every figure the email
 * printed with its source, filter, as-of time and row count (CLAUDE.md §0).
 *
 * Scope: a broker only opens reports for contacts in their own book
 * (requirePersonInScope), and the report must belong to this contact.
 *
 * The stored copy carries the contact's LIVE links (her manage page, her
 * report unsubscribe, her web view). Framed here, every one of them is
 * re-signed as a PREVIEW link first (previewReportLinks, review 2026-09-30):
 * a broker clicking Resume or Stop in it changes nothing, and can never
 * record a restart or an opt-out as hers.
 *
 * Beside the figures: the §0 Spark cross-check the sender ran before this
 * send (or held it on), each figure with both values, the delta and the
 * population, and the Spark queries behind them.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { requirePersonInScope } from '@/app/actions/crm'
import { getMarketReportSendById, isInFlightSend } from '@/lib/data/crm/marketReportSends'
import { previewReportLinks } from '@/lib/email/report-link-token'
import type { SparkGateResult } from '@/lib/crm/market-report-spark-gate'
import { EntityTitle, QuietRow, ReportGrid, SectionHead } from '@/components/admin/v2'
import { formatDateTime } from '@/lib/format/date'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Market report · Console' }

type StoredFigure = {
  areaLabel?: unknown
  area?: unknown
  label?: unknown
  display?: unknown
  source?: unknown
  filter?: unknown
  as_of?: unknown
  n?: unknown
}

function text(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
}

const KIND_LABEL: Record<string, string> = { scheduled: 'Scheduled', manual: 'Sent by a broker', preview: 'Preview' }

/** The stored Spark check, read defensively (it is jsonb). */
function sparkOf(v: unknown): SparkGateResult | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Partial<SparkGateResult>
  return Array.isArray(r.checks) && typeof r.verdict === 'string' ? (r as SparkGateResult) : null
}

const SPARK_VERDICT: Record<string, string> = {
  ok: 'Every printed figure reconciled with Spark within 1%.',
  STOP: 'STOP: a printed figure differs from Spark by more than 1%. Held for Matt.',
  'not-reconciled': 'Not reconciled: a printed figure could not be rebuilt from Spark. Held for Matt.',
}

/** Links in the framed copy open in a new tab; the base goes inside <head> so the doctype still leads. */
function framedDocument(html: string): string {
  const base = '<base target="_blank">'
  const head = /<head[^>]*>/i.exec(html)
  if (!head) return `${base}${html}`
  const at = head.index + head[0].length
  return `${html.slice(0, at)}${base}${html.slice(at)}`
}

export default async function MarketReportSendPage({
  params,
}: {
  params: Promise<{ id: string; sendId: string }>
}) {
  const ctx = await requireAdminPage('people.view')
  const { id, sendId } = await params
  const pid = Number(id)
  const sid = Number(sendId)
  if (!Number.isInteger(pid) || pid <= 0 || !Number.isInteger(sid) || sid <= 0) notFound()

  const inScope = await requirePersonInScope(pid, { email: ctx.email, role: ctx.role, brokerSlug: ctx.brokerSlug })
  if (!inScope.ok) notFound()

  const send = await getMarketReportSendById(sid)
  if (!send || send.personId !== pid) notFound()

  const figures = (Array.isArray(send.figures) ? send.figures : []) as StoredFigure[]
  const spark = sparkOf(send.sparkCheck)
  const status =
    send.status === 'sent'
      ? `Sent ${send.sentAt ? formatDateTime(send.sentAt) : ''}`.trim()
      : send.status === 'held'
        ? `Held (${send.holdReason ?? 'held'})${send.error ? `: ${send.error}` : ''}`
        : isInFlightSend(send)
          ? `Sending, not confirmed (counted as delivered, and never sent twice)${send.error && send.error !== 'sending' ? `. ${send.error}` : ''}`
          : `Failed${send.error ? `: ${send.error}` : ''}`
  // Her live links, re-signed as preview links before a broker can click them.
  let framed: string | null = null
  if (send.html) {
    try {
      framed = framedDocument(previewReportLinks(send.html))
    } catch (e) {
      console.error('[market-report send page] could not re-sign the stored links', e instanceof Error ? e.message : e)
    }
  }

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <p style={{ margin: '0 0 8px', fontSize: 'var(--a-text-sm)' }}>
        <Link href={`/admin/people/${pid}#market-report`}>Back to the contact</Link>
      </p>
      <EntityTitle>{send.subject ?? 'Market report'}</EntityTitle>

      <ul className="av2-quietlist">
        <QuietRow name="Kind" state={KIND_LABEL[send.kind] ?? send.kind} />
        <QuietRow name="Status" state={status} />
        <QuietRow name="To" state={send.recipientEmail ?? 'Not recorded'} />
        <QuietRow name="From" state={send.broker ?? 'Not recorded'} />
        <QuietRow name="Attempted" state={formatDateTime(send.attemptedAt)} />
        {send.messageId ? <QuietRow name="Message id" state={send.messageId} /> : null}
        {send.emailKey ? <QuietRow name="Email key" state={send.emailKey} /> : null}
      </ul>

      <SectionHead>The email</SectionHead>
      {framed ? (
        <>
          <p className="av2-sysnote" style={{ padding: '0 0 8px' }}>
            Its links open as a broker preview: nothing clicked here changes the contact&apos;s settings.
          </p>
          <iframe
            title="The market report email as sent"
            srcDoc={framed}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            style={{ width: '100%', height: 1400, border: '1px solid var(--a-border)', borderRadius: 10 }}
          />
        </>
      ) : (
        <p className="av2-sysnote" style={{ padding: 12 }}>
          {send.html
            ? 'The stored copy could not be shown safely here (its links could not be re-signed as a preview).'
            : 'No stored copy: this attempt was held before an email was built.'}
        </p>
      )}

      <SectionHead>Figures and sources</SectionHead>
      <ReportGrid
        label="Every figure the email printed"
        columns={[
          { key: 'area', label: 'Area' },
          { key: 'label', label: 'Figure' },
          { key: 'display', label: 'Shown', numeric: true },
          { key: 'source', label: 'Source and filter' },
          { key: 'asof', label: 'As of' },
          { key: 'n', label: 'Rows', numeric: true },
        ]}
        template="minmax(110px,0.8fr) minmax(160px,1.2fr) 110px minmax(260px,2.4fr) minmax(120px,0.9fr) 70px"
        minWidth={900}
        rows={figures.map((f, i) => ({
          key: `${text(f.area)}-${text(f.label)}-${i}`,
          cells: [
            text(f.areaLabel) || text(f.area),
            text(f.label),
            text(f.display),
            [text(f.source), text(f.filter)].filter(Boolean).join(' · '),
            text(f.as_of),
            text(f.n),
          ],
        }))}
        empty="No figures recorded for this attempt."
      />

      <SectionHead>Spark cross-check (CLAUDE.md §0)</SectionHead>
      {spark ? (
        <>
          <p className="av2-sysnote" style={{ padding: '0 0 8px' }}>
            {SPARK_VERDICT[spark.verdict] ?? spark.verdict}
            {spark.error ? ` The check could not run: ${spark.error}` : ''} Rule: {spark.rule}
          </p>
          <ReportGrid
            label="Each printed figure rebuilt from Spark"
            columns={[
              { key: 'status', label: 'Result' },
              { key: 'figure', label: 'Figure' },
              { key: 'printed', label: 'Printed', numeric: true },
              { key: 'spark', label: 'Spark', numeric: true },
              { key: 'delta', label: 'Delta', numeric: true },
              { key: 'population', label: 'Population and note' },
            ]}
            template="110px minmax(160px,1.2fr) 100px 100px 90px minmax(300px,2.6fr)"
            minWidth={960}
            rows={spark.checks.map((c, i) => ({
              key: `${c.area ?? 'report'}-${c.figure}-${i}`,
              cells: [
                c.status,
                `${c.area ?? 'report'} · ${c.figure}`,
                text(c.supabase),
                text(c.spark),
                c.deltaPoints != null ? `${c.deltaPoints} pts` : c.deltaPct != null ? `${c.deltaPct}%` : '',
                [c.population, c.note].filter(Boolean).join(' · '),
              ],
            }))}
            empty="No figure was checked (see the result above)."
          />
          {spark.queries.length > 0 ? (
            <ul className="av2-quietlist">
              {spark.queries.map((q, i) => (
                <QuietRow key={`${q.kind}-${i}`} name={`${q.kind}, ${q.rows} of ${q.total_rows ?? 'n/a'} rows`} state={q.filter} />
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="av2-sysnote" style={{ padding: 12 }}>
          No Spark cross-check is recorded for this attempt (it was held before the check ran, or it predates the check).
        </p>
      )}
    </div>
  )
}
