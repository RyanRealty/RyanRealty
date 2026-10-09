import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import {
  findDirectAttributeCalls,
  findHandStampedIdentity,
  findRawEmailInUrl,
  missingWiring,
} from '../check-identity-loop.mjs'

describe('check-identity-loop — rule 1: one decoration helper', () => {
  it('fires on a direct attributeSiteLinks call, including one split across lines', () => {
    expect(findDirectAttributeCalls("const x = attributeSiteLinks(body, 'matt', null, id)")).toHaveLength(1)
    expect(findDirectAttributeCalls('const x = merge.attributeSiteLinks(\n  body,\n  slug,\n  null,\n  id,\n)')).toHaveLength(1)
  })
  it('ignores a mention in a comment and honours a reasoned pragma', () => {
    expect(findDirectAttributeCalls('// attributeSiteLinks(body) is the primitive')).toHaveLength(0)
    expect(findDirectAttributeCalls('// identity-loop-ok: fixture\nattributeSiteLinks(a, b, c, d)')).toHaveLength(0)
    expect(findDirectAttributeCalls('// identity-loop-ok:\nattributeSiteLinks(a, b, c, d)')).toHaveLength(1)
  })
})

describe('check-identity-loop — rule 2: nobody stamps _pid by hand', () => {
  it('fires on searchParams.set, template and concatenation shapes', () => {
    expect(findHandStampedIdentity("u.searchParams.set('_pid', String(id))")).toHaveLength(1)
    expect(findHandStampedIdentity('const url = `${doc}?_pid=${lead.personId}&utm_source=crm`')).toHaveLength(1)
    expect(findHandStampedIdentity("var q = '_pid=' + encodeURIComponent(pid)")).toHaveLength(1)
    expect(findHandStampedIdentity("u.searchParams.set('_fuid', '9')")).toHaveLength(1)
  })
  it('allows reading, deleting, comments and prose', () => {
    expect(findHandStampedIdentity("const t = u.searchParams.get('_pid')")).toHaveLength(0)
    expect(findHandStampedIdentity("u.searchParams.delete('_pid')")).toHaveLength(0)
    expect(findHandStampedIdentity('// the link carries ?_pid=${token}')).toHaveLength(0)
    expect(findHandStampedIdentity(' * stamps `_pid=<token>` on every link')).toHaveLength(0)
  })
})

describe('check-identity-loop — rule 3: no email in a URL', () => {
  it('fires on URL builders', () => {
    expect(findRawEmailInUrl("url.searchParams.set('email', email)")).toHaveLength(1)
    expect(findRawEmailInUrl('const href = `/unsubscribe?email=${email}`')).toHaveLength(1)
  })
  it('does not fire on a form body', () => {
    expect(findRawEmailInUrl("formData.set('email', email.trim())")).toHaveLength(0)
  })
})

