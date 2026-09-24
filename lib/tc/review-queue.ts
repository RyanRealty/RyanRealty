/**
 * The principal broker's review mode, as pure logic (Matt 2026-09-24).
 *
 * SkySlope's Quick Audit walks the reviewer through a file one document at a
 * time. Its weak spot is that the order is SkySlope's, not the law's: nothing
 * puts the document closest to its 7-banking-day deadline (OAR
 * 863-015-0140(4)) in front first. This module flattens every item awaiting
 * review into ONE line, most urgent first, and says where the reviewer is in
 * it, so the page can sign off and step straight to the next.
 */
import type { ReviewDeadline } from './banking-days'

export type ReviewInputDoc = { id: string; name: string }

export type ReviewInputItem = {
  itemId: string
  name: string
  docs: ReviewInputDoc[]
  deadline: ReviewDeadline | null
  /** Where the cycle came from: 'skyslope' files are still reviewed in SkySlope until the cutover. */
  cycleSource?: string | null
}

export type ReviewInputDeal = {
  propertyKey: string
  address: string
  broker: string | null
  stage: string
  items: ReviewInputItem[]
}

export type UrgencyTone = 'down' | 'slow' | 'waiting'

export type Urgency = { word: string; tone: UrgencyTone; age: string; hot: boolean }

export type ReviewEntry = {
  itemId: string
  itemName: string
  propertyKey: string
  address: string
  broker: string | null
  stage: string
  docs: ReviewInputDoc[]
  deadline: ReviewDeadline | null
  cycleSource: string | null
  urgency: Urgency
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The deadline as one status word and an age line. */
export function urgencyWords(deadline: ReviewDeadline | null): Urgency {
  if (!deadline) return { word: 'No date', tone: 'waiting', age: 'no acceptance date', hot: false }
  const n = deadline.bankingDaysRemaining
  if (deadline.overdue) {
    const d = Math.abs(n)
    return { word: 'Overdue', tone: 'down', age: `${plural(d, 'banking day')} overdue`, hot: true }
  }
  if (n <= 2) return { word: 'Due soon', tone: 'slow', age: n === 0 ? 'due today' : `due in ${plural(n, 'banking day')}`, hot: false }
  return { word: 'Waiting', tone: 'waiting', age: `due in ${plural(n, 'banking day')}`, hot: false }
}

/** Lowest banking days remaining first; an item with no clock goes last. */
function rank(deadline: ReviewDeadline | null): number {
  return deadline ? deadline.bankingDaysRemaining : Number.POSITIVE_INFINITY
}

/**
 * Every item awaiting review in one line: overdue first (most overdue on top),
 * then soonest due, then items with no acceptance date. Items on the same file
 * stay together when their deadlines tie, in checklist order.
 */
export function orderReviewQueue(deals: ReviewInputDeal[], opts: { dealKey?: string | null } = {}): ReviewEntry[] {
  const entries: Array<{ entry: ReviewEntry; seq: number }> = []
  for (const d of deals) {
    if (opts.dealKey && d.propertyKey !== opts.dealKey) continue
    for (const it of d.items) {
      const entry: ReviewEntry = {
        itemId: it.itemId,
        itemName: it.name,
        propertyKey: d.propertyKey,
        address: d.address,
        broker: d.broker,
        stage: d.stage,
        docs: it.docs,
        deadline: it.deadline,
        cycleSource: it.cycleSource ?? null,
        urgency: urgencyWords(it.deadline),
      }
      entries.push({ entry, seq: entries.length })
    }
  }
  entries.sort((a, b) => {
    const r = rank(a.entry.deadline) - rank(b.entry.deadline)
    if (r) return r
    const addr = a.entry.address.localeCompare(b.entry.address)
    if (addr) return addr
    return a.seq - b.seq
  })
  return entries.map((e) => e.entry)
}

export type ReviewPosition = {
  /** Zero-based index of the item on screen; -1 when the queue is empty. */
  index: number
  current: ReviewEntry | null
  prev: ReviewEntry | null
  next: ReviewEntry | null
}

/**
 * Where the reviewer is. An item that is no longer in the queue (signed off in
 * another tab, or by the SkySlope pull) falls back to the top of the line
 * rather than an empty screen.
 */
export function reviewPosition(entries: ReviewEntry[], itemId: string | null | undefined): ReviewPosition {
  if (!entries.length) return { index: -1, current: null, prev: null, next: null }
  const found = itemId ? entries.findIndex((e) => e.itemId === itemId) : -1
  const index = found >= 0 ? found : 0
  return {
    index,
    current: entries[index],
    prev: index > 0 ? entries[index - 1] : null,
    next: index < entries.length - 1 ? entries[index + 1] : null,
  }
}

export const REVIEW_PATH = '/admin/sign-off/review'

/** A link inside review mode. `deal` keeps the queue scoped to one file. */
export function reviewHref(p: { item?: string | null; doc?: string | null; deal?: string | null }): string {
  const q = new URLSearchParams()
  if (p.deal) q.set('deal', p.deal)
  if (p.item) q.set('item', p.item)
  if (p.doc) q.set('doc', p.doc)
  const s = q.toString()
  return s ? `${REVIEW_PATH}?${s}` : REVIEW_PATH
}

/**
 * Where to land after a decision on the current item. The next item in line
 * if there is one; otherwise the top of what remains (items skipped earlier),
 * which is the "all caught up" screen once nothing is left.
 */
export function afterDecisionHref(pos: ReviewPosition, deal?: string | null): string {
  return reviewHref({ item: pos.next?.itemId ?? null, deal: deal ?? null })
}
