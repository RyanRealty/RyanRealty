/**
 * The texts the owner gets about listings the MLS removed: closed sales (Matt
 * 2026-09-30: "The daily check deletes it after saving the full record, and
 * texts you what it removed") and listings for sale or under contract (Matt
 * 2026-10-01: "Treat like removed sales").
 *
 * A health text is cut at 600 characters (lib/data/crm/healthAlertQueue.ts),
 * after a `[crm-health:<key>] ` marker. So each text leads with the count and
 * where the saved records are, then lists as many sales as fit, then says how
 * many more there are: a long list never cuts off the pointer to the records.
 */
import { formatCalendarDay } from '@/lib/format/date'
import { formatPriceExact } from '@/lib/format/money'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import type { MlsRemovalNotice } from '@/lib/data/sync/closingsReconcile'

/** 600 characters, less the marker (`[crm-health:mls-restored-1234567] `) and room to spare. */
export const TEXT_BUDGET = 550

/** What a removal is about: a closed sale, or a listing for sale or under contract. */
export type RemovedKind = 'sale' | 'listing'

function sales(n: number): string {
  return n === 1 ? '1 closed sale' : `${n} closed sales`
}

function listings(n: number): string {
  return n === 1 ? '1 listing that was for sale or under contract' : `${n} listings that were for sale or under contract`
}

function things(what: RemovedKind, n: number): string {
  return what === 'sale' ? sales(n) : listings(n)
}

/**
 * A notice is about a listing, not a sale, when its saved row was not Closed;
 * a restore log does not record the status, so there a listing has no close
 * date or price.
 */
export function noticeKind(n: Pick<MlsRemovalNotice, 'status' | 'closeDate' | 'closePrice'>): RemovedKind {
  if (n.status) return n.status === 'Closed' ? 'sale' : 'listing'
  return n.closeDate || (n.closePrice != null && n.closePrice > 0) ? 'sale' : 'listing'
}

/** "15714 Tumble Weed Turn, Sisters, MLS 220217062, closed Mar 10, 2026, $960,000" */
export function saleLine(n: Pick<MlsRemovalNotice, 'listingKey' | 'listNumber' | 'streetNumber' | 'streetName' | 'city' | 'closeDate' | 'closePrice'>): string {
  const street = publishStreetLine({ streetNumber: n.streetNumber, streetName: n.streetName })
  const where = [street, n.city?.trim() || null].filter(Boolean).join(', ') || `listing ${n.listingKey}`
  const parts = [where, n.listNumber ? `MLS ${n.listNumber}` : null]
  if (n.closeDate) parts.push(`closed ${formatCalendarDay(n.closeDate)}`)
  if (n.closePrice != null && n.closePrice > 0) parts.push(formatPriceExact(n.closePrice))
  return parts.filter(Boolean).join(', ')
}

/** "61010 Ridge Rd, Bend, MLS 220205521, Active, listed $899,000" */
export function listingLine(n: Pick<MlsRemovalNotice, 'listingKey' | 'listNumber' | 'streetNumber' | 'streetName' | 'city' | 'status' | 'listPrice'>): string {
  const street = publishStreetLine({ streetNumber: n.streetNumber, streetName: n.streetName })
  const where = [street, n.city?.trim() || null].filter(Boolean).join(', ') || `listing ${n.listingKey}`
  const parts = [where, n.listNumber ? `MLS ${n.listNumber}` : null, n.status?.trim() || null]
  if (n.listPrice != null && n.listPrice > 0) parts.push(`listed ${formatPriceExact(n.listPrice)}`)
  return parts.filter(Boolean).join(', ')
}

/** The log ids, never as a range: other repair rows sit between them. */
function logIds(notices: Pick<MlsRemovalNotice, 'logId'>[]): string {
  const ids = [...new Set(notices.map((n) => n.logId))].sort((a, b) => a - b)
  if (ids.length === 1) return `id ${ids[0]}`
  if (ids.length <= 3) return `ids ${ids.join(', ')}`
  return `ids ${ids.slice(0, 3).join(', ')} and ${ids.length - 3} more`
}

