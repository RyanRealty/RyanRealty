// @no-parity — internal admin surface, no public mockup contract
// Prospecting (P9 roll:prospecting, IA lock 2026-08-05): the weekly outbound
// pass on the v2 language — expired audits + FSBO CMAs as ONE worklist whose
// buckets (sendable / needs-audit / no-phone / sent / excluded) come straight
// from lib/data/prospecting. Every row states its readiness or its block in
// plain words; sending happens ONLY on the prospect's own page through the
// prepared preview + full guard chain (first touch is always manual, Matt
// 2026-07-11 — nothing goes out from a list row). The legacy filter panel
// (city/price/date-range/sort) did not survive the amnesia rebuild: the weekly
// pass is scan → review → send, and the DAL still honors those params for any
// old shared URL.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { listProspects, classifyProspect, type ProspectBucket } from '@/lib/data'
import type { ProspectKind, ProspectRow, ProspectStatusFilter } from '@/lib/data/prospecting/types'
import { formatDate } from '@/lib/format/date'
import { Button, QueueRow, VerdictLine } from '@/components/admin/v2'
import type { AdminState } from '@/components/admin/v2'
import { buildProspectDocFromWorklist } from './actions'

export const dynamic = 'force-dynamic'
// "Build audit" runs the deterministic CMA builder inline (~30–60s); give the
// segment room so the form action never times out mid-build.
export const maxDuration = 300

const STATUSES: ProspectStatusFilter[] = ['all', 'sendable', 'needs-audit', 'no-phone', 'sent', 'excluded']
const PAGE_SIZE = 24

function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v
  const t = s?.trim()
  return t || undefined
}

function daysAgo(iso: string | null): string | undefined {
  if (!iso) return undefined
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (!Number.isFinite(days) || days < 0) return undefined
  return days === 0 ? 'today' : `${days}d`
}

function price(n: number | null): string | null {
  return n == null ? null : `$${Math.round(n).toLocaleString('en-US')}`
}

function hrefFor(kind: ProspectKind, status: ProspectStatusFilter, q: string | null, page?: number): string {
  const p = new URLSearchParams()
  if (kind !== 'expired') p.set('kind', kind)
  if (status !== 'all') p.set('status', status)
  if (q) p.set('q', q)
  if (page && page > 1) p.set('page', String(page))
  const qs = p.toString()
  return qs ? `/admin/prospecting?${qs}` : '/admin/prospecting'
}

/** The row's state word + tone, from the same rule the summary counts use. */
function rowState(row: ProspectRow, bucket: ProspectBucket): { word: string; tone: AdminState } {
  if (bucket === 'sent') return { word: 'Sent', tone: 'ok' }
  if (bucket === 'sendable') return { word: 'Send', tone: 'ok' }
  if (bucket === 'no-phone') return { word: 'No phone', tone: 'waiting' }
  if (bucket === 'excluded') return { word: 'Blocked', tone: 'down' }
  if (row.doc.state === 'building') return { word: 'Building', tone: 'waiting' }
  if (row.doc.state === 'failed') return { word: 'Failed', tone: 'down' }
  return { word: 'Build', tone: 'waiting' }
}

