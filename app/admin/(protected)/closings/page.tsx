// @no-parity — internal admin surface, no public mockup contract
// Closings — the transactions dashboard (Matt 2026-09-24: "the ui for this
// system is sooo bad, its just this long scrolling list" / "we need to have a
// beautiful dashboard that makes sense"). The layout is the one he picked:
// numbers you can open across the top, then Needs you beside Coming up, then
// the pipeline by stage. Closed and dead files moved to /admin/closings/files
// (All files) so this page never grows with history. Every figure comes from
// lib/tc/dashboard.ts buildTransactionsDashboard over rows read here (§0).
// Rooted in tc_deals (the one deal entity); SkySlope stays the live file for
// brokers until the cutover, and its daily intake keeps the Vault current.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { closingMatchesQuery, getClosingsBoard, type ClosingDealRow } from '@/lib/data/tc/closings'
import { getSkySlopeMirrorFreshness } from '@/lib/data/tc/skyslope-mirror'
import { countMailQueue } from '@/lib/data/tc/mail-reads'
import { getMailCoverage, type MailCoverageRow } from '@/lib/data/tc/mail-coverage'
import { countDocumentReview } from '@/lib/data/tc/document-review'
import { getPrincipalSignOffQueue } from '@/lib/data'
import { listOutstandingEnvelopes } from '@/lib/data/tc/envelope-overview'
import { formatDate, zonedDateKey } from '@/lib/format/date'
import { BROKER_FILE_EMAIL, dealVisibleToBroker, fileNameFromBrokerSlug } from '@/lib/tc/deal-scope'
import { buildTransactionsDashboard, isTestFile, shortDate, type ComingUpItem } from '@/lib/tc/dashboard'
import {
  Avatar,
  Button,
  HiddenField,
  Meter,
  Panel,
  QueueRow,
  ReportGrid,
  StateWord,
  SearchField,
  StatTiles,
  VerdictLine,
  type ReportColumn,
} from '@/components/admin/v2'
import { NewFileForm } from './NewFileForm'

export const dynamic = 'force-dynamic'

const COVERAGE_COLUMNS: ReportColumn[] = [
  { key: 'mailbox', label: 'Mailbox' },
  { key: 'total', label: 'Gmail total', numeric: true },
  { key: 'reviewed', label: 'Reviewed', numeric: true },
  { key: 'coverage', label: 'Coverage', numeric: true },
  { key: 'filed', label: 'Filed', numeric: true },
  { key: 'queued', label: 'Queued', numeric: true },
  { key: 'notDeal', label: 'Not deal', numeric: true },
  { key: 'bulk', label: 'Bulk', numeric: true },
  { key: 'errors', label: 'Errors', numeric: true },
  { key: 'last', label: 'Last reviewed' },
  { key: 'walk', label: 'Walk' },
]

function coverageRow(r: MailCoverageRow) {
  const queued = (r.byStatus.ambiguous ?? 0) + (r.byStatus.unfiled_transaction ?? 0)
  const filed = (r.byStatus.filed ?? 0) + (r.byStatus.kept_manual ?? 0)
  const coveragePct = r.gmailTotal ? Math.min(100, Math.round((r.reviewed / r.gmailTotal) * 100)) : null
  return {
    key: r.mailbox,
    cells: [
      r.mailbox,
      r.gmailTotal != null ? r.gmailTotal.toLocaleString('en-US') : '—',
      r.reviewed.toLocaleString('en-US'),
      coveragePct != null ? `${coveragePct}%` : '—',
      filed.toLocaleString('en-US'),
      queued.toLocaleString('en-US'),
      (r.byStatus.not_deal ?? 0).toLocaleString('en-US'),
      (r.byStatus.bulk ?? 0).toLocaleString('en-US'),
      (r.byStatus.error ?? 0).toLocaleString('en-US'),
      r.lastReviewedAt ? formatDate(r.lastReviewedAt.slice(0, 10)) : 'never',
      r.walkFinished ? 'finished' : r.walkStartedAt ? 'in progress' : 'not started',
    ],
  }
}

