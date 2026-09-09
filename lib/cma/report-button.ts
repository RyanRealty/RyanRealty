/**
 * The one "read the full report" button every CMA email carries, whether the
 * broker sent the composed first contact or typed their own note. Shared by the
 * send rail (lib/cma/send.ts) and the review page preview so what the broker
 * previews is what goes out (send walk 2026-09-08: the preview of a custom
 * email showed no report link while the send appended one).
 */
export function cmaReportButtonHtml(viewUrl: string): string {
  return `<p style="margin:0 0 24px 0;"><a href="${viewUrl}" style="display:inline-block;background:#102742;color:#faf8f4;font-size:13px;font-weight:700;letter-spacing:.08em;text-decoration:none;padding:14px 32px;">READ THE FULL REPORT &rarr;</a></p>`
}

/** The preheader for a broker-typed note: its first sentence, not the composed one. */
export function previewTextFromCustomBody(raw: string, fallback: string): string {
  const firstPara = raw.split(/\n{2,}/).map((p) => p.trim()).find((p) => p && !/^(hi|hello|hey|dear)\b/i.test(p))
  if (!firstPara) return fallback
  const sentence = firstPara.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? firstPara
  return sentence.length > 140 ? `${sentence.slice(0, 137).trimEnd()}…` : sentence
}
