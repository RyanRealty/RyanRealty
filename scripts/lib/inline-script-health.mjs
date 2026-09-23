/**
 * Inline-script health for a rendered HTML page (deploy:verify, TRACK-2).
 *
 * WHY. On 2026-09-17 (f1e2a90f9) the inline GTM bootstrap shipped as
 * `w[l].push({'gtm.start':}}` — a SyntaxError. A classic <script> with a parse
 * error runs NOTHING, so gtm.js never loaded and the whole browser GA4 stream
 * (session_start, first_visit, engagement, every client event) read zero for
 * five days. Production answered 200, the deploy was READY, and every gate
 * passed, because the gates regexed the source for strings. Only parsing what
 * production actually served could have seen it. This module does that, and
 * scripts/check-vercel-deploy.mjs runs it against https://ryan-realty.com/
 * after every READY deploy.
 *
 * Parsing uses node:vm `new vm.Script(src)`, which compiles a classic script
 * without running it — the same grammar a browser applies to an inline
 * <script> with no type. It is the parse-don't-run approach of
 * lib/analytics/gtm-bootstrap.test.ts (new Function over the exact string),
 * applied to every inline script production served; the test file checks the
 * two agree on the shipped bootstrap. vm.Script is used here because a
 * function body accepts a top-level `return` that a browser script rejects.
 */
import vm from 'node:vm'

/** `type` values a browser executes as a classic script. */
const CLASSIC_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'application/x-javascript', 'text/ecmascript', 'application/ecmascript'])

/** The loader text the GTM bootstrap carries (lib/analytics/gtm-bootstrap.ts). */
export const GTM_LOADER_TEXT = 'googletagmanager.com/gtm.js'

function attr(attrs, name) {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs)
  if (!m) return null
  return (m[1] ?? m[2] ?? m[3] ?? '').trim()
}

/**
 * Every <script> element in the document, in order.
 * @param {string} html
 * @returns {{ index: number, type: string, src: string | null, body: string }[]}
 */
export function extractScripts(html) {
  const out = []
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
  let m
  let index = 0
  while ((m = re.exec(html))) {
    const attrs = m[1] ?? ''
    out.push({
      index: index++,
      type: (attr(attrs, 'type') ?? '').toLowerCase(),
      src: attr(attrs, 'src'),
      body: m[2] ?? '',
    })
  }
  return out
}

/**
 * Inline classic scripts that do not parse. JSON-LD, application/json, and any
 * other non-executable type are not JavaScript and are skipped; so are external
 * scripts (src=) and empty bodies. A `type="module"` inline script cannot be
 * compiled by vm.Script (import/export) and is counted, not parsed.
 *
 * @param {string} html
 */
export function checkInlineScripts(html) {
  const scripts = extractScripts(html)
  const failures = []
  let parsed = 0
  let modules = 0
  for (const s of scripts) {
    if (s.src) continue
    if (!s.body.trim()) continue
    if (s.type === 'module') {
      modules += 1
      continue
    }
    if (!CLASSIC_TYPES.has(s.type)) continue
    parsed += 1
    try {
      new vm.Script(s.body, { filename: `inline-script-${s.index}.js` })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const head = s.body.replace(/\s+/g, ' ').trim().slice(0, 120)
      failures.push({ index: s.index, message, head })
    }
  }
  return {
    total: scripts.length,
    parsed,
    modules,
    failures,
    hasGtmLoader: html.includes(GTM_LOADER_TEXT),
  }
}

/**
 * Human lines for the deploy log, plus the verdict.
 * @param {ReturnType<typeof checkInlineScripts>} r
 */
export function formatInlineScriptReport(r) {
  const lines = [
    `${r.parsed} inline script(s) parsed of ${r.total} <script> tag(s); ${r.failures.length} parse error(s); ` +
      `GTM loader ${r.hasGtmLoader ? 'present' : 'MISSING'}`,
  ]
  for (const f of r.failures) lines.push(`  script #${f.index}: ${f.message} — ${f.head}`)
  if (!r.hasGtmLoader) {
    lines.push(`  no "${GTM_LOADER_TEXT}" text in the page: the browser analytics stream cannot start.`)
  }
  return { ok: r.failures.length === 0 && r.hasGtmLoader, lines }
}
