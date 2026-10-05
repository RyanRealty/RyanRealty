/**
 * The one "Get the full report" button every CMA email carries, whether the
 * broker sent the composed first contact or typed their own note. Shared by the
 * send rail (lib/cma/send.ts) and the review page preview so what the broker
 * previews is what goes out (send walk 2026-09-08: the preview of a custom
 * email showed no report link while the send appended one).
 *
 * It is a full-width button, not a small text link. The letter renderer places
 * one in the first screen and repeats the same action after the note.
 */
import { EMAIL_CREAM, EMAIL_FONT_STACK, EMAIL_NAVY } from '@/lib/email/brand'

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

export function cmaReportButtonHtml(viewUrl: string): string {
  const href = escapeAttr(viewUrl)
  // Table cell holds the color. Outlook drops padding and background on an <a>.
  // The label is on the anchor and a span so Gmail keeps the cream type.
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;"><tr><td align="center" bgcolor="${EMAIL_NAVY}" style="background:${EMAIL_NAVY};"><a href="${href}" style="display:block;padding:18px 24px;font-family:${EMAIL_FONT_STACK};font-size:18px;line-height:1.3;font-weight:700;color:${EMAIL_CREAM};text-decoration:none;text-align:center;"><span style="color:${EMAIL_CREAM};">Get the full report &rarr;</span></a></td></tr></table>`
}

/** The preheader for a broker-typed note: its first sentence, not the composed one. */
export function previewTextFromCustomBody(raw: string, fallback: string): string {
  const firstPara = raw.split(/\n{2,}/).map((p) => p.trim()).find((p) => p && !/^(hi|hello|hey|dear)\b/i.test(p))
  if (!firstPara) return fallback
  const sentence = firstPara.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? firstPara
  return sentence.length > 140 ? `${sentence.slice(0, 137).trimEnd()}…` : sentence
}
