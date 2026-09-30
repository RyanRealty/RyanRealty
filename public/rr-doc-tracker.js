/**
 * rr-doc-tracker — visitor tracking + email-click identity for RAW-HTML client
 * documents (the /cma/[slug] and /bpo/[slug] route handlers serve stored HTML,
 * so none of the site's React trackers run there).
 *
 * Injected at serve time by those route handlers. It records a document view
 * exactly the way the site's own tracker (components/VisitTracker.tsx) records a
 * page view, because both write the same session in the same table:
 *   1. Works out the visitor's tracking tier from the cookie banner's answer, with
 *      the same rules as VisitTracker, including the campaign-link grant. A
 *      visitor who DECLINED gets nothing from this script: no page view, no click
 *      event, no identification. A browser sending Global Privacy Control gets the
 *      same, and no consent cookie either (the grant never applies to it); the one
 *      thing sent is the notice the site tracker sends too, `{ gpc: true }` and
 *      nothing else, so the track route can suppress a contact it already knows.
 *   2. Applies the session rule (a new session after 30 minutes idle, on an
 *      arrival from a different campaign, or when the stored id is one the rule
 *      did not start) to the 'rr_session_id' every tracker shares. Only the page
 *      view of a page the browser navigated to from outside the site is an
 *      arrival: a tap, a reload or the back button carries the same address, utm
 *      tags and all, and never ends the session on its campaign.
 *   3. Posts a page_view to /api/visitors/track carrying the real URL and the
 *      arrival attribution (campaign, click ids, referrer, landing page) VisitTracker
 *      sends. visitor_sessions keeps the first-touch fields of the first event a
 *      session id ever sends, so a report opened BEFORE any public page used to
 *      create the session with no campaign or click id and a landing page stripped
 *      of its query, and the campaign on the email link was lost for good.
 *   4. If the URL carries ?_pid= (the SIGNED person token, P7 identity loop) from a
 *      tracked link, forwards it with the page_view (the track route verifies it
 *      and identifies the visit) and calls /api/track/e/identify as a second path
 *      (rr_pid cookie + history backfill). `?_fuid=` is retired and identifies
 *      nobody.
 *   5. Strips the identity params from the address bar.
 *
 * THIS FILE CANNOT IMPORT, SO IT MIRRORS. Each block below says which TypeScript
 * function it copies; app/api/visitors/track/doc-tracker.pin.test.ts runs this script
 * and those functions over the same cookies, URLs and timelines and fails when
 * they disagree:
 *   consent      lib/identity/consent.ts   parseConsentCookie, trackingLevelFromConsent,
 *                                          isAdTrafficSearch, arrivalConsent, gpcFromNavigator
 *                components/CookieConsentBanner.tsx   getConsent, setConsentState
 *   session      lib/analytics/visitor-session.ts     campaignKeyFromSearch,
 *                                          referrerIsThisSite, isExternalArrival,
 *                                          pageNavigationType, pageArrival, readState,
 *                                          writeRecord, decideSession, advanceSession,
 *                                          forceNewSession
 *   first touch  lib/analytics/visitor-session.ts     captureSource
 * Change one side and that test names the other.
 *
 * Fails silent by design: a tracking error must never break the document.
 * ES5 SYNTAX on purpose (no arrow functions, let/const, template strings or trailing
 * commas in a call): it is served as-is to whatever browser opens the email, and a
 * parse error is the one failure the try/catch below cannot catch. It needs fetch,
 * URLSearchParams and URL at run time; a browser without them records nothing and the
 * document is untouched. app/api/visitors/track/doc-tracker.syntax.test.ts holds the
 * syntax to ES5.
 */