const STAGE_WORD: Record<string, string> = {
  pending: 'Under contract',
  pre_contract: 'Before contract',
  active_listing: 'Active listing',
  closed: 'Closed',
  dead: 'Dead',
}

function weekdayLabel(iso: string, today: string): string {
  if (iso === today) return 'Today'
  const t = Date.parse(`${today}T12:00:00Z`)
  if (iso === new Date(t + 86_400_000).toISOString().slice(0, 10)) return 'Tomorrow'
  const d = new Date(`${iso}T12:00:00Z`)
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]
  return `${wd} ${shortDate(iso)}`
}

function groupByDay(items: ComingUpItem[]): Array<{ day: string; items: ComingUpItem[] }> {
  const out: Array<{ day: string; items: ComingUpItem[] }> = []
  for (const it of items) {
    const last = out[out.length - 1]
    if (last && last.day === it.date) last.items.push(it)
    else out.push({ day: it.date, items: [it] })
  }
  return out
}

export default async function ClosingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mine?: string }>
}) {
  const ctx = await requireAdminPage('transactions.view')
  const { q, mine } = await searchParams
  const superuser = ctx.role === 'superuser'
  // Same mailbox scoping as app/actions/tc-mail.ts ctxForEdit(): superuser
  // reads every mailbox, a broker only their own, unmapped brokers see none.
  const mailbox = superuser ? null : BROKER_FILE_EMAIL[fileNameFromBrokerSlug(ctx.brokerSlug) ?? ''] ?? '__none__'
  const mineOnly = superuser && mine === '1'
  const canSee = (brokerName: string | null) =>
    dealVisibleToBroker({ role: mineOnly ? 'broker' : ctx.role, brokerSlug: ctx.brokerSlug, dealBrokerName: brokerName })

  const [board, mirror, mailQueueCount, mailCoverage, reviewQueue, envelopes, docReview] = await Promise.all([
    getClosingsBoard(),
    getSkySlopeMirrorFreshness(),
    countMailQueue(mailbox),
    superuser ? getMailCoverage() : Promise.resolve<MailCoverageRow[]>([]),
    superuser ? getPrincipalSignOffQueue() : Promise.resolve(null),
    listOutstandingEnvelopes(),
    countDocumentReview(canSee),
  ])
  const scoped = board.deals.filter((d) => canSee(d.brokerName) && !isTestFile(d))
  const query = q?.trim() ?? ''
  const matches = query ? scoped.filter((d) => closingMatchesQuery(d, query)) : []
  const today = zonedDateKey(new Date())

  const dash = buildTransactionsDashboard({
    deals: scoped,
    review:
      reviewQueue && reviewQueue.authorized
        ? {
            deals: reviewQueue.deals.filter((d) => scoped.some((s) => s.propertyKey === d.propertyKey)),
            totalItems: reviewQueue.totalItems,
            overdueItems: reviewQueue.overdueItems,
          }
        : null,
    envelopes: envelopes.filter((e) => canSee(e.brokerName) && (!e.dealKey || scoped.some((s) => s.propertyKey === e.dealKey))),
    mailQueue: mailQueueCount,
    documentReview: docReview,
    today,
  })
  const scopeHref = (m: boolean) => {
    const params = new URLSearchParams()
    if (m) params.set('mine', '1')
    if (query) params.set('q', query)
    const s = params.toString()
    return s ? `/admin/closings?${s}` : '/admin/closings'
  }
  const boardCols = Math.max(3, Math.min(4, dash.pipeline.length))

  return (
    <div className="av2-scope av2-wide">
      <div className="av2-filehead__row" style={{ alignItems: 'center', margin: '0 0 var(--a-s4)' }}>
        <div style={{ minWidth: 0 }}>
          {board.unreadable ? (
            <VerdictLine tone="attention">
              <b>The deal store is unreadable right now.</b> Do not assume anything below is complete.
            </VerdictLine>
          ) : (
            <VerdictLine tone={dash.needsYou.length ? 'attention' : 'ok'}>
              <b>{dash.verdict}</b>
            </VerdictLine>
          )}
          {superuser ? (
            <p style={{ fontSize: 'var(--a-text-sm)', margin: '4px 0 0', color: 'var(--a-text-2)' }}>
              {mineOnly ? 'Showing your files. ' : 'Showing every broker. '}
              <Link href={scopeHref(!mineOnly)} style={{ color: 'var(--a-accent)' }}>
                {mineOnly ? 'All brokers' : 'Mine only'}
              </Link>
              {' · '}
              <Link href="/admin/closings/files" style={{ color: 'var(--a-accent)' }}>
                All files
              </Link>
            </p>
          ) : (
            <p style={{ fontSize: 'var(--a-text-sm)', margin: '4px 0 0' }}>
              <Link href="/admin/closings/files" style={{ color: 'var(--a-accent)' }}>
                All files
              </Link>
            </p>
          )}
        </div>
        <div className="av2-filehead__actions">
          <form method="GET" role="search" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
            {mineOnly ? <HiddenField name="mine" value="1" /> : null}
            <SearchField aria-label="Find a file" name="q" defaultValue={query} placeholder="Find a file: address, MLS, client…" style={{ width: 280, maxWidth: '100%' }} />
            <Button type="submit" variant="quiet">
              Find
            </Button>
          </form>
          <NewFileForm />
        </div>
      </div>

      {query ? (
        <div style={{ margin: '0 0 var(--a-s6)' }}>
          <Panel
            title={`${matches.length} file${matches.length === 1 ? '' : 's'} match “${query}”`}
            aside={<Link href={mineOnly ? '/admin/closings?mine=1' : '/admin/closings'}>Clear</Link>}
          >
            {matches.length ? (
              <ul className="av2-queue">
                {matches.map((d: ClosingDealRow) => (
                    <QueueRow
                      key={d.id}
                      kind={STAGE_WORD[d.stage] ?? d.stage}
                      kindTone={d.stage === 'dead' ? 'down' : d.stage === 'closed' ? 'ok' : 'accent'}
                      title={
                        <Link href={`/admin/deals/${encodeURIComponent(d.propertyKey)}`} style={{ color: 'inherit' }}>
                          {d.address}
                        </Link>
                      }
                      context={[d.brokerName, d.partyNames.join(', '), d.mlsNumber ? `MLS ${d.mlsNumber}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                ))}
              </ul>
            ) : (
              <p className="av2-panel__empty">No file matches. Try part of the street, a client name, or the MLS number.</p>
            )}
          </Panel>
        </div>
      ) : null}

      <StatTiles items={dash.stats} />

      <div className="av2-cols">
        <Panel title="Needs you" aside={dash.needsYou.length ? `${dash.needsYou.length}` : null} id="needs-you">
          {dash.needsYou.length ? (
            <ul className="av2-queue">
              {dash.needsYou.map((n) => (
                  <QueueRow
                    key={n.key}
                    kind={n.kind}
                    kindTone={n.tone}
                    hot={n.tone === 'down'}
                    title={
                      <Link href={n.href} style={{ color: 'inherit' }}>
                        {n.title}
                      </Link>
                    }
                    context={n.context}
                    action={
                      <Link href={n.href} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                        {n.action}
                      </Link>
                    }
                  />
              ))}
            </ul>
          ) : (
            <p className="av2-panel__empty">Nothing is waiting on you. Every live file has its documents in and reviewed.</p>
          )}
        </Panel>

        <Panel title="Coming up" aside="next 3 weeks" id="coming-up">
          {dash.comingUp.length ? (
            <div className="av2-agenda">
              {groupByDay(dash.comingUp).map((g) => (
                <div key={g.day}>
                  <p className="av2-agenda__day">{weekdayLabel(g.day, today)}</p>
                  <ul className="av2-agenda" aria-label={weekdayLabel(g.day, today)}>
                    {g.items.map((it) => (
                      <li key={it.key} className="av2-agenda__row">
                        <span className="av2-agenda__what">{it.label}</span>
                        <Link href={it.href} className="av2-agenda__where">
                          {it.address.split(',')[0]}
                        </Link>
                        {it.soon ? <span className="av2-agenda__soon">soon</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="av2-panel__empty">No contract dates, closings or listing expirations in the next three weeks.</p>
          )}
        </Panel>
      </div>

      <section aria-label="Pipeline" id="pipeline" style={{ margin: '0 0 var(--a-s8)' }}>
        <div className="av2-board" style={{ ['--av2-board-cols' as string]: boardCols } as React.CSSProperties}>
          {dash.pipeline.map((col) => (
            <div key={col.key} className="av2-board__col" id={`pipeline-${col.key}`}>
              <p className="av2-board__h">
                <span>{col.label}</span>
                <span className="av2-board__n">{col.total}</span>
              </p>
              {col.cards.length ? (
                <ul className="av2-board__cards">
                  {col.cards.map((c) => (
                    <li key={c.id}>
                      <Link href={c.href} className="av2-fcard">
                        <span className="av2-fcard__top">
                          <span style={{ minWidth: 0 }}>
                            <span className="av2-fcard__addr">{c.address}</span>
                            {c.city ? <span className="av2-fcard__city">{c.city}</span> : null}
                          </span>
                          <Avatar initials={c.brokerInitials} title={c.broker} />
                        </span>
                        {c.priceLabel ? <span className="av2-fcard__price" style={{ display: 'block' }}>{c.priceLabel}</span> : null}
                        {c.line ? <span className="av2-fcard__line" style={{ display: 'block' }}>{c.line}</span> : null}
                        <span className="av2-fcard__foot">
                          {c.progress ? <Meter done={c.progress.done} total={c.progress.total} /> : null}
                          {c.flag ? <StateWord state="down">{c.flag}</StateWord> : null}
                          {c.review ? <StateWord state="slow">{c.review} to review</StateWord> : null}
                          {c.missing ? <StateWord state="waiting">{c.missing} missing</StateWord> : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="av2-board__empty">None right now.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {superuser && mailCoverage.length > 0 ? (
        <details className="av2-fold" style={{ margin: '0 0 var(--a-s4)' }}>
          <summary>Every message reviewed</summary>
          <div className="av2-fold__body">
            <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 10px' }}>
              Every message in every broker mailbox gets a decision recorded (filed, queued, or why it is not a deal)
              for the Real Estate Agency audit trail. The daily sweep keeps it current.
            </p>
            <ReportGrid
              label="Mail review coverage by mailbox"
              columns={COVERAGE_COLUMNS}
              template="minmax(160px, 1.4fr) repeat(9, minmax(64px, 1fr)) minmax(90px, 1fr)"
              minWidth={920}
              rows={mailCoverage.map(coverageRow)}
              empty="No mail has been reviewed yet."
            />
          </div>
        </details>
      ) : null}

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 'var(--a-s4) 0 0' }}>
        More:{' '}
        <Link href="/admin/closings/files" style={{ color: 'var(--a-accent)' }}>
          All files
        </Link>
        {' · '}
        <Link href="/admin/closings/mail" style={{ color: 'var(--a-accent)' }}>
          Mail to file{mailQueueCount > 0 ? ` (${mailQueueCount})` : ''}
        </Link>
        {' · '}
        <Link href="/admin/closings/documents" style={{ color: 'var(--a-accent)' }}>
          Documents to review
        </Link>
        {' · '}
        <Link href="/admin/closings/audit" style={{ color: 'var(--a-accent)' }}>
          Records audit
        </Link>
        {' · '}
        <Link href="/admin/closings/forms" style={{ color: 'var(--a-accent)' }}>
          Form registry
        </Link>
        {superuser ? (
          <>
            {' · '}
            <Link href="/admin/sign-off" style={{ color: 'var(--a-accent)' }}>
              Sign-off queue
            </Link>
          </>
        ) : null}
        {' · '}
        {mirror.status === 'unreadable'
          ? 'SkySlope recon mirror unreadable'
          : mirror.current
            ? `SkySlope recon mirror current (${mirror.rowCount} properties)`
            : `SkySlope recon mirror stale${mirror.latestSyncedAt ? ` since ${mirror.latestSyncedAt.slice(0, 10)}` : ''}`}
      </p>
    </div>
  )
}
