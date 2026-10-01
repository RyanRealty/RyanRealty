/**
 * The texts the owner gets about closed sales the MLS removed (Matt 2026-09-30:
 * "The daily check deletes it after saving the full record, and texts you what
 * it removed").
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

function sales(n: number): string {
  return n === 1 ? '1 closed sale' : `${n} closed sales`
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

/** The text for one kind of notice: sales deleted, or deleted sales the MLS serves again. */
export function noticeText(kind: MlsRemovalNotice['kind'], notices: MlsRemovalNotice[]): string {
  const n = notices.length
  const head =
    kind === 'removed'
      ? `The MLS no longer has ${sales(n)}, so ${n === 1 ? 'it was' : 'they were'} removed from our site, reports and CMAs. Full records saved (repair log ${logIds(notices)}).`
      : `The MLS has ${sales(n)} again that ${n === 1 ? 'was' : 'were'} removed as gone, so ${n === 1 ? 'it is' : 'they are'} back on our site from the saved record${n === 1 ? '' : 's'} (repair log ${logIds(notices)}).`
  return fit(head, notices.map(saleLine))
}

/** The text when sales were due but none were removed. */
export function heldSalesText(h: { reason: 'budget' | 'hold'; due: number; held: number; budget: number | null }): string {
  if (h.reason === 'budget') {
    const room =
      h.budget == null || h.budget <= 0
        ? 'and the daily check may remove no more today'
        : `more than the ${h.budget} the daily check may still remove today`
    return `${sales(h.due)} the MLS no longer has ${h.due === 1 ? 'is' : 'are'} due to be removed, ${room}, so it removed none and is holding ${h.due === 1 ? 'it' : 'them'}. ${h.due === 1 ? 'It stays' : 'They stay'} out of the market report, and while ${h.due === 1 ? 'it is' : 'they are'} still missing, nothing more is removed until someone checks and approves.`
  }
  return `${sales(h.held)} the MLS no longer has ${h.held === 1 ? 'is' : 'are'} held until someone checks and approves the removal, so the daily check removed none today. ${h.held === 1 ? 'It stays' : 'They stay'} out of the market report meanwhile.`
}

/**
 * The text when the deletion step failed. It may have failed after the delete
 * committed (the answer lost on the way back), so it never says nothing was
 * removed: any sale that was is texted on its own, from the log.
 */
export function removalFailedText(message: string): string {
  return `The daily check hit an error removing the closed sales the MLS no longer has: ${message.slice(0, 160)}. Any it did remove are texted separately; the rest stay out of the market report, and it tries again tomorrow.`
}
