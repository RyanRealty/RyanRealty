/**
 * Inline <script> health for a rendered HTML document: the ONE parser for "does
 * the page production served actually run". The daily crawl probe
 * (app/api/cron/crawl-probe) uses it, and it is plain ESM with JSDoc types and
 * no dependency beyond node:vm so the post-deploy verifier
 * (scripts/check-vercel-deploy.mjs, deploy:verify) can import it too:
 *
 *   import { checkInlineScripts, formatInlineScriptReport } from '../lib/analytics/inline-script-check.mjs'
 *   const report = formatInlineScriptReport(checkInlineScripts(html))
 *   for (const line of report.lines) out(line)
 *   if (!report.ok) process.exit(1)
 *
 * One parser for both callers means the monitor and the deploy check cannot
 * disagree about what a broken page is.
 *
 * WHY (visibility audit 2026-09-22, TRACK-2 and P15): on 2026-09-17 an edit left
 * `push({'gtm.start':}}` inside the inline GTM bootstrap. A script with a parse
 * error runs nothing, so gtm.js never loaded and the browser GA4 stream read
 * zero for five days. Every gate regexes source files for strings, so every gate
 * passed. The only check that sees this class is one that PARSES what the live
 * page ships, which is what this module does.
 *
 * Parsing uses node:vm Script, which compiles with the classic-script goal and
 * never runs the code. JSON-typed scripts (JSON-LD, importmap, speculation
 * rules) go through JSON.parse, because a JSON-LD block that does not parse is
 * structured data Google silently drops.
 */
import { Script } from 'node:vm'

/** Script types a browser executes as classic JavaScript. */
const JS_TYPES = new Set([
  '',
  'text/javascript',
  'application/javascript',
  'text/ecmascript',
  'application/ecmascript',
  'application/x-javascript',
  'text/x-javascript',
  'text/jscript',
  'text/livescript',
])

/** Script types whose body is JSON. */
const JSON_TYPES = new Set(['application/ld+json', 'application/json', 'importmap', 'speculationrules'])

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
const GTM_LOADER_MARK = 'googletagmanager.com/gtm.js'
const GTM_ID_RE = /GTM-[A-Z0-9]{4,}/g

/**
 * Attribute map for the text between `<tag` and `>`. Names are lower-cased;
 * valueless attributes map to ''.
 * @param {string} attrText
 * @returns {Record<string, string>}
 */
export function parseAttributes(attrText) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const m of String(attrText ?? '').matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase()
    if (name in out) continue
    out[name] = m[2] ?? m[3] ?? m[4] ?? ''
  }
  return out
}

/**
 * @typedef {'js' | 'json' | 'module' | 'other'} InlineScriptKind
 * @typedef {{ index: number, type: string, kind: InlineScriptKind, source: string }} InlineScript
 */

/**
 * Every inline <script> (no src) in document order. Script bodies are raw text
 * in HTML (no entity decoding), so the captured text is exactly what the
 * browser hands its parser.
 * @param {string} html
 * @returns {InlineScript[]}
 */
export function extractInlineScripts(html) {
  /** @type {InlineScript[]} */
  const out = []
  let index = 0
  for (const m of String(html ?? '').matchAll(SCRIPT_RE)) {
    const attrs = parseAttributes(m[1])
    index += 1
    if ('src' in attrs) continue
    const type = (attrs.type ?? '').trim().toLowerCase()
    /** @type {InlineScriptKind} */
    let kind = 'other'
    if (JS_TYPES.has(type)) kind = 'js'
    else if (JSON_TYPES.has(type)) kind = 'json'
    else if (type === 'module') kind = 'module'
    out.push({ index, type, kind, source: m[2] })
  }
  return out
}

/** @param {string} source */
function excerpt(source) {
  const flat = source.replace(/\s+/g, ' ').trim()
  return flat.length > 80 ? `${flat.slice(0, 80)}...` : flat
}

/**
 * The React Server Components flight payload Next streams as
 * `self.__next_f.push([...])`. It carries every string the page rendered,
 * including an escaped copy of the GTM bootstrap, so it must never count as
 * the loader itself.
 * @param {string} source
 */
function isFlightPayload(source) {
  const s = source.trimStart()
  return s.startsWith('self.__next_f') || s.startsWith('(self.__next_f')
}