/** Plain-words readiness line — why this row can send, or exactly what stops it. */
function rowContext(row: ProspectRow, bucket: ProspectBucket): string {
  const bits: string[] = []
  if (row.ownerName) bits.push(row.ownerName)
  const listed = price(row.listPrice)
  if (listed) bits.push(`listed ${listed}`)

  if (bucket === 'sendable') {
    const doc = row.doc
    const rec = doc.state === 'ready' ? price(doc.recommendedList) : null
    bits.push(rec ? `audit ready, recommends ${rec}` : 'audit ready')
    bits.push('phone on file')
  } else if (bucket === 'needs-audit') {
    if (row.doc.state === 'building') bits.push('audit building now')
    else if (row.doc.state === 'failed') bits.push(`build failed: ${row.doc.reason ?? 'unknown error'}`)
    else bits.push('no audit yet, build it first')
  } else if (bucket === 'no-phone') {
    bits.push('audit ready, no phone on file')
    if (!row.compliance.channels.email.blocked) bits.push('email is open')
  } else if (bucket === 'excluded') {
    const reasons = row.compliance.reasons
    bits.push(reasons.length > 0 ? reasons.join(' · ') : 'blocked')
  } else if (bucket === 'sent') {
    const doc = row.doc
    if (doc.state === 'sent') {
      const via = [doc.smsSentAt ? 'text' : null, doc.emailSentAt ? 'email' : null].filter(Boolean).join(' + ')
      bits.push(`intro sent${via ? ` by ${via}` : ''} ${formatDate(doc.sentAt)}`)
    }
    const e = row.engagement
    const activity = [
      e.reportViews > 0 ? `${e.reportViews} doc view${e.reportViews === 1 ? '' : 's'}` : null,
      e.linkTaps > 0 ? `${e.linkTaps} link tap${e.linkTaps === 1 ? '' : 's'}` : null,
      e.emailOpens > 0 ? `${e.emailOpens} email open${e.emailOpens === 1 ? '' : 's'}` : null,
    ].filter(Boolean)
    if (activity.length > 0) bits.push(activity.join(' · '))
  }
  return bits.join(' · ')
}

