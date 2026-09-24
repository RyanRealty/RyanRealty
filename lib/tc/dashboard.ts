/**
 * The transactions dashboard, as data (Matt 2026-09-24: "we need to have a
 * beautiful dashboard that makes sense"; layout he picked: numbers on top,
 * then Needs you and Coming up side by side, then the pipeline by stage).
 *
 * Pure: every figure is derived from rows the page already read (the closings
 * board, the principal review queue, envelopes, queue counts). No I/O here, so
 * each number is testable and traces to one source row set (§0).
 */
import { dealCalendarItems } from './deal-calendar'
import { REVIEW_PATH, reviewHref } from './review-queue'

export type DashboardDeal = {
  id: string
  propertyKey: string
  address: string
  city: string | null
  brokerName: string | null
  stage: string
  stageDetail: string | null
  cycleKind: string | null
  listingDate: string | null
  contractAcceptanceDate: string | null
  escrowClosingDate: string | null
  actualClosingDate: string | null
  expirationDate: string | null
  inspectionDays: number | null
  financingDays: number | null
  salePrice: number | null
  listingPrice: number | null
  itemsTotal: number
  itemsInReview: number
  itemsRequired: number
  partyNames: string[]
}

export type DashboardReviewDeal = {
  propertyKey: string
  address: string
  items: Array<{ deadline: { dueIso: string; bankingDaysRemaining: number; overdue: boolean } | null }>
}

export type DashboardEnvelope = {
  id: string
  name: string
  status: string
  sentAt: string | null
  dealKey: string | null
  dealAddress: string | null
  recipientCount: number
  signedCount: number
}

export type DashboardInput = {
  deals: readonly DashboardDeal[]
  /** Null when the viewer is not the principal broker (the queue is theirs alone). */
  review: { deals: readonly DashboardReviewDeal[]; totalItems: number; overdueItems: number } | null
  envelopes: readonly DashboardEnvelope[]
  mailQueue: number
  documentReview: number
  /** YYYY-MM-DD, America/Los_Angeles. */
  today: string
}

export type StatTile = {
  key: 'listings' | 'contract' | 'closing' | 'closed' | 'review'
  label: string
  value: number
  /** Second line: a dollar volume or a lateness count, already worded. */
  sub: string | null
  href: string
  tone: 'neutral' | 'attention' | 'danger'
}

export type NeedsYouItem = {
  key: string
  kind: string
  tone: 'accent' | 'waiting' | 'slow' | 'down'
  title: string
  context: string
  href: string
  action: string
  /** Lower sorts first. */
  rank: number
}

export type ComingUpItem = {
  key: string
  date: string
  label: string
  address: string
  href: string
  kind: string
  soon: boolean
}

export type PipelineCard = {
  id: string
  address: string
  city: string | null
  href: string
  broker: string | null
  brokerInitials: string
  price: number | null
  priceLabel: string
  line: string
  progress: { done: number; total: number } | null
  review: number
  missing: number
  flag: string | null
}

export type PipelineColumn = { key: string; label: string; cards: PipelineCard[]; total: number }

export type TransactionsDashboard = {
  verdict: string
  attention: number
  stats: StatTile[]
  needsYou: NeedsYouItem[]
  comingUp: ComingUpItem[]
  pipeline: PipelineColumn[]
}

const DAY = 86_400_000
const LIVE = new Set(['pending', 'pre_contract', 'active_listing'])
const CLOSED_WINDOW_DAYS = 60
const COMING_UP_DAYS = 21
const SOON_DAYS = 3

function dayNum(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(`${String(iso).slice(0, 10)}T12:00:00Z`)
  return Number.isFinite(t) ? Math.round(t / DAY) : null
}

function daysFrom(today: string, iso: string | null | undefined): number | null {
  const a = dayNum(today)
  const b = dayNum(iso)
  return a == null || b == null ? null : b - a
}

/** The alias harness's files ("TC TEST …") and the "1234 test street" placeholder, left out as the records audit does. */
export function isTestFile(d: { stageDetail: string | null; address: string }): boolean {
  return String(d.stageDetail ?? '').startsWith('TC TEST') || /^\d+\s+test\s+street\b/i.test(String(d.address))
}

export function dealHref(propertyKey: string, tab?: string, extra?: string): string {
  const base = `/admin/deals/${encodeURIComponent(propertyKey)}`
  const q = [tab ? `tab=${tab}` : null, extra ?? null].filter(Boolean).join('&')
  return q ? `${base}?${q}` : base
}

