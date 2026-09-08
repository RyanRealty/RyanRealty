/**
 * THE BROKER GATE, on the broker's own view of the document.
 *
 * tasteReview round three, §2: two of the four exemplars carry
 * `needsReview: true` and render as finished opinions. 19968's own reason
 * reads "the recommendation ... makes the recommendation indefensible"; 65365
 * Concorde's reads "a broker should confirm the comp selection before this
 * goes to a client." Neither string, nor the word confidence, nor any caveat
 * appears anywhere in either rendered document — so a row the audit flagged is
 * indistinguishable, to a reader AND to Matt, from a clean one.
 *
 * The remedy is a gate the broker sees and the client never does. This banner
 * renders ONLY on `/admin/cmas/[slug]/view`, never on `/cma/[slug]` — not even
 * when the person opening the public link happens to hold an admin session.
 * The reasons are an internal audit's words; a seller reading "indefensible"
 * about their own home is a worse outcome than the one being fixed.
 */

import { escapeHtml } from '@/lib/cma/render-blocks'

const esc = escapeHtml

export type PricingReview = {
  needsReview: boolean
  reasons: string[]
  auditVerdict: string | null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function reasonList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter((s): s is string => s != null)
  const one = str(v)
  return one ? [one] : []
}

/**
 * `pricing.review`, with the two older fields as the fallback.
 *
 * The pricing side is landing `review {needsReview, reasons, auditVerdict}` in
 * this cycle; every stored row already carries `needsReview` and
 * `reviewReason`, and those rows are the ones sitting in the queue today. Both
 * are read, so the gate works on what exists and on what is arriving.
 */
export function readPricingReview(pricing: unknown): PricingReview | null {
  const p = (pricing ?? null) as Record<string, unknown> | null
  if (!p || typeof p !== 'object') return null
  const block = (p.review ?? null) as Record<string, unknown> | null
  if (block && typeof block === 'object') {
    const needsReview = block.needsReview === true
    const reasons = reasonList(block.reasons ?? block.reason)
    const auditVerdict = str(block.auditVerdict)
    if (needsReview || reasons.length > 0 || auditVerdict) {
      return { needsReview: needsReview || reasons.length > 0, reasons, auditVerdict }
    }
  }
  if (p.needsReview !== true) return null
  return { needsReview: true, reasons: reasonList(p.reviewReason), auditVerdict: null }
}

/**
 * "Needs review before it goes out: …" — navy, at the top, unmissable.
 *
 * Inline styles, because it is injected into a finished document whose
 * stylesheet was written at render time; it must survive the letter, the
 * immersive and a frozen stored blob alike.
 */
export function adminReviewBannerHtml(pricing: unknown): string {
  const review = readPricingReview(pricing)
  if (!review || !review.needsReview) return ''
  const parts = [...review.reasons]
  if (review.auditVerdict) parts.push(review.auditVerdict)
  const body = parts.join(' ')
  return `<div class="cma-review-gate" role="status" style="background:#102742;color:#faf8f4;padding:14px 20px;font:500 15px/1.45 Geist,system-ui,sans-serif">Needs review before it goes out${
    body ? `: ${esc(body)}` : '.'
  }</div>`
}

/** The banner above everything the document draws. */
export function injectAdminReviewBanner(html: string, banner: string): string {
  if (!banner) return html
  const open = /<body[^>]*>/i.exec(html)
  if (open?.index != null) {
    const at = open.index + open[0].length
    return `${html.slice(0, at)}${banner}${html.slice(at)}`
  }
  return `${banner}${html}`
}
