/**
 * Match inbound mail/SMS onto a Vault deal + checklist.
 * Pure. No I/O. Live 2026-08-23: brokers do not log calls or uploads.
 */
import { DOC_RULES } from './required-documents'
import { envelopeCoversChecklistItem } from './required-signers'

export const LIVE_DEAL_STAGES = ['pending', 'pre_contract', 'active_listing'] as const

const STREET_STOP = new Set([
  'bend',
  'redmond',
  'oregon',
  'street',
  'avenue',
  'drive',
  'road',
  'lane',
  'way',
  'court',
  'place',
  'blvd',
  'the',
  'and',
  'sw',
  'nw',
  'se',
  'ne',
])

export type DealCommsCandidate = {
  dealId: string
  address: string
  stage: string
}

export function addressTokens(address: string): string[] {
  const num = address.match(/\d{3,}/)?.[0]
  const words = address
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STREET_STOP.has(w))
  return [...(num ? [num] : []), ...words.slice(0, 3)]
}

export function scoreDealHaystack(address: string, haystack: string): number {
  const h = haystack.toLowerCase()
  return addressTokens(address).reduce((n, t) => n + (h.includes(t) ? 1 : 0), 0)
}

export function pickDealForComms(
  deals: readonly DealCommsCandidate[],
  haystack: string,
): DealCommsCandidate | null {
  if (!deals.length) return null
  const live = deals.filter((d) => (LIVE_DEAL_STAGES as readonly string[]).includes(d.stage))
  const pool = live.length ? live : deals.filter((d) => d.stage !== 'dead')
  const use = pool.length ? pool : deals
  let best = use[0]
  let bestScore = scoreDealHaystack(best.address, haystack)
  for (const d of use.slice(1)) {
    const s = scoreDealHaystack(d.address, haystack)
    if (s > bestScore) {
      best = d
      bestScore = s
    }
  }
  return best
}

export type ChecklistCommsItem = {
  id: string
  name: string
  type_name: string | null
}

/** Checklist rows whose Oregon rule tokens appear in the mail/SMS/filename haystack. */
export function matchChecklistItems(
  items: readonly ChecklistCommsItem[],
  haystack: string,
): ChecklistCommsItem[] {
  const h = haystack.toLowerCase()
  const hitRules = DOC_RULES.filter((r) => r.matchAny.some((m) => h.includes(m.toLowerCase())))
  if (!hitRules.length) return []
  return items.filter((item) => {
    const blob = `${item.name} ${item.type_name ?? ''}`.toLowerCase()
    return hitRules.some(
      (r) =>
        r.label === item.name ||
        (r.orefForm != null && blob.includes(r.orefForm.toLowerCase())) ||
        r.matchAny.some((m) => blob.includes(m.toLowerCase())),
    )
  })
}

export function commsHaystack(input: {
  title?: string | null
  body?: string | null
  filenames?: readonly string[]
}): string {
  return [input.title ?? '', input.body ?? '', ...(input.filenames ?? [])].join(' ').slice(0, 12000)
}

export type MmsCommsPart = { mediaSid: string; contentType: string; url: string }

/** Twilio MMS PDFs to fetch immediately (URLs expire). Cap 3, same as Gmail. */
/** Other-side agent sending back an executed PDF (Signed SPD, executed addendum). Not our SkySlope notices. Hint only. */
export function looksLikeReturnedSignedPacket(haystack: string): boolean {
  const h = haystack.toLowerCase()
  if (/noreply@skyslope\.com/.test(h)) return false
  return /\b(signed|executed|fully[\s-]*executed)\b/.test(h)
}

export function shouldCompleteFromOtherSideReturn(input: {
  haystack: string
  hasPdf: boolean
  fromOtherSide: boolean
  executionState?: string | null
}): boolean {
  if (!input.hasPdf || !input.fromOtherSide) return false
  if (input.executionState === 'needs_our_signatures' || input.executionState === 'our_side_signed') {
    return false
  }
  if (input.executionState === 'fully_executed') return true
  return false
}

/** Only From (not To/Cc) counts as the other side sending a return. Our outbound to them is not a return. */
export function fromOtherSideContact(
  fromAddresses: readonly string[],
  otherSideEmails: ReadonlySet<string>,
): boolean {
  return fromAddresses.some((e) => otherSideEmails.has(e.trim().toLowerCase()))
}

export function pickWaitingEnvelopesForReturn(
  waiting: ReadonlyArray<{ id: string; name: string }>,
  haystack: string,
): Array<{ id: string; name: string }> {
  if (!waiting.length) return []
  if (waiting.length === 1) return [...waiting]
  const h = haystack.toLowerCase()
  const hit = waiting.filter((e) => {
    const n = e.name.toLowerCase()
    if (/disclosure|\bspd\b/.test(n) && /disclosure|\bspd\b/.test(h)) return true
    if (/sale agreement|purchase/.test(n) && /sale agreement|offer|\b001\b/.test(h)) return true
    return envelopeCoversChecklistItem({
      envelopeName: e.name,
      formNumbers: [],
      itemName: haystack,
      typeName: null,
    })
  })
  return hit
}

export function pdfMmsParts(media: readonly MmsCommsPart[]): MmsCommsPart[] {
  return media
    .filter((m) => {
      const mime = (m.contentType || '').toLowerCase()
      const url = (m.url || '').toLowerCase()
      return mime.includes('pdf') || url.includes('.pdf')
    })
    .slice(0, 3)
}