describe('check-identity-loop — rules 4-7: wiring on the real tree', () => {
  const read = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : null)
  it('is fully wired today', () => {
    expect(missingWiring(read)).toEqual([])
  })
  it('fires when the track route stops resolving the token', () => {
    const broken = (f) =>
      f === 'app/api/visitors/track/route.ts' ? (read(f) ?? '').replaceAll('verifyPersonLinkToken(', 'nope(') : read(f)
    expect(missingWiring(broken).map((m) => m.why)).toContain('track route no longer verifies the signed ?_pid= token')
  })
  it('fires when the activity view loses its query', () => {
    const broken = (f) =>
      f === 'app/admin/(protected)/visitors/live/KnownPeople.tsx' ? '' : read(f)
    expect(missingWiring(broken).map((m) => m.why)).toContain('Known people no longer reads getActiveKnownPeople')
  })
  it('fires when Known people stops screening scripted form submits', () => {
    const broken = (f) =>
      f === 'lib/data/crm/getSiteActivity.ts' ? (read(f) ?? '').replaceAll('isSuspectContact(', 'keepEveryone(') : read(f)
    expect(missingWiring(broken).map((m) => m.why)).toContain(
      'Known people no longer screens out scripted form submits (quality:suspect)',
    )
  })
  // Rules 9 and 10 hold the GUARDS. Each case removes exactly one guard's call site and
  // leaves everything else in the file (the definition it calls, the docblock that names
  // it), which is how the first version of these rules stayed green with a guard gone.
  const GUARDS = [
    ['app/actions/identity-bridge.ts', ".automated) return 'automated'", '.automated) return null', 'the identify actions no longer refuse an automated request'],
    ['app/actions/identity-bridge.ts', 'if (result.automated) return { ok: false', 'if (false) return { ok: false', 'the email-click identify action no longer stops for a session flagged as automation (it would cookie and stitch a scripted browser)'],
    ['app/actions/identity-bridge.ts', 'if (backfill.automated) return { ok: true, bridged: false }', 'if (false) return { ok: true, bridged: false }', 'the sign-in bridge no longer stops for a session flagged as automation'],
    ['app/actions/identity-bridge.ts', 'if (validSessionId && (await isAutomatedSession(validSessionId))) return', 'if (false) return', 'the sign-in bridge (no contact yet) no longer stops for a session flagged as automation'],
    ['lib/visitor-backfill.ts', 'if (sessionIsAutomation(session)) {', 'if (false) {', 'backfillSessionToFub no longer refuses a session flagged as automation'],
    ['lib/visitor-backfill.ts', 'if (backfill.automated) return', 'if (false) return', 'the form-submit stitch no longer skips a session flagged as automation'],
    ['app/api/visitors/track/route.ts', '!minimalOnly && !automation.automated', '!minimalOnly', 'the looking-at broker alert can fire for automation'],
    ['app/api/visitors/track/route.ts', "!automation.automated && (eventType === 'page_view'", "(eventType === 'page_view'", 'the "they opened the report" broker alert can fire for automation'],
    ['app/api/track/e/open/route.ts', 'if (slug && !automated) await queueCmaOpenedAlert(', 'if (slug) await queueCmaOpenedAlert(', 'the email open pixel can fire the "they opened the report" alert for automation'],
    ['app/api/track/e/click/route.ts', 'if (automation.automated) {', 'if (false) {', 'the email click redirect no longer diverts automation from the ordinary click record'],
    ['app/api/track/e/click/route.ts', "event: 'click_automated'", "event: 'click'", 'the email click redirect records automation as an ordinary click'],
    ['public/rr-doc-tracker.js', "if (consentAtArrival() === 'declined') {", 'if (false) {', 'the client-document tracker no longer stops for a visitor who declined'],
    ['public/rr-doc-tracker.js', 'campaign: source.campaign', 'campaign: undefined', 'the client-document tracker no longer sends the arrival campaign'],
    ['app/api/visitors/track/route.ts', "body.pageCategory !== 'client-document'", 'true', 'a consented reader of a client document can drop out of the GA4 mirror (the document runs no gtag)'],
    ['components/site/v3/V3SectionTracker.client.tsx', 'const ctx = firstPartyEventContext()', 'const ctx = null', 'V3SectionTracker no longer posts the shared context (consent, session, campaign)'],
    ['components/site/v3/V3SectionTracker.client.tsx', "if (level !== 'all' && level !== 'analytics') return", 'if (false) return', 'V3SectionTracker posts empty section and scroll rows for a visitor at the essential tier'],
    // the review of 2026-09-30
    ['app/actions/identity-bridge.ts', ", webdriver: signals?.webdriver === true })", ' })', 'the identify actions no longer refuse an automated request'],
    ['components/PersonIdentityBridge.tsx', ', { webdriver: navigator.webdriver === true })', ')', 'the identity bridge no longer tells the identify action the browser is automated (the session row may not say)'],
    ['app/api/track/e/identify/route.ts', 'identifyPersonFromEmailClickNative(pid, sid, { webdriver })', 'identifyPersonFromEmailClickNative(pid, sid)', 'the identify ping no longer passes the browser automation signal to the identify action'],
    ['components/VisitTracker.tsx', "    webdriver: typeof navigator !== 'undefined' && navigator.webdriver === true ? true : undefined,\n  }", '  }', 'the shared first-party context no longer carries the automation signal (a section view can create the session)'],
    ['lib/visitor-backfill.ts', '.or(NOT_AUTOMATION_FILTER)', '', 'the browser back-stitch identifies sessions flagged as automation'],
    ['public/rr-doc-tracker.js', 'if (gpcOn()) {', 'if (false) {', 'the client-document tracker posts or grants for a browser sending Global Privacy Control'],
    ['public/rr-doc-tracker.js', "var automated = navigator.webdriver === true ? '&webdriver=1' : ''", "var automated = ''", 'the client-document tracker no longer tells the identify ping the browser is automated'],
    ['lib/identity/consent.ts', 'void args.search', 'void 0', 'arrivalConsent reads the arrival query to auto-grant marketing from an ad click'],
    ['public/rr-doc-tracker.js', 'var consentAtArrival = function () {\n      return consentNow()\n    }', 'var consentAtArrival = function () {\n      return \'all\'\n    }', 'the client-document tracker auto-grants marketing from a campaign link'],
    ['components/PersonIdentityBridge.tsx', 'const sessionId = await postedSession(IDENTIFY_WAIT_MS)', 'const sessionId = readRrSessionId()', "the identity bridge identifies the session in storage before the click, not the one the tracker's first post landed in"],
    ['components/VisitTracker.tsx', "if (typeof payload.sessionId === 'string') notePostedSession(payload.sessionId)", 'void 0', 'VisitTracker no longer says which session its posts landed in (the identity bridge waits for it)'],
    ['lib/visitor-backfill.ts', 'const NOT_AUTOMATION_FILTER = IDENTIFIABLE_SESSION_FILTER', "const NOT_AUTOMATION_FILTER = 'is_automated.eq.false'", 'the back-stitch filter is written out by hand again, free to drift from the rule the identify paths read'],
    ['lib/visitor-backfill.ts', 'return sessionBlocksIdentification(row)', 'return row?.is_automated === true', 'sessionIsAutomation restates the automation rule instead of reading the one definition'],
    ['lib/data/crm/getSiteActivity.ts', 'const HUMAN_SESSION_OR = IDENTIFIABLE_SESSION_FILTER', "const HUMAN_SESSION_OR = 'is_automated.eq.false'", 'Known people restates the automation rule instead of reading the one definition'],
    ['app/api/track/e/click/route.ts', 'NextResponse.redirect(withoutIdentityOnOwnSite(target), 302)', 'NextResponse.redirect(identityCarryingTarget(target, ctx), 302)', 'the email click redirect hands automation a signed person token (a gateway sandbox would be identified as the contact)'],
    ['app/r/[code]/route.ts', ': withoutIdentityOnOwnSite(resolved.targetUrl)', ': stampIdentityOnOwnSite(resolved.targetUrl, resolved.personId, resolved.broker)', 'the SMS short-link redirect hands a link previewer a signed person token'],
    ['public/rr-doc-tracker.js', 'body: JSON.stringify({ gpc: true }),', 'body: JSON.stringify({ gpc: true, url: location.href }),', "the client-document tracker's GPC notice carries more than the signal"],
    ['components/VisitTracker.tsx', '  if (gpcOn()) return null\n', '', 'the site tracker writes a session id for a browser sending Global Privacy Control'],
    ['components/VisitTracker.tsx', '  if (gpcOn()) {\n    sendGpcNotice()\n    return\n  }\n', '', 'the site tracker posts events for a browser sending Global Privacy Control'],
    ['components/VisitTracker.tsx', 'body: JSON.stringify({ gpc: true }),', 'body: JSON.stringify({ gpc: true, sessionId: currentSessionId() }),', "the site tracker's GPC notice carries more than the signal"],
    ['app/api/visitors/track/route.ts', 'const crmPersonId = gpcSb ? await gpcKnownContact(request, body, gpcSb) : null', 'const crmPersonId = null', 'the track route no longer finds the contact a GPC browser already carries (the notice has no session id)'],
    ['app/api/visitors/track/route.ts', '  if (gpcOptOut) {\n', '  if (false) {\n', 'the track route checks the session id or the consent before GPC (the GPC notice has neither)'],
    ['components/search/search-events.client.ts', "if (currentConsentLevel() === 'declined' || gpcFromNavigator(navigator)) return", 'void 0', 'the search events record a visitor who declined or sends Global Privacy Control'],
    ['app/actions/track-user-event.ts', "if (!recordingAllowed({ consentCookie: cookieStore.get(CONSENT_COOKIE)?.value ?? null, secGpc: hdrs.get('sec-gpc') })) return", 'void 0', 'trackUserEvent records a visitor who declined or sends Global Privacy Control'],
    ['lib/analytics/visitor-session.ts', 'const storedRecord: SessionRecord | null = visit ? { ...visit, ...parseBinding(rawBinding) } : null', 'const storedRecord: SessionRecord | null = visit', 'the session rule reads the session id out of rr_visit_v1, which the tracker deployed before the rule rewrites without it (every such event would split the visit)'],
    ['public/rr-doc-tracker.js', 'storedRecord = { id: visit.id, n: visit.n, last: visit.last, sid: binding.sid, s: binding.s, c: binding.c }', 'storedRecord = visit', 'the client-document tracker reads the session id out of rr_visit_v1, which the tracker deployed before the rule rewrites without it'],
    ['lib/analytics/visitor-session.ts', "if (typeof window !== 'undefined') memory.arrival = readPageArrival()", 'void 0', "the session module no longer records the page's arrival when it loads (a tap before the tracker mounts would be judged instead)"],
    ['lib/analytics/visitor-session.ts', 'opts.search ?? (firstOfPageLoad ? loaded.search : window.location.search)', 'opts.search ?? window.location.search', 'the session rule judges the first event of a page load on the current address, not the one the page loaded at'],
    ['public/rr-doc-tracker.js', 'var campaign = campaignKeyFromSearch(firstOfPageLoad ? loaded.search : location.search)', 'var campaign = campaignKeyFromSearch(location.search)', 'the client-document tracker judges the first event of a page load on the current address, not the one the page loaded at'],
    ['lib/analytics/visitor-session.ts', 'arrival: arrival ? campaign : null })', 'arrival: campaign })', 'the session rule compares the campaign of every event, not only of an arrival (every tap on a tagged page can end the session)'],
    ['lib/analytics/visitor-session.ts', "if (!args.record || args.record.sid !== args.sessionId) return { newSession: true, reason: 'unrecorded' }", "if (!args.record) return { newSession: false, reason: null }", 'the session rule keeps a session id no lifecycle record names (one from before the rule)'],
    ['public/rr-doc-tracker.js', 'decideSession(state.sid, record, now, arrival ? campaign : null)', 'decideSession(state.sid, record, now, campaign)', 'the client-document tracker compares the campaign of every event, not only of an arrival'],
    ['public/rr-doc-tracker.js', "if (!record || record.sid !== sessionId) return { newSession: true, reason: 'unrecorded' }", "if (!record) return { newSession: false, reason: null }", 'the client-document tracker keeps a session id no lifecycle record names (one from before the rule)'],
  ]

  it.each(GUARDS)('fires when the guard in %s is removed (%s)', (file, from, to, why) => {
    const source = read(file) ?? ''
    expect(source.includes(from)).toBe(true) // the fixture still matches the real code
    const broken = (f) => (f === file ? source.replace(from, to) : read(f))
    expect(missingWiring(broken).map((m) => m.why)).toContain(why)
  })

  it('a comment cannot stand in for a guard', () => {
    const file = 'lib/visitor-backfill.ts'
    const source = read(file) ?? ''
    const guard = 'if (sessionIsAutomation(session)) {'
    expect(source.includes(guard)).toBe(true)
    const commented = (f) => (f === file ? source.replace(guard, `// ${guard}`) : read(f))
    expect(missingWiring(commented).map((m) => m.why)).toContain(
      'backfillSessionToFub no longer refuses a session flagged as automation',
    )
    // ... and a block comment, over several lines, is stripped too
    const blocked = (f) => (f === file ? source.replace(guard, `/* ${guard}\n*/`) : read(f))
    expect(missingWiring(blocked).map((m) => m.why)).toContain(
      'backfillSessionToFub no longer refuses a session flagged as automation',
    )
  })

  it('the definition of sessionIsAutomation and the docblocks that name click_automated do not satisfy the rules by themselves', () => {
    const noCallSites = (f) => {
      if (f === 'lib/visitor-backfill.ts') return (read(f) ?? '').replaceAll('sessionIsAutomation(session)', 'false')
      if (f === 'app/api/track/e/click/route.ts') return (read(f) ?? '').replaceAll("event: 'click_automated'", "event: 'click'")
      return read(f)
    }
    const why = missingWiring(noCallSites).map((m) => m.why)
    expect(why).toContain('backfillSessionToFub no longer refuses a session flagged as automation')
    expect(why).toContain('the email click redirect records automation as an ordinary click')
  })

  it('the GPC gate must come before the session id and consent checks, not merely exist', () => {
    const file = 'app/api/visitors/track/route.ts'
    const source = read(file) ?? ''
    const start = source.indexOf('  // ─── GPC opt-out gate')
    const end = source.indexOf('  const sessionId = body.sessionId?.trim()')
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
    // move the gate below the session id check: it still exists, but the notice (no session id) would 400 first
    const gate = source.slice(start, end)
    const moved = source.slice(0, start) + source.slice(end).replace('\n\n', `\n\n${gate}`)
    expect(moved.includes('if (gpcOptOut) {')).toBe(true)
    const broken = (f) => (f === file ? moved : read(f))
    expect(missingWiring(broken).map((m) => m.why)).toContain('the track route checks the session id or the consent before GPC (the GPC notice has neither)')
  })

  it('fires when a file the contract names disappears', () => {
    const broken = (f) => (f === 'lib/data/crm/getSiteActivity.ts' ? null : read(f))
    expect(missingWiring(broken).some((m) => m.file === 'lib/data/crm/getSiteActivity.ts')).toBe(true)
  })
})