(function () {
  try {
    // ── consent: mirror of lib/identity/consent.ts ────────────────────────────
    var CONSENT_COOKIE = 'ryan_realty_cookie_consent'
    var CONSENT_EXPIRY_YEARS = 1

    // parseConsentCookie
    var parseConsentCookie = function (raw) {
      var value = typeof raw === 'string' ? raw.trim() : ''
      if (!value) return null
      try {
        var parsed = JSON.parse(decodeURIComponent(value))
        return { analytics: Boolean(parsed.analytics), marketing: Boolean(parsed.marketing) }
      } catch (e) {
        if (value === 'all') return { analytics: true, marketing: true }
        return { analytics: false, marketing: false }
      }
    }
    // trackingLevelFromConsent
    var trackingLevelFromConsent = function (stored) {
      if (stored === null) return 'essential'
      if (stored.analytics && stored.marketing) return 'all'
      if (stored.analytics) return 'analytics'
      if (stored.marketing) return 'essential'
      return 'declined'
    }
    // isAdTrafficSearch
    var isAdTrafficSearch = function (search) {
      var qs = new URLSearchParams(search || '')
      if (qs.has('fbclid') || qs.has('gclid') || qs.has('msclkid') || qs.has('ttclid')) return true
      var keys = Array.from(qs.keys())
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].toLowerCase().indexOf('utm_') === 0) return true
      }
      return false
    }
    // gpcFromNavigator: Global Privacy Control, a legally binding opt-out of sale and sharing
    var gpcOn = function () {
      try { return navigator.globalPrivacyControl === true } catch (e) { return false }
    }
    // CookieConsentBanner getConsent: the banner's cookie value, undecoded
    var readConsentCookie = function () {
      var rows = document.cookie.split('; ')
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].indexOf(CONSENT_COOKIE + '=') === 0) return rows[i].split('=')[1]
      }
      return undefined
    }
    // CookieConsentBanner setConsentState (the campaign-link grant writes this cookie)
    var writeConsentGrant = function () {
      var expires = new Date()
      expires.setFullYear(expires.getFullYear() + CONSENT_EXPIRY_YEARS)
      document.cookie =
        CONSENT_COOKIE + '=' + encodeURIComponent(JSON.stringify({ analytics: true, marketing: true })) +
        '; path=/; expires=' + expires.toUTCString() + '; SameSite=Lax'
    }
    // The tier right now (VisitTracker currentConsentLevel).
    var consentNow = function () {
      return trackingLevelFromConsent(parseConsentCookie(readConsentCookie()))
    }
    // The tier for THIS page load (VisitTracker's mount effect: autoGrantConsentForAdTraffic,
    // then currentConsentLevel; the rule is arrivalConsent, on the link the page arrived by).
    // A visitor who never answered the banner and arrived on a campaign or ad link is granted
    // analytics + marketing; an explicit answer, a decline included, is never overridden, and
    // Global Privacy Control is never read as a grant.
    var consentAtArrival = function () {
      if (parseConsentCookie(readConsentCookie()) === null && !gpcOn() && isAdTrafficSearch(loaded.search)) {
        try { writeConsentGrant() } catch (e) { /* the grant still applies to this view */ }
        return 'all'
      }
      return consentNow()
    }

    // ── session: mirror of lib/analytics/visitor-session.ts ───────────────────
    var SESSION_KEY = 'rr_session_id'
    // the lifecycle record is one record in two keys: the visit { id, n, last } (the key the
    // tracker deployed before the rule rewrites in that shape) and the session it belongs to
    // { sid, s, c } in a key of its own, so that rewrite never erases the session id
    var STATE_KEY = 'rr_visit_v1'
    var BINDING_KEY = 'rr_visit_sid_v1'
    var SOURCE_KEY = 'rr_source_v1'
    var IDLE_MS = 30 * 60 * 1000
    var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    // this page's own copy of the session, and whether an event of this page load has been accounted
    var memory = { sid: null, record: null, eventAccounted: false }

    var mintUuid = function () {
      var bytes = new Uint8Array(16)
      if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
      if (window.crypto && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes)
      else for (var i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
      bytes[6] = (bytes[6] & 0x0f) | 0x40
      bytes[8] = (bytes[8] & 0x3f) | 0x80
      var h = []
      for (var j = 0; j < 16; j++) h.push((bytes[j] < 16 ? '0' : '') + bytes[j].toString(16))
      return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' + h.slice(6, 8).join('') + '-' +
        h.slice(8, 10).join('') + '-' + h.slice(10).join('')
    }
    // parseVisit: the visit part of the record, or null when it is not one
    var parseVisit = function (raw) {
      if (!raw) return null
      var v
      try { v = JSON.parse(raw) } catch (e) { return null }
      var ok = !!v && typeof v === 'object' &&
        typeof v.id === 'number' && isFinite(v.id) &&
        typeof v.n === 'number' && isFinite(v.n) &&
        typeof v.last === 'number' && isFinite(v.last)
      return ok ? { id: v.id, n: v.n, last: v.last } : null
    }
    // parseBinding: the session part, or nothing (then no session id is kept)
    var parseBinding = function (raw) {
      if (!raw) return {}
      var v
      try { v = JSON.parse(raw) } catch (e) { return {} }
      if (!v || typeof v !== 'object' || typeof v.sid !== 'string' || !UUID.test(v.sid)) return {}
      return { sid: v.sid, s: typeof v.s === 'string' ? v.s : '', c: typeof v.c === 'string' ? v.c : '' }
    }
    // readState: the id and its record as ONE pair; this page's pair wins when it is newer
    // than storage's (a write that did not land), so an old id storage still holds is never
    // answered after a session ended here. The record is the visit with its session on it.
    var readState = function () {
      var storedSid = null
      var rawVisit = null
      var rawBinding = null
      try {
        var v = localStorage.getItem(SESSION_KEY)
        storedSid = v && UUID.test(v) ? v : null
        rawVisit = localStorage.getItem(STATE_KEY)
        rawBinding = localStorage.getItem(BINDING_KEY)
      } catch (e) { /* storage blocked: this page's memory is all there is */ }
      var visit = parseVisit(rawVisit)
      var storedRecord = null
      if (visit) {
        var binding = parseBinding(rawBinding)
        storedRecord = { id: visit.id, n: visit.n, last: visit.last, sid: binding.sid, s: binding.s, c: binding.c }
      }
      var mem = memory.record
      if (mem && (!storedRecord || mem.last > storedRecord.last)) return { sid: memory.sid, record: mem }
      return { sid: storedSid || memory.sid, record: storedRecord || mem }
    }
    var writeSid = function (id) {
      memory.sid = id
      try { localStorage.setItem(SESSION_KEY, id) } catch (e) { /* memory keeps it */ }
      try { sessionStorage.setItem(SESSION_KEY, id) } catch (e) { /* localStorage still stitches */ }
    }
    // writeRecord: the session first, then the visit, and not the visit when the session did not land
    var writeRecord = function (record) {
      memory.record = record
      try {
        localStorage.setItem(BINDING_KEY, JSON.stringify({ sid: record.sid, s: record.s == null ? '' : record.s, c: record.c == null ? '' : record.c }))
        localStorage.setItem(STATE_KEY, JSON.stringify({ id: record.id, n: record.n, last: record.last }))
      } catch (e) { /* memory keeps it */ }
    }
    var clearSourceCache = function () {
      try { sessionStorage.removeItem(SOURCE_KEY) } catch (e) { /* recomputed on the next capture */ }
    }

    // campaignKeyFromSearch: null when the URL carries neither utm_source nor utm_campaign
    var normalizeCampaignValue = function (v) {
      return String(v == null ? '' : v).trim().toLowerCase().slice(0, 100)
    }
    var campaignKeyFromSearch = function (search) {
      var qs = new URLSearchParams(search || '')
      var source = normalizeCampaignValue(qs.get('utm_source'))
      var campaign = normalizeCampaignValue(qs.get('utm_campaign'))
      return source || campaign ? { source: source, campaign: campaign } : null
    }
    // referrerIsThisSite: the same host, with or without www
    var siteHost = function (hostname) {
      return String(hostname).toLowerCase().replace(/^www\./, '')
    }
    var referrerIsThisSite = function (referrer, hostname) {
      if (!referrer) return false
      try {
        return siteHost(new URL(referrer).hostname) === siteHost(hostname)
      } catch (e) {
        return false
      }
    }
    // isExternalArrival: the first event of a page load the browser navigated to from outside the site
    var isExternalArrival = function (firstEventOfPageLoad, navigationType, referrer, hostname) {
      return firstEventOfPageLoad && navigationType === 'navigate' && !referrerIsThisSite(referrer, hostname)
    }
    // pageNavigationType: 'navigate', 'reload', 'back_forward', 'prerender', or null
    var pageNavigationType = function () {
      if (typeof performance === 'undefined') return null
      try {
        var entry = performance.getEntriesByType('navigation')[0]
        if (entry && typeof entry.type === 'string') return entry.type
      } catch (e) { /* no Navigation Timing entries: try the older interface */ }
      try {
        var legacy = performance.navigation ? performance.navigation.type : undefined
        if (legacy === 0) return 'navigate'
        if (legacy === 1) return 'reload'
        if (legacy === 2) return 'back_forward'
      } catch (e) { /* none */ }
      return null
    }
    // pageArrival: how this page loaded (its address, referrer and navigation type), recorded
    // now, as the script first runs; the first event of the page load is judged on it and a
    // later one on the current address
    var loaded = { search: location.search, href: location.href, referrer: document.referrer, navigationType: pageNavigationType() }
    // decideSession: 30 minutes idle, an arrival on a different campaign (Google Analytics' session
    // rule), or a stored id no record names (one from before the rule is never kept)
    var decideSession = function (sessionId, record, now, arrival) {
      if (!sessionId) return { newSession: true, reason: 'first' }
      if (!record || record.sid !== sessionId) return { newSession: true, reason: 'unrecorded' }
      if (now - record.last > IDLE_MS) return { newSession: true, reason: 'idle' }
      if (arrival && (arrival.source !== (record.s == null ? '' : record.s) ||
          arrival.campaign !== (record.c == null ? '' : record.c))) {
        return { newSession: true, reason: 'campaign' }
      }
      return { newSession: false, reason: null }
    }
    // advanceSession: account for ONE tracked event; returns the session and visit it belongs to,
    // and the address the event is judged on (its first touch is captured from it)
    var advanceSession = function () {
      var now = Date.now()
      var firstOfPageLoad = !memory.eventAccounted
      var pageHref = firstOfPageLoad ? loaded.href : location.href
      var campaign = campaignKeyFromSearch(firstOfPageLoad ? loaded.search : location.search)
      var arrival = isExternalArrival(firstOfPageLoad, loaded.navigationType, loaded.referrer, location.hostname)
      memory.eventAccounted = true
      var state = readState()
      var record = state.record
      var decision = decideSession(state.sid, record, now, arrival ? campaign : null)
      var sessionId = state.sid
      if (decision.newSession || !sessionId) {
        sessionId = mintUuid()
        writeSid(sessionId)
        clearSourceCache() // the new session captures ITS arrival, not the cached one
      }
      var next
      if (decision.newSession) {
        next = {
          id: Math.floor(now / 1000),
          n: (record ? record.n : 0) + 1,
          last: now,
          sid: sessionId,
          s: campaign ? campaign.source : '',
          c: campaign ? campaign.campaign : '',
        }
      } else {
        next = { id: record.id, n: record.n, last: now, sid: sessionId, s: record.s, c: record.c }
      }
      writeRecord(next)
      return { sessionId: sessionId, visit: { id: next.id, number: next.n, start: decision.newSession }, pageHref: pageHref }
    }
    // forceNewSession: the server said this browser session belongs to a different contact
    var forceNewSession = function () {
      var id = mintUuid()
      try {
        localStorage.removeItem(SESSION_KEY)
        sessionStorage.removeItem(SESSION_KEY)
      } catch (e) { /* writeSid still stores the id where it can */ }
      writeSid(id)
      clearSourceCache()
      var record = readState().record
      if (record) {
        writeRecord({ id: record.id, n: record.n, last: record.last, sid: id, s: record.s, c: record.c })
      }
      return id
    }

    // ── first touch: mirror of captureSource in lib/analytics/visitor-session.ts ──
    var captureSource = function (pageHref) {
      try {
        var cached = sessionStorage.getItem(SOURCE_KEY)
        if (cached) return JSON.parse(cached)
      } catch (e) { /* recompute */ }
      var href = pageHref || location.href
      var search = location.search
      try { search = new URL(href).search } catch (e) { /* an address that does not parse: the current page's query */ }
      var params = new URLSearchParams(search || '')
      var src = {
        utm_source: params.get('utm_source') == null ? undefined : params.get('utm_source'),
        utm_medium: params.get('utm_medium') == null ? undefined : params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign') == null ? undefined : params.get('utm_campaign'),
        utm_content: params.get('utm_content') == null ? undefined : params.get('utm_content'),
        utm_term: params.get('utm_term') == null ? undefined : params.get('utm_term'),
      }
      var fbclid = params.get('fbclid') == null ? undefined : params.get('fbclid')
      var gclid = params.get('gclid') == null ? undefined : params.get('gclid')
      var referrer = document.referrer || undefined
      var medium = function (m) { if (!src.utm_medium) src.utm_medium = m }
      if (!src.utm_source && referrer) {
        try {
          var host = new URL(referrer).hostname.toLowerCase()
          if (/facebook|fb\.com/.test(host)) { src.utm_source = 'facebook'; medium('social') }
          else if (/instagram/.test(host)) { src.utm_source = 'instagram'; medium('social') }
          else if (/\bgoogle\./.test(host)) { src.utm_source = 'google'; medium('organic') }
          else if (/bing|duckduckgo/.test(host)) { src.utm_source = host.split('.')[0]; medium('organic') }
          else if (/youtube/.test(host)) { src.utm_source = 'youtube'; medium('social') }
          else if (/linkedin/.test(host)) { src.utm_source = 'linkedin'; medium('social') }
          else if (/tiktok/.test(host)) { src.utm_source = 'tiktok'; medium('social') }
          else if (/zillow|realtor|trulia/.test(host)) { src.utm_source = host.replace(/^www\./, '').split('.')[0]; medium('portal') }
          else if (host && host !== location.hostname) { src.utm_source = host; medium('referral') }
        } catch (e) { /* unparseable referrer: no inference */ }
      }
      if (!src.utm_source) { src.utm_source = 'direct'; medium('none') }
      var result = {
        campaign: {
          source: src.utm_source,
          medium: src.utm_medium,
          campaign: src.utm_campaign,
          content: src.utm_content,
          term: src.utm_term,
        },
        fbclid: fbclid,
        gclid: gclid,
        referrer: referrer,
        landingPage: href,
      }
      try { sessionStorage.setItem(SOURCE_KEY, JSON.stringify(result)) } catch (e) { /* uncached */ }
      return result
    }

    // ── this page load ────────────────────────────────────────────────────────
    var params = new URLSearchParams(location.search)
    var pid = params.get('_pid')
    var fuid = params.get('_fuid')

    // Take the identity params out of the address bar so they are never
    // bookmarked, shared or copied (done even for a visitor who declined).
    var stripIdentityFromAddressBar = function () {
      if (!pid && !fuid) return
      params.delete('_pid')
      params.delete('_fuid')
      var qs = params.toString()
      try {
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash)
      } catch (e) { /* ignore */ }
    }

    // Global Privacy Control is an opt-out we honor before anything else: no consent
    // cookie is written (the campaign-link grant never applies to it), no identifier
    // is stored, no event is posted and nobody is identified (docs/TRACKING_POLICY.md,
    // the GPC tier). Checked before consentAtArrival, which is what writes the grant.
    // One notice carries the signal and nothing else, as the site tracker's does
    // (VisitTracker sendGpcNotice): the track route records a durable suppression for
    // a contact this browser was already identified as, from its own cookies.
    var sendGpcNotice = function () {
      try {
        fetch('/api/visitors/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          credentials: 'same-origin',
          body: JSON.stringify({ gpc: true }),
        }).catch(function () {})
      } catch (e) { /* never break the document */ }
    }
    if (gpcOn()) {
      sendGpcNotice()
      stripIdentityFromAddressBar()
      return
    }

    // A visitor who declined the cookie banner is recorded nowhere: this script
    // posts nothing and identifies nobody (docs/TRACKING_POLICY.md, the Declined tier).
    if (consentAtArrival() === 'declined') {
      stripIdentityFromAddressBar()
      return
    }

    // What every event carries: the session (the rule applied), the tier, and the
    // arrival attribution the server needs if THIS event creates the session.
    // (VisitTracker firstPartyEventContext.)
    var eventContext = function () {
      var level = consentNow()
      if (level === 'declined') return null
      var advanced = advanceSession()
      var source = captureSource(advanced.pageHref)
      return {
        sessionId: advanced.sessionId,
        sourceDomain: location.hostname.toLowerCase().replace(/^www\./, ''),
        campaign: source.campaign,
        fbclid: source.fbclid,
        gclid: source.gclid,
        referrer: source.referrer,
        landingPage: source.landingPage,
        consent: level,
        visit: advanced.visit,
        // automation signal (lib/analytics/automation.ts), on every event: whichever one
        // creates the session is the one the track route flags it from
        webdriver: navigator.webdriver === true ? true : undefined,
      }
    }
    var withFields = function (base, extra) {
      var out = {}
      for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k]
      for (var e in extra) if (Object.prototype.hasOwnProperty.call(extra, e)) out[e] = extra[e]
      return out
    }
    var send = function (body) {
      return fetch('/api/visitors/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
    }

    // The page view. `pageUrl` is the real URL, query and all: the track route
    // strips ?_pid= / ?_fuid= itself before it stores or forwards anything.
    var ctx = eventContext()
    var sid = ctx ? ctx.sessionId : null
    var track = null
    if (ctx) {
      var viewBody = withFields(ctx, {
        eventType: 'page_view',
        pageUrl: location.href,
        pageTitle: document.title || undefined,
        pageCategory: 'client-document',
        // The signed person token from the link we sent (P7 identity loop): the
        // track route verifies it and identifies this visit server-side.
        identityToken: pid || undefined,
      })
      // The track route answers rotateSession when this browser session already
      // belongs to a DIFFERENT contact (a shared device, a forwarded link): start
      // a fresh session and re-send once so the view lands on the recipient
      // (lib/identity/arrival.ts, same rule as components/VisitTracker.tsx).
      track = send(viewBody)
        .then(function (r) { return r && r.ok ? r.json() : null })
        .then(function (j) {
          if (j && j.rotateSession) {
            sid = forceNewSession()
            return send(withFields(viewBody, { sessionId: sid }))
          }
        })
        .catch(function () {})
    }

    var finish = function () {
      if ((pid || fuid) && sid) {
        var q = pid ? '_pid=' + encodeURIComponent(pid) : '_fuid=' + encodeURIComponent(fuid)
        // A GET the server cannot classify by itself: an automated browser with an
        // ordinary user agent says so here, and the identify action refuses it.
        var automated = navigator.webdriver === true ? '&webdriver=1' : ''
        fetch('/api/track/e/identify?' + q + '&sid=' + encodeURIComponent(sid) + automated, {
          credentials: 'same-origin',
          keepalive: true,
        }).catch(function () {})
      }
      stripIdentityFromAddressBar()
    }
    if (track && track.finally) track.finally(finish)
    else finish()

    // Click tracking (Matt 2026-08-05: the document tracks every click like
    // the site's pages). One delegated listener; every anchor tap posts a
    // cta_click with the destination + the link text, same endpoint, same tier
    // as the page view. A tap is tracked activity, so it goes through the same
    // context (session rule included) and nothing is posted once the visitor's
    // answer reads declined. Fails silent; navigation is never blocked.
    document.addEventListener(
      'click',
      function (ev) {
        try {
          var el = ev.target
          while (el && el !== document && el.tagName !== 'A') el = el.parentNode
          if (!el || el.tagName !== 'A') return
          var href = el.getAttribute('href') || ''
          if (!href || href.charAt(0) === '#') return
          var destination = href
          try {
            var destUrl = new URL(href, location.origin)
            destUrl.searchParams.delete('_pid')
            destUrl.searchParams.delete('_fuid')
            destination = destUrl.toString()
          } catch (e) { /* keep the raw href */ }
          var clickCtx = eventContext()
          if (!clickCtx) return
          send(withFields(clickCtx, {
            eventType: 'cta_click',
            pageUrl: location.href,
            pageTitle: (el.textContent || '').trim().slice(0, 80) || href.slice(0, 80),
            pageCategory: 'client-document',
            metadata: { destination: destination },
          })).catch(function () {})
        } catch (e) { /* never break a click */ }
      },
      true
    )
  } catch (e) { /* never break the document */ }
})()