/**
 * @typedef {{ index: number, kind: InlineScriptKind, message: string, excerpt: string }} InlineScriptParseError
 * @typedef {{
 *   ok: boolean,
 *   inline: number,
 *   js: number,
 *   json: number,
 *   skipped: number,
 *   parseErrors: InlineScriptParseError[],
 *   gtm: { loaderFound: boolean, loaderParses: boolean, containerIds: string[], expectedId: string | null },
 *   failures: string[],
 * }} InlineScriptReport
 */

/**
 * Parse every inline script and confirm the GTM loader is present and parses.
 *
 * Fails when any classic inline script or JSON block does not parse, when no
 * inline script outside the flight payload loads gtm.js, or when an expected
 * container id is given and the loader does not carry it. Module scripts and
 * unknown types are counted as skipped, not failed.
 *
 * @param {string} html
 * @param {{ gtmContainerId?: string | null, requireGtm?: boolean }} [opts]
 * @returns {InlineScriptReport}
 */
export function checkInlineScripts(html, opts = {}) {
  const expectedId = opts.gtmContainerId ? String(opts.gtmContainerId).trim() || null : null
  const requireGtm = opts.requireGtm !== false
  const scripts = extractInlineScripts(html)
  /** @type {InlineScriptParseError[]} */
  const parseErrors = []
  let js = 0
  let json = 0
  let skipped = 0
  let loaderFound = false
  let loaderParses = false
  /** @type {Set<string>} */
  const containerIds = new Set()

  for (const s of scripts) {
    if (s.kind === 'js') {
      js += 1
      let parses = true
      try {
        new Script(s.source, { filename: `inline-script-${s.index}.js` })
      } catch (err) {
        parses = false
        parseErrors.push({
          index: s.index,
          kind: s.kind,
          message: err instanceof Error ? err.message : String(err),
          excerpt: excerpt(s.source),
        })
      }
      if (!isFlightPayload(s.source) && s.source.includes(GTM_LOADER_MARK)) {
        loaderFound = true
        if (parses) loaderParses = true
        for (const id of s.source.match(GTM_ID_RE) ?? []) containerIds.add(id)
      }
    } else if (s.kind === 'json') {
      json += 1
      try {
        JSON.parse(s.source)
      } catch (err) {
        parseErrors.push({
          index: s.index,
          kind: s.kind,
          message: err instanceof Error ? err.message : String(err),
          excerpt: excerpt(s.source),
        })
      }
    } else {
      skipped += 1
    }
  }

  /** @type {string[]} */
  const failures = []
  for (const e of parseErrors) {
    failures.push(`inline ${e.kind === 'json' ? 'JSON' : 'script'} #${e.index} does not parse: ${e.message} (${e.excerpt})`)
  }
  if (requireGtm) {
    if (!loaderFound) failures.push('GTM loader missing: no inline script loads gtm.js')
    else if (!loaderParses) failures.push('GTM loader does not parse, so gtm.js never loads')
    if (loaderFound && expectedId && !containerIds.has(expectedId)) {
      failures.push(`GTM loader does not carry container ${expectedId} (found ${[...containerIds].join(', ') || 'none'})`)
    }
  }

  return {
    ok: failures.length === 0,
    inline: scripts.length,
    js,
    json,
    skipped,
    parseErrors,
    gtm: { loaderFound, loaderParses, containerIds: [...containerIds].sort(), expectedId },
    failures,
  }
}

/**
 * Log lines plus the verdict, for a CLI caller (deploy:verify). The first line
 * is the tally; one line follows per failure.
 * @param {InlineScriptReport} report
 * @returns {{ ok: boolean, lines: string[] }}
 */
export function formatInlineScriptReport(report) {
  const g = report.gtm
  const loader = !g.loaderFound ? 'MISSING' : g.loaderParses ? `present (${g.containerIds.join(', ') || 'no id'})` : 'DOES NOT PARSE'
  const lines = [
    `${report.js} inline script(s) and ${report.json} JSON block(s) parsed of ${report.inline} inline; ` +
      `${report.parseErrors.length} parse error(s); ${report.skipped} skipped; GTM loader ${loader}`,
  ]
  for (const f of report.failures) lines.push(`  ${f}`)
  return { ok: report.ok, lines }
}
