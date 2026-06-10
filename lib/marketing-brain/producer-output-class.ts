/**
 * Producer output classification + anti-fabrication system prompt.
 *
 * THE PROBLEM THIS SOLVES (root cause of producer slop, found 2026-05-29):
 * the producer-runtime cron and the admin one-shot both call the Anthropic
 * Messages API with NO tools and a system prompt that instructs the model to
 * RETURN a JSON object containing draft_path, citations[], and scorecard{}.
 * For a VISUAL producer (video / image / PDF / web page) the serverless
 * runtime cannot actually render anything (no Remotion / Chromium / PIL /
 * ffmpeg, 300s cap), so the model INVENTS those fields: a draft_path for a
 * file that was never written, citations for numbers never queried, a
 * scorecard for a video never rendered. That is fabricated verification data
 * and a direct violation of CLAUDE.md §0 (every number must trace to a live
 * query) and the anti-slop manifesto.
 *
 * THE FIX:
 *   - VISUAL producers are NOT executed by the cloud cron. They are left in
 *     'in_production' tagged awaiting_local_render so the local render worker
 *     (scripts/render-worker.mjs) can run the REAL generator on a machine that
 *     can render, producing a real artifact + real citations (live query) +
 *     real scorecard (actual render + first-frame gate).
 *   - TEXT producers (deliverable IS text — blog, listing description,
 *     ad copy, captions, CRM/ops side effects) may complete in the cloud, but
 *     the system prompt is hardened: numbers must come from the action
 *     payload (which the brain already data-verified before queuing) or be
 *     omitted — the model must NEVER invent a figure, and citations must trace
 *     to payload provenance, not be fabricated.
 *
 * Classification source of truth: the producer SKILL.md frontmatter
 * `output_type` field. See docs/PRODUCER_EXECUTOR_ARCHITECTURE_DECISION_2026-05-29.md.
 */

import fs from 'fs'
import path from 'path'

export type ProducerOutputClass = 'text' | 'visual' | 'unknown'

/**
 * output_type values (possibly '+'-joined, e.g. 'text+document') that require
 * a real render/composite step and therefore CANNOT be completed by the
 * serverless cloud cron. Any token matching these → the whole producer is
 * VISUAL and deferred to the local render worker.
 */
const VISUAL_TOKENS = [
  'video',
  'image',
  'document',
  'pdf',
  'pdf-document',
  'carousel',
  'reel',
  'flyer',
  'web-page', // Next.js page producers open a PR / render a route — not a cloud-cron text deliverable
]

/**
 * output_type tokens that ARE legitimately completable as text in the cloud:
 * the deliverable is literally text or a state mutation (ops/comms side effects).
 */
const TEXT_TOKENS = [
  'text',
  'operational',
  'paid-ad', // ad COPY is text; the creative image (if any) is a separate visual producer
  'backend-service',
]

/**
 * Parse the `output_type` value(s) out of a SKILL.md frontmatter block.
 * Returns the raw '+'-split tokens, lowercased and trimmed. Handles a file
 * that declares output_type more than once (some producers do).
 */