/** $2,012,000 → "$2.0M"; $539,000 → "$539K". Volume lines only; a single price prints exactly. */
export function compactMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

export function exactMoney(n: number | null | undefined): string {
  return n == null ? '' : `$${Math.round(n).toLocaleString('en-US')}`
}

export function initials(name: string | null | undefined): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** "Sep 26" from an ISO date, no time zone shift (the date is a calendar day). */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return ''
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[m - 1]} ${d}`
}

function inDays(n: number): string {
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}

const isClosed = (d: DashboardDeal) => d.stage === 'closed'
const isUnderContract = (d: DashboardDeal) => d.stage === 'pending'
const isListing = (d: DashboardDeal) => d.stage === 'active_listing'
const isPreContract = (d: DashboardDeal) => d.stage === 'pre_contract'
const street = (address: string) => address.split(',')[0].trim() || address
const openedFromMail = (d: DashboardDeal) => /^Opened from email/i.test(d.stageDetail ?? '')

function closedOn(d: DashboardDeal): string | null {
  return d.actualClosingDate ?? d.escrowClosingDate
}

export function buildTransactionsDashboard(input: DashboardInput): TransactionsDashboard {
  const { deals, today } = input
  const year = today.slice(0, 4)
  const listings = deals.filter(isListing)
  const contract = deals.filter(isUnderContract)
  const closingSoon = contract.filter((d) => {
    const n = daysFrom(today, d.escrowClosingDate)
    return n != null && n >= 0 && n <= 30
  })
  const closedThisYear = deals.filter((d) => isClosed(d) && (closedOn(d) ?? '').startsWith(year))
  const sum = (rows: DashboardDeal[], pick: (d: DashboardDeal) => number | null) =>
    rows.reduce((t, d) => t + (pick(d) ?? 0), 0)

  const stats: StatTile[] = [
    {
      key: 'listings',
      label: 'Active listings',
      value: listings.length,
      sub: listings.length ? `${compactMoney(sum(listings, (d) => d.listingPrice))} listed` : null,
      href: '/admin/closings#pipeline-listings',
      tone: 'neutral',
    },
    {
      key: 'contract',
      label: 'Under contract',
      value: contract.length,
      sub: contract.length ? `${compactMoney(sum(contract, (d) => d.salePrice ?? d.listingPrice))} in escrow` : null,
      href: '/admin/closings#pipeline-contract',
      tone: 'neutral',
    },
    {
      key: 'closing',
      label: 'Closing in 30 days',
      value: closingSoon.length,
      sub: closingSoon.length
        ? `next ${shortDate([...closingSoon].sort((a, b) => String(a.escrowClosingDate).localeCompare(String(b.escrowClosingDate)))[0].escrowClosingDate)}`
        : null,
      href: '/admin/closings#coming-up',
      tone: 'neutral',
    },
    {
      key: 'closed',
      label: `Closed in ${year}`,
      value: closedThisYear.length,
      sub: closedThisYear.length ? `${compactMoney(sum(closedThisYear, (d) => d.salePrice))} volume` : null,
      href: '/admin/closings/files?view=closed',
      tone: 'neutral',
    },
  ]
  if (input.review) {
    stats.push({
      key: 'review',
      label: 'Awaiting your review',
      value: input.review.totalItems,
      sub: input.review.overdueItems ? `${input.review.overdueItems} past 7 banking days` : input.review.totalItems ? 'all within 7 banking days' : null,
      href: REVIEW_PATH,
      tone: input.review.overdueItems ? 'danger' : input.review.totalItems ? 'attention' : 'neutral',
    })
  }

  // ── Needs you ──
  const needs: NeedsYouItem[] = []
  for (const r of input.review?.deals ?? []) {
    const n = r.items.length
    if (!n) continue
    const overdue = r.items.filter((i) => i.deadline?.overdue).length
    const soonest = r.items
      .map((i) => i.deadline)
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.bankingDaysRemaining - b.bankingDaysRemaining)[0]
    needs.push({
      key: `review:${r.propertyKey}`,
      kind: 'Review',
      tone: overdue ? 'down' : soonest && soonest.bankingDaysRemaining <= 2 ? 'slow' : 'accent',
      title: `${n} document${n === 1 ? '' : 's'} to review · ${street(r.address)}`,
      context: overdue
        ? `${overdue} past the 7-banking-day deadline (OAR 863-015-0140)`
        : soonest
          ? `due ${shortDate(soonest.dueIso)} · ${soonest.bankingDaysRemaining} banking day${soonest.bankingDaysRemaining === 1 ? '' : 's'} left`
          : 'no acceptance date on file to start the clock',
      // Review mode scoped to this file: the same queue these counts come from.
      href: reviewHref({ deal: r.propertyKey }),
      action: 'Review',
      rank: overdue ? 0 : 10 + (soonest?.bankingDaysRemaining ?? 7),
    })
  }
  for (const d of deals) {
    if (!LIVE.has(d.stage)) continue
    if (openedFromMail(d)) {
      needs.push({
        key: `confirm:${d.id}`,
        kind: 'New file',
        tone: 'slow',
        title: `Confirm side and stage · ${street(d.address)}`,
        context: 'Opened from email; nothing on file says which side we represent yet',
        href: dealHref(d.propertyKey),
        action: 'Open',
        rank: 5,
      })
    }
    if (d.itemsRequired > 0) {
      needs.push({
        key: `missing:${d.id}`,
        kind: 'Missing',
        tone: 'waiting',
        title: `${d.itemsRequired} required document${d.itemsRequired === 1 ? '' : 's'} missing · ${street(d.address)}`,
        context: `${d.brokerName ?? 'No broker'} · ${d.itemsTotal - d.itemsRequired - d.itemsInReview} of ${d.itemsTotal} checklist items done`,
        href: dealHref(d.propertyKey, 'documents', 'filter=missing'),
        action: 'Open checklist',
        rank: 40,
      })
    }
    if (isListing(d)) {
      const n = daysFrom(today, d.expirationDate)
      if (n != null && n >= 0 && n <= 14) {
        needs.push({
          key: `expires:${d.id}`,
          kind: 'Listing',
          tone: n <= 3 ? 'slow' : 'waiting',
          title: `Listing expires ${inDays(n)} · ${street(d.address)}`,
          context: `${shortDate(d.expirationDate)} · extend or let it expire`,
          href: dealHref(d.propertyKey),
          action: 'Open',
          rank: 30 + n,
        })
      }
    }
    if (isUnderContract(d)) {
      const n = daysFrom(today, d.escrowClosingDate)
      if (n != null && n < 0 && !d.actualClosingDate) {
        needs.push({
          key: `pastclose:${d.id}`,
          kind: 'Closing',
          tone: 'down',
          title: `Closing date passed · ${street(d.address)}`,
          context: `Set to close ${shortDate(d.escrowClosingDate)}; the file still reads under contract`,
          href: dealHref(d.propertyKey),
          action: 'Update',
          rank: 3,
        })
      }
    }
  }
  const waitingSig = input.envelopes.filter((e) => {
    if (e.status !== 'sent' && e.status !== 'partially_signed' && e.status !== 'awaiting_other_side') return false
    const n = e.sentAt ? daysFrom(today, e.sentAt) : null
    return n != null && n <= -2
  })
  for (const e of waitingSig) {
    const n = daysFrom(today, e.sentAt) ?? 0
    needs.push({
      key: `sig:${e.id}`,
      kind: 'Signatures',
      tone: 'waiting',
      title: `${e.name}${e.dealAddress ? ` · ${street(e.dealAddress)}` : ''}`,
      context: `${e.signedCount} of ${e.recipientCount} signed · sent ${-n} days ago`,
      href: `/admin/signing/${e.id}`,
      action: 'Open',
      rank: 50,
    })
  }
  if (input.mailQueue > 0) {
    needs.push({
      key: 'mail',
      kind: 'Email',
      tone: 'accent',
      title: `${input.mailQueue} email${input.mailQueue === 1 ? '' : 's'} to place on a file`,
      context: 'The filer could not tell which file these belong to',
      href: '/admin/closings/mail',
      action: 'Place',
      rank: 60,
    })
  }
  if (input.documentReview > 0) {
    needs.push({
      key: 'docs',
      kind: 'Documents',
      tone: 'accent',
      title: `${input.documentReview} document${input.documentReview === 1 ? '' : 's'} the reader flagged`,
      context: 'Missing signatures, disagreeing copies, or a form it could not place',
      href: '/admin/closings/documents',
      action: 'Check',
      rank: 70,
    })
  }
  needs.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title))

  // ── Coming up ──
  const coming: ComingUpItem[] = []
  for (const d of deals) {
    if (!LIVE.has(d.stage)) continue
    const items = dealCalendarItems({
      address: d.address,
      cycles: [
        {
          id: d.id,
          expiration_date: isListing(d) ? d.expirationDate : null,
          contract_acceptance_date: isUnderContract(d) || isPreContract(d) ? d.contractAcceptanceDate : null,
          escrow_closing_date: isUnderContract(d) ? d.escrowClosingDate : null,
          inspectionDays: d.inspectionDays,
          financingDays: d.financingDays,
        },
      ],
    })
    for (const it of items) {
      if (it.kind === 'contract_accepted') continue
      const n = daysFrom(today, it.date)
      if (n == null || n < 0 || n > COMING_UP_DAYS) continue
      coming.push({
        key: `${d.id}:${it.kind}:${it.date}`,
        date: it.date,
        label: it.title.replace(/\s·\s.*$/, ''),
        address: d.address,
        href: dealHref(d.propertyKey),
        kind: it.kind,
        soon: n <= SOON_DAYS,
      })
    }
  }
  coming.sort((a, b) => a.date.localeCompare(b.date) || a.address.localeCompare(b.address))

  // ── Pipeline ──
  const card = (d: DashboardDeal): PipelineCard => {
    const done = d.itemsTotal - d.itemsRequired - d.itemsInReview
    let line = ''
    let flag: string | null = null
    if (isListing(d)) {
      const listed = d.listingDate ? daysFrom(d.listingDate, today) : null
      const exp = daysFrom(today, d.expirationDate)
      line = [listed != null && listed >= 0 ? `Listed ${listed} days` : null, d.expirationDate ? `expires ${shortDate(d.expirationDate)}` : null]
        .filter(Boolean)
        .join(' · ')
      if (exp != null && exp >= 0 && exp <= 14) flag = `Expires ${inDays(exp)}`
    } else if (isUnderContract(d)) {
      const n = daysFrom(today, d.escrowClosingDate)
      line = d.escrowClosingDate ? `Closes ${shortDate(d.escrowClosingDate)}${n != null ? ` · ${inDays(n)}` : ''}` : 'No closing date on file'
      if (n != null && n < 0) flag = 'Closing date passed'
    } else if (isClosed(d)) {
      line = closedOn(d) ? `Closed ${shortDate(closedOn(d))}` : 'Closed'
    } else if (isPreContract(d)) {
      line = openedFromMail(d) ? 'Opened from email · confirm' : d.stageDetail ?? 'Before contract'
    }
    const price = isListing(d) ? d.listingPrice : d.salePrice ?? d.listingPrice
    return {
      id: d.id,
      address: d.address.split(',')[0].trim() || d.address,
      city: d.city,
      href: dealHref(d.propertyKey),
      broker: d.brokerName,
      brokerInitials: initials(d.brokerName),
      price,
      priceLabel: price != null ? exactMoney(price) : '',
      line,
      progress: d.itemsTotal ? { done, total: d.itemsTotal } : null,
      review: d.itemsInReview,
      missing: d.itemsRequired,
      flag,
    }
  }
  const recentClosed = deals
    .filter((d) => {
      if (!isClosed(d)) return false
      const n = daysFrom(today, closedOn(d))
      return n != null && n <= 0 && n >= -CLOSED_WINDOW_DAYS
    })
    .sort((a, b) => String(closedOn(b)).localeCompare(String(closedOn(a))))
  const byDate = (pick: (d: DashboardDeal) => string | null) => (a: DashboardDeal, b: DashboardDeal) =>
    String(pick(a) ?? '9999').localeCompare(String(pick(b) ?? '9999'))
  const pipeline: PipelineColumn[] = []
  const pre = deals.filter(isPreContract)
  if (pre.length) pipeline.push({ key: 'pre', label: 'Before contract', cards: pre.map(card), total: pre.length })
  pipeline.push({ key: 'listings', label: 'Active listings', cards: [...listings].sort(byDate((d) => d.expirationDate)).map(card), total: listings.length })
  pipeline.push({ key: 'contract', label: 'Under contract', cards: [...contract].sort(byDate((d) => d.escrowClosingDate)).map(card), total: contract.length })
  pipeline.push({ key: 'closed', label: `Closed, last ${CLOSED_WINDOW_DAYS} days`, cards: recentClosed.map(card), total: recentClosed.length })

  const attention = needs.filter((n) => n.tone === 'down' || n.tone === 'slow' || n.kind === 'Review').length
  const liveCount = listings.length + contract.length + pre.length
  const verdict = needs.length
    ? `${needs.length} thing${needs.length === 1 ? '' : 's'} need${needs.length === 1 ? 's' : ''} you · ${liveCount} live file${liveCount === 1 ? '' : 's'}`
    : `Nothing needs you · ${liveCount} live file${liveCount === 1 ? '' : 's'}`

  return { verdict, attention, stats, needsYou: needs, comingUp: coming, pipeline }
}
