#!/usr/bin/env node
/**
 * check-identity-loop.mjs (ci:identity-loop) — the known-contact identity loop
 * stays wired (P7, Matt 2026-09-23).
 *
 * WHY THIS EXISTS. Matt: "We need to make sure that it's just really always
 * encoded in our practices ... I don't want to have to reinvent this every
 * time." The loop has been rebuilt piecemeal before (the _fuid-only sends that
 * left 4,890 post-cutover contacts unidentifiable, the essential-tier session
 * that never created the row its identity param was meant to stitch, the stored
 * URLs carrying raw contact ids). Each failure was silent: every send worked,
 * every page loaded, and the identity simply did not attach. So the contract in
 * docs/TRACKING_POLICY.md "The known-contact identity loop" is a gate:
 *
 *   1. ONE decoration helper. No file outside lib/identity/outbound-links.ts
 *      calls attributeSiteLinks (AST, TypeScript compiler, so a call split
 *      across lines is read correctly).
 *   2. Nobody stamps an identity param by hand: no `searchParams.set('_pid'`,
 *      no `_pid=${...}` / `'_pid=' +` / `_fuid=` construction outside the helper.
 *   3. No URL is built with a raw email (`email=` / `eml=` param).
 *   4. The track route still resolves the signed token, plans precedence,
 *      identifies + back-stitches, classifies automation, and sets the signed
 *      cookie; the back-stitch filter (rr_vid + identified_at is null) holds.
 *   5. The trusted redirects (email click, SMS short link) still re-sign.
 *   6. The CMA gate reads only SIGNED identity.
 *   7. The activity view keeps its query: /admin/visitors/live renders Known
 *      people from getActiveKnownPeople (identified, non-automated sessions +
 *      their events, scripted form submits screened out by the p06
 *      quality:suspect rule), and the person page renders getPersonSiteActivity.
 *   8. The automation class stays wired: UA classification plus the
 *      provisional contact-deep-link shape, and the next event clears it.
 *
 * ESCAPE for rules 1-3: `// identity-loop-ok: <reason>` on the line or the line
 * above. A bare pragma with no reason does not suppress.
 *
 * Usage: node scripts/check-identity-loop.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const PRAGMA = /\/\/\s*identity-loop-ok:\s*\S+/
const HELPER = 'lib/identity/outbound-links.ts'
const DEFINITION = 'lib/crm/merge.ts'

// Files allowed to write an identity param: the helper that mints it, the
// primitive it calls, the token module, and the raw-HTML doc tracker that
// forwards the SAME token it read to our own identify beacon.
const STAMP_ALLOWED = new Set([
  HELPER,
  DEFINITION,
  'lib/identity/link-token.ts',
  'public/rr-doc-tracker.js',
])

function stripComments(src) {
  // Block comments, then line comments not inside a string on that line (a
  // URL like 'https://…' keeps its // because the regex needs a preceding
  // quote-free run ending in whitespace or line start).
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[\s;{}(),])\/\/.*$/gm, (m, lead) => lead)
}

function pragmaAt(lines, idx) {
  return PRAGMA.test(lines[idx] ?? '') || PRAGMA.test(lines[idx - 1] ?? '')
}

/** Rule 1: direct attributeSiteLinks calls. Returns [{ line }]. */
export function findDirectAttributeCalls(src, file = 'x.ts') {
  if (!src.includes('attributeSiteLinks')) return []
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const lines = src.split('\n')
  const out = []
  const walk = (node) => {
    if (ts.isCallExpression(node)) {
      const c = node.expression
      const name = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : null
      if (name === 'attributeSiteLinks') {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        if (!pragmaAt(lines, line)) out.push({ line: line + 1 })
      }
    }
    node.forEachChild(walk)
  }
  walk(sf)
  return out
}