export default async function ProspectingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminPage('prospecting.view')
  const sp = await searchParams

  const kind: ProspectKind = str(sp.kind) === 'fsbo' ? 'fsbo' : 'expired'
  const statusRaw = str(sp.status)
  const status: ProspectStatusFilter = STATUSES.includes(statusRaw as ProspectStatusFilter)
    ? (statusRaw as ProspectStatusFilter)
    : 'all'
  const q = str(sp.q) ?? null
  const page = Math.max(1, Number(str(sp.page) ?? '1') || 1)

  const result = await listProspects({ kind, q, status, sort: 'date', dir: 'desc', page, pageSize: PAGE_SIZE })
  const { summary } = result
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE))

  const kindLabel = kind === 'expired' ? 'expired listings' : 'FSBOs'
  const chips: Array<{ status: ProspectStatusFilter; label: string; count: number }> = [
    { status: 'all', label: 'All', count: summary.total },
    { status: 'sendable', label: 'Ready to send', count: summary.sendable },
    { status: 'needs-audit', label: 'Needs audit', count: summary.needsAudit },
    { status: 'no-phone', label: 'No phone', count: summary.noPhone },
    { status: 'sent', label: 'Sent', count: summary.sent },
    { status: 'excluded', label: 'Blocked', count: summary.excluded },
  ]

  return (
    <main className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 'var(--a-text-xl)', fontWeight: 600, letterSpacing: '-0.01em' }}>Prospecting</h1>
      <div style={{ margin: '8px 0 4px' }}>
        <VerdictLine tone={summary.sendable > 0 || summary.needsAudit > 0 ? 'attention' : 'ok'}>
          {summary.sendable > 0 ? (
            <>
              <b>
                {summary.sendable} intro{summary.sendable === 1 ? '' : 's'} ready to send
              </b>{' '}
              across {kindLabel}. Open a row to review and send — nothing goes out on its own.
            </>
          ) : summary.needsAudit > 0 ? (
            <>
              <b>No intros ready.</b> {summary.needsAudit}{' '}
              {kind === 'expired'
                ? summary.needsAudit === 1
                  ? 'expired listing needs'
                  : 'expired listings need'
                : summary.needsAudit === 1
                  ? 'FSBO needs'
                  : 'FSBOs need'}{' '}
              an audit built first.
            </>
          ) : (
            <>
              <b>Nothing waiting on {kindLabel}.</b> {summary.sent} sent so far.
            </>
          )}
        </VerdictLine>
      </div>

      <nav className="av2-chiprow" aria-label="Prospect kind">
        {(['expired', 'fsbo'] as ProspectKind[]).map((k) => (
          <Link
            key={k}
            href={hrefFor(k, status, q)}
            className={`av2-chip${k === kind ? ' av2-chip--on' : ''}`}
            aria-current={k === kind ? 'page' : undefined}
          >
            {k === 'expired' ? 'Expired' : 'FSBO'}
          </Link>
        ))}
      </nav>

      <nav className="av2-chiprow" aria-label="Bucket">
        {chips.map((c) => (
          <Link
            key={c.status}
            href={hrefFor(kind, c.status, q)}
            className={`av2-chip${c.status === status ? ' av2-chip--on' : ''}`}
            aria-current={c.status === status ? 'page' : undefined}
          >
            {c.label} ({c.count})
          </Link>
        ))}
      </nav>

      <form method="GET" style={{ margin: '4px 0 16px' }}>
        {kind !== 'expired' ? <input type="hidden" name="kind" value={kind} /> : null}
        {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
        <input
          className="av2-input"
          style={{ width: '100%' }}
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by address or owner…"
          aria-label="Search prospects"
        />
      </form>

      <ul className="av2-queue">
        {result.rows.map((row) => {
          const bucket = classifyProspect(row.doc, row.compliance, row.sendable)
          const state = rowState(row, bucket)
          const openHref = `/admin/prospecting/${row.kind}/${encodeURIComponent(row.id)}`
          const needsBuild = bucket === 'needs-audit' && row.doc.state !== 'building'
          return (
            <QueueRow
              key={`${row.kind}:${row.id}`}
              kind={state.word}
              kindTone={state.tone}
              title={
                <Link href={openHref} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {/* `||` not `??` — FSBO scrapes can leave '' addresses */}
                  {row.streetAddress?.trim() || row.fullAddress?.trim() || 'Address pending'}
                  {row.city ? `, ${row.city}` : ''}
                </Link>
              }
              context={rowContext(row, bucket)}
              age={daysAgo(kind === 'expired' ? row.expiredAt : row.detectedAt)}
              action={
                bucket === 'sendable' ? (
                  <Link href={openHref} className="av2-btn" style={{ textDecoration: 'none' }}>
                    Review &amp; send
                  </Link>
                ) : needsBuild ? (
                  <span style={{ display: 'inline-flex', gap: 8 }}>
                    <form action={buildProspectDocFromWorklist}>
                      <input type="hidden" name="kind" value={row.kind} />
                      <input type="hidden" name="id" value={row.id} />
                      <Button variant="quiet" type="submit">
                        {row.doc.state === 'failed' ? 'Retry build' : 'Build audit'}
                      </Button>
                    </form>
                    <Link href={openHref} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                      Open
                    </Link>
                  </span>
                ) : (
                  <Link href={openHref} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                    Open
                  </Link>
                )
              }
            />
          )
        })}
        {result.rows.length === 0 ? (
          <li className="av2-sysnote" style={{ padding: 16 }}>
            {q
              ? 'No prospects match. Try fewer letters or a street name.'
              : status === 'all'
                ? `No ${kindLabel} captured yet.`
                : `Nothing in this bucket right now.`}
          </li>
        ) : null}
      </ul>

      {totalPages > 1 ? (
        <nav aria-label="Pages" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0 16px' }}>
          {page > 1 ? (
            <Link href={hrefFor(kind, status, q, page - 1)} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
              Newer
            </Link>
          ) : null}
          <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={hrefFor(kind, status, q, page + 1)} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
              Older
            </Link>
          ) : null}
        </nav>
      ) : null}

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        Valuation documents live in{' '}
        <Link href="/admin/cmas" style={{ color: 'var(--a-accent)' }}>
          CMAs
        </Link>{' '}
        and{' '}
        <Link href="/admin/bpo" style={{ color: 'var(--a-accent)' }}>
          price opinions
        </Link>
        .
      </p>
    </main>
  )
}