export function parseOutputTypeTokens(skillContent: string): string[] {
  const fm = skillContent.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const block = fm ? fm[1] : skillContent
  const tokens: string[] = []
  const re = /^output_type:\s*(.+)$/gim
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) {
    for (const part of m[1].split('+')) {
      const t = part.trim().toLowerCase().replace(/^["']|["']$/g, '')
      if (t) tokens.push(t)
    }
  }
  return tokens
}

/**
 * Classify a producer from its SKILL.md content.
 * VISUAL wins on any visual token (a 'text+document' producer is VISUAL —
 * it has to render the document). 'unknown' when no output_type is declared —
 * treated conservatively as VISUAL by the caller (refuse rather than fabricate).
 */
export function classifyOutputType(skillContent: string): ProducerOutputClass {
  const tokens = parseOutputTypeTokens(skillContent)
  if (tokens.length === 0) return 'unknown'
  if (tokens.some((t) => VISUAL_TOKENS.includes(t))) return 'visual'
  if (tokens.some((t) => TEXT_TOKENS.includes(t))) return 'text'
  // Declared but unrecognized token → conservative: treat as visual (refuse).
  return 'unknown'
}

/**
 * Read a producer's SKILL.md from disk and classify it.
 * Returns { cls, skillContent } so the caller can reuse the content as the
 * system prompt without a second read. Throws if the file is unreadable —
 * the caller already handles skill_load failures.
 */
export function classifyProducerFromDisk(
  producerSlug: string,
  cwd: string = process.cwd(),
): { cls: ProducerOutputClass; skillContent: string } {
  const skillPath = path.join(cwd, producerSlug, 'SKILL.md')
  const skillContent = fs.readFileSync(skillPath, 'utf-8')
  return { cls: classifyOutputType(skillContent), skillContent }
}

/**
 * Whether a producer of this class may be executed (text-completed) by the
 * serverless cloud cron. Only 'text' qualifies. 'visual' and 'unknown' are
 * deferred to the local render worker.
 */
export function canCloudComplete(cls: ProducerOutputClass): boolean {
  return cls === 'text'
}

/**
 * The hardened system prompt for TEXT producers running in the cloud cron.
 * Unlike the old prompt, this:
 *   - forbids inventing any figure (numbers come from payload or are omitted)
 *   - requires citations to trace to payload provenance, never fabricated
 *   - drops draft_path/scorecard for a rendered file (there is no render here);
 *     the deliverable is the text itself, returned inline.
 *
 * §0 (data accuracy) and §0.5 (draft-first) are restated so they bind even if
 * the SKILL.md body is terse.
 */
export function buildTextProducerSystemPrompt(skillContent: string): string {
  return `${skillContent}

---

All development routes through THE LOOP v1.1.0 — see docs/DEVELOPMENT_PROCESS.md
(ingest -> diagnose -> prioritize -> fix-the-class -> verify -> ship -> measure ->
learn -> lock). Producers inherit its preflight contract and approval model.

---

EXECUTION CONTRACT (cloud text runtime — read carefully):

You are completing this producer as a TEXT deliverable in a serverless runtime
that CANNOT render video, images, PDFs, or web pages. Produce only text.

ABSOLUTE DATA-ACCURACY RULE (CLAUDE.md §0 — outranks everything):
- Every number, price, stat, date, or figure in your output MUST come verbatim
  from the action payload provided in the user message. The brain already
  verified those figures against the source of truth before queuing this row.
- You MUST NOT invent, estimate, round-fill, or "approximate" any figure. If a
  number you would need is not present in the payload, OMIT the sentence that
  would use it. Fewer numbers is correct; one invented number is a failure.
- Do NOT fabricate a draft_path, a rendered-file path, or a viral scorecard for
  a deliverable that does not exist. There is no render here.

Return a single valid JSON object (no markdown fences, no surrounding prose):
- draft_summary: string (1-3 sentences: what text you produced)
- deliverable_text: string (the actual text deliverable — caption, body copy,
  ad copy, description, etc. This IS the output; it is returned inline.)
- citations: array of { figure, source, payload_field, value } — one entry per
  figure you used, each tracing to the exact payload field it came from. Use an
  empty array if your deliverable contains no figures. NEVER fabricate an entry.
- publish_payload: object with at minimum { action_type, caption, platforms:
  string[] } plus any platform-specific fields the recipe requires. caption and
  body text must already be brand-voice compliant (no em-dashes, no banned words).
- needs_render: false

If you cannot complete the deliverable from the payload alone, set draft_summary
to explain exactly what payload field is missing, return your best partial text,
and leave the missing figure out. Never return raw markdown outside the JSON.`
}

/**
 * The envelope a VISUAL producer's row gets when the cloud cron refuses it.
 * The local render worker (scripts/render-worker.mjs) polls for
 * deferred_to_local_render === true.
 */
export function buildVisualDeferralEnvelope(
  existing: Record<string, unknown>,
  cls: ProducerOutputClass,
  producerSlug: string,
): Record<string, unknown> {
  return {
    ...existing,
    deferred_to_local_render: true,
    deferral_reason:
      cls === 'unknown'
        ? `Producer ${producerSlug} declares no output_type; refused by cloud cron to avoid fabricating a rendered deliverable. Add output_type to its SKILL.md frontmatter (text vs a visual type) and run via the local render worker.`
        : `Producer ${producerSlug} is a visual producer (output_type ${cls}). The serverless cloud runtime cannot render it; deferred to the local render worker (scripts/render-worker.mjs), which runs the real generator and writes real citations + scorecard.`,
    deferred_at: new Date().toISOString(),
  }
}