const HAND_STAMP = [
  /\.(?:set|append)\(\s*['"`]_(?:pid|fuid)['"`]/,
  /[?&]_(?:pid|fuid)=\$\{/,
  /['"`][?&]?_(?:pid|fuid)=['"`]\s*\+/,
]

/** Rule 2: hand-built identity params. Returns [{ line, text }]. */
export function findHandStampedIdentity(src) {
  const code = stripComments(src).split('\n')
  const lines = src.split('\n')
  const out = []
  code.forEach((l, i) => {
    if (HAND_STAMP.some((re) => re.test(l)) && !pragmaAt(lines, i)) out.push({ line: i + 1, text: lines[i].trim() })
  })
  return out
}

// URL builders only: `formData.set('email', …)` is a form body, not a URL.
const RAW_EMAIL = [
  /(?:searchParams|[pP]arams|qs|query|[uU]rl\w*)\.(?:set|append)\(\s*['"`](?:email|eml)['"`]/,
  /[?&](?:email|eml)=\$\{/,
  /['"`][?&](?:email|eml)=['"`]\s*\+/,
]

/** Rule 3: a raw email in a URL. Returns [{ line, text }]. */
export function findRawEmailInUrl(src) {
  const code = stripComments(src).split('\n')
  const lines = src.split('\n')
  const out = []
  code.forEach((l, i) => {
    if (RAW_EMAIL.some((re) => re.test(l)) && !pragmaAt(lines, i)) out.push({ line: i + 1, text: lines[i].trim() })
  })
  return out
}

/** Rules 4-7: required wiring. Returns [{ file, why }] for each missing piece. */
export function missingWiring(read) {
  const need = [
    ['app/api/visitors/track/route.ts', /verifyPersonLinkToken\(/, 'track route no longer verifies the signed ?_pid= token'],
    ['app/api/visitors/track/route.ts', /arrivalTokenFrom\(/, 'track route no longer reads the arrival token'],
    ['app/api/visitors/track/route.ts', /planArrivalIdentity\(/, 'track route no longer plans identity precedence'],
    ['app/api/visitors/track/route.ts', /identifySessionAndBrowser\(/, 'track route no longer identifies + back-stitches the visit'],
    ['app/api/visitors/track/route.ts', /classifyAutomation\(/, 'track route no longer classifies automation'],
    ['app/api/visitors/track/route.ts', /classifyArrivalShape\(/, 'track route no longer flags the contact-deep-link crawler shape'],
    ['app/api/visitors/track/route.ts', /clearProvisionalAutomation\(/, 'track route no longer clears a provisional automation flag on the next event'],
    ['app/api/visitors/track/route.ts', /personCookieValue\(/, 'track route no longer sets the signed rr_pid cookie'],
    ['lib/data/identity/sessionIdentity.ts', /stitchBrowserToPerson\(/, 'identify no longer stitches the browser (identity map + back-stitch)'],
    ['lib/visitor-backfill.ts', /export async function stitchBrowserToPerson[\s\S]{0,400}stitchVisitorIdentity\(/, 'the browser stitch seam no longer calls stitchVisitorIdentity'],
    ['lib/visitor-backfill.ts', /\.eq\('rr_vid',\s*params\.rrVid\)[\s\S]{0,80}\.is\('identified_at',\s*null\)/, 'back-stitch filter (same rr_vid, still anonymous) is gone'],
    ['lib/identity/outbound-links.ts', /signPersonLinkToken\(/, 'the decoration helper no longer signs the person token'],
    ['lib/identity/outbound-links.ts', /attributeSiteLinks\(/, 'the decoration helper no longer stamps links'],
    ['lib/crm/attributed-links.ts', /decorateOutboundText\(/, 'attributeOutbound bypasses the decoration helper'],
    ['app/api/track/e/click/route.ts', /decorateOutboundUrl\(/, 'the email click redirect no longer re-signs our-domain destinations'],
    ['lib/data/crm/shortLinks.ts', /decorateOutboundUrl\(/, 'the SMS short-link redirect no longer re-signs our-domain destinations'],
    ['lib/cma/doc-links.ts', /signPersonLinkToken\(/, 'CMA document links no longer carry a signed token'],
    ['lib/cma/serve-document.ts', /verifyPersonLinkToken\(/, 'the CMA gate no longer requires a signed ?_pid='],
    ['lib/cma/serve-document.ts', /signedPersonIdFromCookie\(/, 'the CMA gate no longer requires a signed rr_pid cookie'],
    ['app/admin/(protected)/visitors/live/page.tsx', /<KnownPeople\b/, '/admin/visitors/live lost the Known people view'],
    ['app/admin/(protected)/visitors/live/KnownPeople.tsx', /getActiveKnownPeople\(/, 'Known people no longer reads getActiveKnownPeople'],
    ['lib/data/crm/getSiteActivity.ts', /from\('visitor_sessions'\)[\s\S]{0,200}\.not\('crm_person_id',\s*'is',\s*null\)/, 'the activity query no longer reads identified sessions'],
    ['lib/data/crm/getSiteActivity.ts', /is_automated/, 'the activity query no longer excludes automation'],
    ['lib/data/crm/getSiteActivity.ts', /from\('visitor_events'\)/, 'the activity query no longer reads page events'],
    ['lib/data/crm/getSiteActivity.ts', /isSuspectContact\(/, 'Known people no longer screens out scripted form submits (quality:suspect)'],
    ['lib/crm/site-activity.ts', /hasSuspectTag\(/, 'isSuspectContact no longer reads the p06 quality:suspect tag'],
    ['app/admin/(protected)/people/[id]/SiteActivitySection.tsx', /getPersonSiteActivity\(/, 'the person page lost its per-person activity read'],
    ['app/admin/(protected)/people/[id]/PersonWorkspace.tsx', /<SiteActivitySection\b/, 'the person page no longer renders On the site'],
  ]
  const out = []
  for (const [file, re, why] of need) {
    const src = read(file)
    if (src == null) out.push({ file, why: `${why} (file missing)` })
    else if (!re.test(src)) out.push({ file, why })
  }
  return out
}

function trackedFiles() {
  const out = execFileSync(
    'git',
    ['ls-files', 'app/**/*.ts', 'app/**/*.tsx', 'lib/**/*.ts', 'lib/**/*.tsx', 'components/**/*.ts', 'components/**/*.tsx', 'public/*.js'],
    { encoding: 'utf8' },
  )
  return out.split('\n').filter(Boolean).filter((f) => !/\.(?:int\.)?test\.tsx?$/.test(f))
}

function main() {
  const read = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : null)
  const fails = []
  for (const file of trackedFiles()) {
    const src = read(file)
    if (src == null) continue
    if (file !== HELPER && file !== DEFINITION && /\.tsx?$/.test(file)) {
      for (const v of findDirectAttributeCalls(src, file)) {
        fails.push(`${file}:${v.line} — calls attributeSiteLinks directly; use decorateOutboundText / decorateOutboundUrl (lib/identity/outbound-links.ts)`)
      }
    }
    if (!STAMP_ALLOWED.has(file) && !file.startsWith('lib/identity/')) {
      for (const v of findHandStampedIdentity(src)) {
        fails.push(`${file}:${v.line} — stamps an identity param by hand (${v.text}); only the decoration helper mints ?_pid=`)
      }
    }
    for (const v of findRawEmailInUrl(src)) {
      fails.push(`${file}:${v.line} — puts an email in a URL (${v.text}); a URL never carries an email, phone or name`)
    }
  }
  for (const m of missingWiring(read)) fails.push(`${m.file} — ${m.why}`)

  console.log('Identity-loop check (docs/TRACKING_POLICY.md, the known-contact identity loop)')
  console.log('=============================================================================')
  if (fails.length === 0) {
    console.log('One decoration helper, signed tokens only, track route identifies + back-stitches, redirects re-sign, activity view wired.')
    process.exit(0)
  }
  for (const f of fails) console.error(`FAIL  ${f}`)
  console.error(`\n${fails.length} identity-loop break(s). Escape a genuine exception with // identity-loop-ok: <reason>.`)
  process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