/** Head line first, then each sale while the text stays inside the budget, then the rest as a count. */
function fit(head: string, lines: string[]): string {
  let text = head
  let shown = 0
  for (const line of lines) {
    const rest = lines.length - shown - 1
    const tail = rest > 0 ? `\nand ${rest} more` : ''
    if ((text + '\n' + line + tail).length > TEXT_BUDGET) break
    text += '\n' + line
    shown += 1
  }
  return shown < lines.length ? `${text}\nand ${lines.length - shown} more` : text
}

/**
 * The text for one kind of notice about one kind of listing: deleted, or
 * deleted and served by the MLS again. Sales and listings are told apart.
 */
export function noticeText(kind: MlsRemovalNotice['kind'], notices: MlsRemovalNotice[], what: RemovedKind = 'sale'): string {
  const n = notices.length
  const where = what === 'sale' ? 'our site, reports and CMAs' : 'our site and reports'
  const head =
    kind === 'removed'
      ? `The MLS no longer has ${things(what, n)}, so ${n === 1 ? 'it was' : 'they were'} removed from ${where}. Full records saved (repair log ${logIds(notices)}).`
      : `The MLS has ${things(what, n)} again that ${n === 1 ? 'was' : 'were'} removed as gone, so ${n === 1 ? 'it is' : 'they are'} back on our site from the saved record${n === 1 ? '' : 's'} (repair log ${logIds(notices)}).`
  return fit(head, notices.map(what === 'sale' ? saleLine : listingLine))
}

/** The text when removals were due but none were made. */
export function heldSalesText(
  h: { reason: 'budget' | 'hold'; due: number; held: number; budget: number | null },
  what: RemovedKind = 'sale',
): string {
  if (h.reason === 'budget') {
    const room =
      h.budget == null || h.budget <= 0
        ? 'and the daily check may remove no more today'
        : `more than the ${h.budget} the daily check may still remove today`
    return `${things(what, h.due)} the MLS no longer has ${h.due === 1 ? 'is' : 'are'} due to be removed, ${room}, so it removed none and is holding ${h.due === 1 ? 'it' : 'them'}. ${h.due === 1 ? 'It stays' : 'They stay'} out of the market report, and while ${h.due === 1 ? 'it is' : 'they are'} still missing, nothing more is removed until someone checks and approves.`
  }
  return `${things(what, h.held)} the MLS no longer has ${h.held === 1 ? 'is' : 'are'} held until someone checks and approves the removal, so the daily check removed none today. ${h.held === 1 ? 'It stays' : 'They stay'} out of the market report meanwhile.`
}

/**
 * The text when the deletion step failed. It may have failed after the delete
 * committed (the answer lost on the way back), so it never says nothing was
 * removed: any sale that was is texted on its own, from the log.
 */
export function removalFailedText(message: string, what: RemovedKind = 'sale'): string {
  const whose = what === 'sale' ? 'the closed sales' : 'the for-sale and under-contract listings'
  return `The daily check hit an error removing ${whose} the MLS no longer has: ${message.slice(0, 160)}. Any it did remove are texted separately; the rest stay out of the market report, and it tries again tomorrow.`
}

/** A step of the on-market rule other than the deletion (lib/sync/onMarketReconcile.ts). */
export type AbsentStep = 'record' | 'release' | 'rebuild'

/** The text when a step other than the deletion failed: what it means for the report until a run succeeds. */
export function absentStepFailedText(step: AbsentStep, message: string): string {
  const error = message.slice(0, 160)
  if (step === 'record') {
    return `The daily listings check hit an error recording the for-sale and under-contract listings the MLS no longer has: ${error}. It removed none today; any it had not recorded on an earlier day still count in the market report, and it tries again tomorrow.`
  }
  if (step === 'release') {
    return `The daily listings check hit an error putting back listings the MLS serves again: ${error}. They stay out of the market report until it does, and it tries again tomorrow.`
  }
  return `The daily listings check hit an error rebuilding the market report's homes for sale: ${error}. Until it does, a listing it recorded today still counts there and one the MLS serves again stays out; it tries again tomorrow.`
}
