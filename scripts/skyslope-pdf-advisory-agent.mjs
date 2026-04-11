/**
 * Multi-step **advisory** agent for SkySlope PDFs (Node, ESM).
 *
 * Pipeline (always in order):
 * 1. **Observe** — deterministic stats from `PdfInsight` (no model).
 * 2. **Curate** — capped excerpt of dual-pipeline text for the model context window.
 * 3. **Synthesize** — one xAI chat completion, JSON-shaped reply only.
 * 4. **Validate** — clamp and stringify; never throws to callers.
 *
 * Requires `XAI_API_KEY`. Enable from brief script with `SKYSLOPE_PDF_AGENT=1`.
 * Output is **not** legal or execution proof; it triages what a principal broker might read next.
 */

const XAI_URL = 'https://api.x.ai/v1/chat/completions'

/**
 * @param {import('./skyslope-pdf-insight.mjs').PdfInsight} insight
 */
function observeStep(insight) {
  return {
    ok: Boolean(insight?.ok),
    pageCount: insight?.pageCount ?? 0,
    pagesAnalyzed: insight?.pagesAnalyzed ?? 0,
    textDensity: insight?.textDensity ?? 'empty',
    charCount: insight?.charCount ?? 0,
    flagsLine: String(insight?.flagsLine || '').slice(0, 420),
    widgetSignLikeCount: insight?.widgetSignLikeCount ?? 0,
    lowTextPageRanges: String(insight?.lowTextPageRanges || '').slice(0, 200),
    ocrEngineNote: String(insight?.ocrEngineNote || '').slice(0, 200),
  }
}

/**
 * @param {import('./skyslope-pdf-insight.mjs').PdfInsight} insight
 * @param {number} maxChars
 */
function curateStep(insight, maxChars) {
  const text = String(insight?.text || '')
  const ocr = String(insight?.ocrSnippet || '')
  const budget = Math.max(2000, maxChars)
  const half = Math.floor(budget * 0.72)
  const t = text.length > half ? `${text.slice(0, half)}…[truncated]` : text
  const o = ocr.length > budget - half ? `${ocr.slice(0, budget - half)}…[truncated]` : ocr
  return { excerpt: t, ocrSnippet: o }
}

/**
 * @param {string} raw
 * @returns {string | null}
 */
export function extractFirstJsonObject(raw) {
  const t = String(raw || '').trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) return fence[1].trim()
  const i = t.indexOf('{')
  if (i < 0) return null
  let depth = 0
  for (let j = i; j < t.length; j++) {
    const c = t[j]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return t.slice(i, j + 1)
    }
  }
  return null
}

function validateStep(parsed) {
  const review_notes = String(parsed?.review_notes ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 520)
  const suggested_focus = String(parsed?.suggested_focus_for_human ?? parsed?.suggested_focus ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 260)
  let confidence = Number(parsed?.confidence)
  if (!Number.isFinite(confidence)) confidence = 0.5
  confidence = Math.min(1, Math.max(0, confidence))
  const rawRisks = parsed?.risk_signals
  const riskArr = Array.isArray(rawRisks) ? rawRisks : typeof rawRisks === 'string' ? [rawRisks] : []
  const risk_signals = riskArr
    .map((x) => String(x).replace(/\s+/g, ' ').trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 6)
  return { review_notes: review_notes || '—', suggested_focus, confidence, risk_signals }
}

/**
 * @param {{
 *   insight: import('./skyslope-pdf-insight.mjs').PdfInsight
 *   kind: string
 *   fileName: string
 *   section: string
 *   kindLabel: string
 *   xaiKey: string
 *   model?: string
 *   maxInputChars?: number
 * }} opts
 */
export async function runPdfAdvisoryAgent(opts) {
  const model = opts.model || process.env.SKYSLOPE_PDF_AGENT_MODEL || 'grok-2-1212'
  const maxInputChars = Math.min(
    48_000,
    Math.max(4000, Number.parseInt(String(opts.maxInputChars || process.env.SKYSLOPE_PDF_AGENT_MAX_INPUT_CHARS || '14000'), 10) || 14_000)
  )

  const observed = observeStep(opts.insight)
  const { excerpt, ocrSnippet } = curateStep(opts.insight, maxInputChars)

  const system = [
    'You are a triage assistant for a principal broker reviewing Oregon real estate PDFs from SkySlope Forms.',
    'You only receive extracted text snippets from an automated pdf.js plus OCR pipeline. You never saw the original file.',
    'Rules: Do not state that a document is legally executed or binding. Use cautious language (suggests, may warrant review).',
    'Reply with a single JSON object only, no markdown fences, no commentary. Keys exactly:',
    '{"review_notes":"string max 500 chars","risk_signals":["string", "... up to 6"],"suggested_focus_for_human":"string max 240 chars","confidence": number between 0 and 1}',
    'risk_signals must be short concrete bullets (e.g. heavy DocuSign markers, thin text layer, many signature widgets).',
  ].join(' ')

  const user = [
    `File name: ${opts.fileName}`,
    `Section: ${opts.section}`,
    `Inferred form bucket: ${opts.kindLabel} (internal kind ${opts.kind})`,
    `Observed stats JSON: ${JSON.stringify(observed)}`,
    'Dual-pipeline text excerpt (may be truncated):',
    excerpt,
    'OCR snippet (may be truncated):',
    ocrSnippet || '(none)',
  ].join('\n\n')

  try {
    const res = await fetch(XAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.xaiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 700,
        temperature: 0.25,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { ok: false, error: `xAI HTTP ${res.status} ${errText.slice(0, 200)}` }
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (content == null || typeof content !== 'string') {
      return { ok: false, error: 'No model content' }
    }

    const jsonStr = extractFirstJsonObject(content)
    if (!jsonStr) {
      return { ok: false, error: 'Model did not return JSON' }
    }

    let parsed
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      return { ok: false, error: 'Invalid JSON from model' }
    }

    const v = validateStep(parsed)
    return {
      ok: true,
      review_notes: v.review_notes,
      risk_signals: v.risk_signals,
      suggested_focus: v.suggested_focus,
      confidence: v.confidence,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
