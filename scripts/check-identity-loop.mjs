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
 *   9. Automation is honored everywhere, not only by the track route (Matt
 *      2026-09-29): the identify actions refuse it (by the request's user agent, by
 *      the browser's own navigator.webdriver sent with the call, and by the session
 *      the track route flagged, which is how a scripted browser with an ordinary
 *      user agent shows), and both callers send that signal (PersonIdentityBridge,
 *      the document tracker's identify ping); the bridge identifies the session the
 *      tracker's first post landed in, not the one in storage before the click;
 *      every tracker post carries the signal in the shared context;
 *      backfillSessionToFub and the form-submit stitch refuse it, the browser
 *      back-stitch leaves flagged sessions out, and all three read ONE rule; neither
 *      broker alert fires for it; the email click redirect records it as
 *      click_automated instead of a click; and neither redirect (email click, SMS
 *      short link) hands it a person token.
 *  10. The trackers follow the tier table: the client-document tracker
 *      (public/rr-doc-tracker.js) stops for a visitor who declined and sends the
 *      arrival campaign; under Global Privacy Control both trackers write no
 *      identifier and send only the notice, and the track route records the
 *      suppression from what the browser already carries; an ad click is not
 *      consent (`arrivalConsent` never writes a grant); the search events and
 *      trackUserEvent refuse a decline and GPC; the GA4 mirror does not assume gtag
 *      runs on a document; and the section tracker posts the shared first-party
 *      context (consent included), only for a visitor whose tier keeps a section id
 *      or a depth.
 *  11. The session rule, in lib/analytics/visitor-session.ts and in the script that
 *      mirrors it: a campaign is compared only on an arrival (the first event of a
 *      page load the browser navigated to from outside the site; a later event
 *      carries the same address and would end the session on every tap), judged on
 *      the address the page LOADED at; a session id no lifecycle record names is
 *      never kept; and the session a record belongs to is kept in its own key, which
 *      the tracker deployed before the rule never rewrites (review of 2026-09-30).
 *
 *  Rules 9, 10 and 11 match CODE (comments stripped) at the guard's call site: a
 *  pattern the function's own definition or a docblock also satisfies stays green
 *  when the guard is deleted.
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
// forwards the SAME token it read to our own identify endpoint.
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

/** Marks a wiring rule that must be satisfied by code, not by a comment. */
const CODE = 'code'

/** Rules 4-10: required wiring. Returns [{ file, why }] for each missing piece. */
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
    // Rules 9 and 10 match CODE only (comments stripped) and anchor on the guard's call
    // site, not on a name the file also defines or a comment repeats: a pattern that
    // the function's own definition or a docblock satisfies stays green when the guard
    // itself is deleted (the first version of these rules did exactly that).
    // Rule 9: automation is honored everywhere.
    ['app/actions/identity-bridge.ts', /classifyAutomation\(\{ userAgent: hdrs\.get\('user-agent'\), webdriver: signals\?\.webdriver === true \}\)\.automated\) return 'automated'/, 'the identify actions no longer refuse an automated request', CODE],
    ['components/PersonIdentityBridge.tsx', /identifyPersonFromEmailClickNative\(nativeValue, sessionId \?\? undefined, \{ webdriver: navigator\.webdriver === true \}\)/, 'the identity bridge no longer tells the identify action the browser is automated (the session row may not say)', CODE],
    ['components/PersonIdentityBridge.tsx', /const sessionId = await postedSession\(IDENTIFY_WAIT_MS\)/, 'the identity bridge identifies the session in storage before the click, not the one the tracker\'s first post landed in', CODE],
    ['components/VisitTracker.tsx', /if \(typeof payload\.sessionId === 'string'\) notePostedSession\(payload\.sessionId\)/, 'VisitTracker no longer says which session its posts landed in (the identity bridge waits for it)', CODE],
    ['app/api/track/e/identify/route.ts', /identifyPersonFromEmailClickNative\(pid, sid, \{ webdriver \}\)/, 'the identify ping no longer passes the browser automation signal to the identify action', CODE],
    ['components/VisitTracker.tsx', /visit: advanced\.visit,\s*webdriver: typeof navigator !== 'undefined' && navigator\.webdriver === true \? true : undefined,/, 'the shared first-party context no longer carries the automation signal (a section view can create the session)', CODE],
    ['lib/visitor-backfill.ts', /\.is\('identified_at', null\)\s*\.or\(NOT_AUTOMATION_FILTER\)/, 'the browser back-stitch identifies sessions flagged as automation', CODE],
    ['lib/visitor-backfill.ts', /const NOT_AUTOMATION_FILTER = IDENTIFIABLE_SESSION_FILTER\b/, 'the back-stitch filter is written out by hand again, free to drift from the rule the identify paths read', CODE],
    ['lib/visitor-backfill.ts', /return sessionBlocksIdentification\(row\)/, 'sessionIsAutomation restates the automation rule instead of reading the one definition', CODE],
    ['lib/data/crm/getSiteActivity.ts', /const HUMAN_SESSION_OR = IDENTIFIABLE_SESSION_FILTER\b/, 'Known people restates the automation rule instead of reading the one definition', CODE],
    ['app/actions/identity-bridge.ts', /if \(result\.automated\) return \{ ok: false/, 'the email-click identify action no longer stops for a session flagged as automation (it would cookie and stitch a scripted browser)', CODE],
    ['app/actions/identity-bridge.ts', /if \(backfill\.automated\) return \{ ok: true, bridged: false \}/, 'the sign-in bridge no longer stops for a session flagged as automation', CODE],
    ['app/actions/identity-bridge.ts', /if \(validSessionId && \(await isAutomatedSession\(validSessionId\)\)\) return/, 'the sign-in bridge (no contact yet) no longer stops for a session flagged as automation', CODE],
    ['lib/visitor-backfill.ts', /if \(sessionIsAutomation\(session\)\) \{/, 'backfillSessionToFub no longer refuses a session flagged as automation', CODE],
    ['lib/visitor-backfill.ts', /if \(backfill\.automated\) return\b/, 'the form-submit stitch no longer skips a session flagged as automation', CODE],
    ['app/api/visitors/track/route.ts', /!minimalOnly && !automation\.automated/, 'the looking-at broker alert can fire for automation', CODE],
    ['app/api/visitors/track/route.ts', /!automation\.automated && \(eventType === 'page_view'/, 'the "they opened the report" broker alert can fire for automation', CODE],
    ['app/api/track/e/open/route.ts', /if \(slug && !automated\) await queueCmaOpenedAlert\(/, 'the email open pixel can fire the "they opened the report" alert for automation', CODE],
    ['app/api/track/e/click/route.ts', /if \(automation\.automated\) \{[\s\S]{0,160}recordAutomatedClick\(/, 'the email click redirect no longer diverts automation from the ordinary click record', CODE],
    ['app/api/track/e/click/route.ts', /event: 'click_automated'/, 'the email click redirect records automation as an ordinary click', CODE],
    ['app/api/track/e/click/route.ts', /if \(automation\.automated\) \{[\s\S]{0,200}NextResponse\.redirect\(withoutIdentityOnOwnSite\(target\), 302\)/, 'the email click redirect hands automation a signed person token (a gateway sandbox would be identified as the contact)', CODE],
    ['app/r/[code]/route.ts', /target = log\s*\?\s*stampIdentityOnOwnSite\(resolved\.targetUrl, resolved\.personId, resolved\.broker\)\s*:\s*withoutIdentityOnOwnSite\(resolved\.targetUrl\)/, 'the SMS short-link redirect hands a link previewer a signed person token', CODE],
    // Rule 10: the client-document tracker follows the site.
    ['public/rr-doc-tracker.js', /if \(consentAtArrival\(\) === 'declined'\) \{/, 'the client-document tracker no longer stops for a visitor who declined', CODE],
    ['public/rr-doc-tracker.js', /campaign: source\.campaign/, 'the client-document tracker no longer sends the arrival campaign', CODE],
    ['public/rr-doc-tracker.js', /if \(gpcOn\(\)\) \{\s*sendGpcNotice\(\)\s*stripIdentityFromAddressBar\(\)\s*return\s*\}/, 'the client-document tracker posts or grants for a browser sending Global Privacy Control', CODE],
    ['public/rr-doc-tracker.js', /var sendGpcNotice = function \(\) \{[\s\S]{0,300}body: JSON\.stringify\(\{ gpc: true \}\)/, 'the client-document tracker\'s GPC notice carries more than the signal', CODE],
    ['components/VisitTracker.tsx', /export function firstPartyEventContext\(\): FirstPartyEventContext \| null \{\s*if \(typeof window === 'undefined'\) return null\s*if \(gpcOn\(\)\) return null/, 'the site tracker writes a session id for a browser sending Global Privacy Control', CODE],
    ['components/VisitTracker.tsx', /if \(gpcOn\(\)\) \{\s*sendGpcNotice\(\)\s*return\s*\}/, 'the site tracker posts events for a browser sending Global Privacy Control', CODE],
    ['components/VisitTracker.tsx', /function sendGpcNotice\(\): void \{[\s\S]{0,300}body: JSON\.stringify\(\{ gpc: true \}\)/, 'the site tracker\'s GPC notice carries more than the signal', CODE],
    ['app/api/visitors/track/route.ts', /const crmPersonId = gpcSb \? await gpcKnownContact\(request, body, gpcSb\) : null/, 'the track route no longer finds the contact a GPC browser already carries (the notice has no session id)', CODE],
    ['app/api/visitors/track/route.ts', /if \(gpcOptOut\) \{[\s\S]*?\n  const sessionId = body\.sessionId\?\.trim\(\)/, 'the track route checks the session id or the consent before GPC (the GPC notice has neither)', CODE],
    ['components/search/search-events.client.ts', /if \(currentConsentLevel\(\) === 'declined' \|\| gpcFromNavigator\(navigator\)\) return/, 'the search events record a visitor who declined or sends Global Privacy Control', CODE],
    ['app/actions/track-user-event.ts', /if \(!recordingAllowed\(\{ consentCookie: cookieStore\.get\(CONSENT_COOKIE\)\?\.value \?\? null, secGpc: hdrs\.get\('sec-gpc'\) \}\)\) return/, 'trackUserEvent records a visitor who declined or sends Global Privacy Control', CODE],
    ['public/rr-doc-tracker.js', /var automated = navigator\.webdriver === true \? '&webdriver=1' : ''/, 'the client-document tracker no longer tells the identify ping the browser is automated', CODE],
    ['lib/identity/consent.ts', /void args\.search/, 'arrivalConsent reads the arrival query to auto-grant marketing from an ad click', CODE],
    ['public/rr-doc-tracker.js', /var consentAtArrival = function \(\) \{\s*return consentNow\(\)\s*\}/, 'the client-document tracker auto-grants marketing from a campaign link', CODE],
    ['app/api/visitors/track/route.ts', /body\.pageCategory !== 'client-document'/, 'a consented reader of a client document can drop out of the GA4 mirror (the document runs no gtag)', CODE],
    ['components/site/v3/V3SectionTracker.client.tsx', /const ctx = firstPartyEventContext\(\)/, 'V3SectionTracker no longer posts the shared context (consent, session, campaign)', CODE],
    ['components/site/v3/V3SectionTracker.client.tsx', /if \(level !== 'all' && level !== 'analytics'\) return/, 'V3SectionTracker posts empty section and scroll rows for a visitor at the essential tier', CODE],
    // Rule 11: the session rule, in both copies.
    ['lib/analytics/visitor-session.ts', /decideSession\(\{ sessionId: stored, record, now, arrival: arrival \? campaign : null \}\)/, 'the session rule compares the campaign of every event, not only of an arrival (every tap on a tagged page can end the session)', CODE],
    ['lib/analytics/visitor-session.ts', /if \(!args\.record \|\| args\.record\.sid !== args\.sessionId\) return \{ newSession: true, reason: 'unrecorded' \}/, 'the session rule keeps a session id no lifecycle record names (one from before the rule)', CODE],
    ['public/rr-doc-tracker.js', /decideSession\(state\.sid, record, now, arrival \? campaign : null\)/, 'the client-document tracker compares the campaign of every event, not only of an arrival', CODE],
    ['public/rr-doc-tracker.js', /if \(!record \|\| record\.sid !== sessionId\) return \{ newSession: true, reason: 'unrecorded' \}/, 'the client-document tracker keeps a session id no lifecycle record names (one from before the rule)', CODE],
    ['lib/analytics/visitor-session.ts', /const storedRecord: SessionRecord \| null = visit \? \{ \.\.\.visit, \.\.\.parseBinding\(rawBinding\) \} : null/, 'the session rule reads the session id out of rr_visit_v1, which the tracker deployed before the rule rewrites without it (every such event would split the visit)', CODE],
    ['public/rr-doc-tracker.js', /storedRecord = \{ id: visit\.id, n: visit\.n, last: visit\.last, sid: binding\.sid, s: binding\.s, c: binding\.c \}/, 'the client-document tracker reads the session id out of rr_visit_v1, which the tracker deployed before the rule rewrites without it', CODE],
    ['lib/analytics/visitor-session.ts', /if \(typeof window !== 'undefined'\) memory\.arrival = readPageArrival\(\)/, 'the session module no longer records the page\'s arrival when it loads (a tap before the tracker mounts would be judged instead)', CODE],
    ['lib/analytics/visitor-session.ts', /const campaign = campaignKeyFromSearch\(opts\.search \?\? \(firstOfPageLoad \? loaded\.search : window\.location\.search\)\)/, 'the session rule judges the first event of a page load on the current address, not the one the page loaded at', CODE],
    ['public/rr-doc-tracker.js', /var campaign = campaignKeyFromSearch\(firstOfPageLoad \? loaded\.search : location\.search\)/, 'the client-document tracker judges the first event of a page load on the current address, not the one the page loaded at', CODE],
  ]
  const out = []
  for (const [file, re, why, mode] of need) {
    const raw = read(file)
    if (raw == null) {
      out.push({ file, why: `${why} (file missing)` })
      continue
    }
    if (!re.test(mode === CODE ? stripComments(raw) : raw)) out.push({ file, why })
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
