/**
 * The one report button every CMA email carries, whether the broker sent the
 * composed first contact or typed their own note. Shared by the send rail
 * (lib/cma/send.ts) and the review page preview so what the broker previews
 * is what goes out.
 *
 * The composed note says "our price" and the button reads "See our price".
 * A broker note that never says that keeps "Read the full report". A button
 * with no sentence in front of it is a dead tap.
 */
import {
  EMAIL_BODY_MUTED,
  EMAIL_BORDER,
  EMAIL_CREAM,
  EMAIL_FONT_STACK,
  EMAIL_NAVY,
  EMAIL_SERIF,
} from '@/lib/email/brand'

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

export function cmaReportButtonHtml(viewUrl: string, label = 'Read the full report'): string {
  const href = escapeAttr(viewUrl)
  const safeLabel = escapeAttr(label)
  // Table cell holds the color. Outlook drops padding and background on an <a>.
  // The label is on the anchor and a span so Gmail keeps the cream type.
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;"><tr><td align="center" bgcolor="${EMAIL_NAVY}" style="background:${EMAIL_NAVY};"><a href="${href}" style="display:block;padding:18px 24px;font-family:${EMAIL_FONT_STACK};font-size:18px;line-height:1.3;font-weight:700;color:${EMAIL_CREAM};text-decoration:none;text-align:center;"><span style="color:${EMAIL_CREAM};">${safeLabel} &rarr;</span></a></td></tr></table>`
}

/**
 * Sales count, the sold range, and the city pulse when it was loaded.
 * Nested tables only. This sits under the photo and outside the letter,
 * so a later </div> in the letter cannot clip it. The list price is not here.
 */
export function cmaEmailStatsHtml(
  glance: { count: string | null; range: string | null; market: string | null },
  underPhoto = false,
): string {
  const rows: string[] = []
  if (glance.count) {
    rows.push(
      `<tr><td align="center" style="font-family:${EMAIL_FONT_STACK};font-size:12px;line-height:1.3;letter-spacing:0.08em;text-transform:uppercase;color:${EMAIL_BODY_MUTED};padding:0;">${escapeAttr(glance.count)}</td></tr>`,
    )
  }
  if (glance.range) {
    rows.push(
      `<tr><td align="center" style="font-family:${EMAIL_SERIF};font-size:18px;line-height:1.3;font-weight:700;color:${EMAIL_NAVY};padding:${glance.count ? '2px' : '0'} 0 0 0;">${escapeAttr(glance.range)}</td></tr>`,
    )
  }
  if (glance.market) {
    rows.push(
      `<tr><td align="center" style="font-family:${EMAIL_FONT_STACK};font-size:13px;line-height:1.45;color:${EMAIL_BODY_MUTED};padding:6px 0 0 0;">${escapeAttr(glance.market)}</td></tr>`,
    )
  }
  if (!rows.length) return ''
  const pad = underPhoto ? '10px 34px 0 34px' : '22px 34px 0 34px'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:${pad};"><table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table></td></tr></table>`
}

/**
 * The house, small, above the note. Spark's resizer only returns a 3:2 file,
 * so this asks for the 360×240 derivative and draws it at 240×160. A full-width
 * 3:2 photo pushes the price and the button off a phone. The shell hero is
 * not used: its 240px crop is the Old Mill frame, and Outlook ignores object-fit.
 */
export function cmaEmailPhotoHtml(url: string, alt: string): string {
  const spark = /cdn\.resize\.sparkplatform\.com/.test(url)
  const src = spark ? url.replace(/\/\d+x\d+\//, '/640x360/') : url
  const safeSrc = escapeAttr(src)
  const safeAlt = escapeAttr(alt).replace(/'/g, '&#39;')
  const dims = spark
    ? 'width="240" height="160" style="display:block;width:240px;max-width:100%;height:160px;border:0;"'
    : 'width="240" style="display:block;width:240px;max-width:100%;height:auto;border:0;"'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:22px 34px 0 34px;"><img src="${safeSrc}" alt="${safeAlt}" ${dims}></td></tr></table>`
}

/** The recommended price, set as type, so the number is not buried in a paragraph. */
export function cmaListPricePlate(amount: string): string {
  const safe = escapeAttr(amount)
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px 0;"><tr><td style="border-top:1px solid ${EMAIL_BORDER};border-bottom:1px solid ${EMAIL_BORDER};padding:14px 0 16px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:1.4;color:${EMAIL_BODY_MUTED};padding:0 0 2px 0;">We would list it at</td></tr><tr><td style="font-family:${EMAIL_SERIF};font-size:36px;line-height:1.15;font-weight:700;color:${EMAIL_NAVY};padding:0;">${safe}</td></tr></table></td></tr></table>`
}

/** The preheader for a broker-typed note: its first sentence, not the composed one. */
export function previewTextFromCustomBody(raw: string, fallback: string): string {
  const firstPara = raw.split(/\n{2,}/).map((p) => p.trim()).find((p) => p && !/^(hi|hello|hey|dear)\b/i.test(p))
  if (!firstPara) return fallback
  const sentence = firstPara.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? firstPara
  return sentence.length > 140 ? `${sentence.slice(0, 137).trimEnd()}…` : sentence
}
