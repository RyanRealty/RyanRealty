/**
 * rr-doc-tracker — visitor tracking + email-click identity for RAW-HTML client
 * documents (the /cma/[slug] and /bpo/[slug] route handlers serve stored HTML,
 * so none of the site's React trackers run there).
 *
 * Injected at serve time by those route handlers. Does three things, in order:
 *   1. Posts a page_view to /api/visitors/track with the SAME localStorage
 *      session id ('rr_session_id') the site snippet uses, at 'essential'
 *      consent (no banner exists on a client document; minimal record only).
 *   2. If the URL carries ?_pid= (the SIGNED person token, P7 identity loop)
 *      from a tracked link, forwards it with the page_view (the track route
 *      verifies it and identifies the visit) and calls /api/track/e/identify as
 *      a second path (rr_pid cookie + history backfill). `?_fuid=` is retired
 *      and identifies nobody.
 *   3. Strips the identity params from the address bar.
 *
 * Fails silent by design: a tracking error must never break the document.
 */
(function () {
  try {
    var KEY = 'rr_session_id'
    var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    var mintSid = function () {
      var fresh = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
          })
      try { localStorage.setItem(KEY, fresh) } catch (e) { /* storage blocked */ }
      return fresh
    }
    var sid = null
    try { sid = localStorage.getItem(KEY) } catch (e) { /* storage blocked */ }
    if (!sid || !UUID.test(sid)) sid = mintSid()

    var params = new URLSearchParams(location.search)
    var pid = params.get('_pid')
    var fuid = params.get('_fuid')
    // The stored page_url never carries identity params (privacy rule: no
    // personal identifiers in stored URLs).
    var cleanUrl = location.origin + location.pathname

    var postView = function (sessionId) {
      return fetch('/api/visitors/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        credentials: 'same-origin',
        body: JSON.stringify({
          sessionId: sessionId,
          sourceDomain: 'ryan-realty.com',
          eventType: 'page_view',
          pageUrl: cleanUrl,
          pageTitle: document.title || undefined,
          pageCategory: 'client-document',
          referrer: document.referrer || undefined,
          landingPage: cleanUrl,
          consent: 'essential',
          // The signed person token from the link we sent (P7 identity loop): the
          // track route verifies it and identifies this visit server-side.
          identityToken: pid || undefined,
          webdriver: navigator.webdriver === true ? true : undefined,
        }),
      })
    }
    // The track route answers rotateSession when this browser session already
    // belongs to a DIFFERENT contact (a shared device, a forwarded link): start
    // a fresh session and re-send once so the view lands on the recipient
    // (lib/identity/arrival.ts, same rule as components/VisitTracker.tsx).
    var track = postView(sid)
      .then(function (r) { return r && r.ok ? r.json() : null })
      .then(function (j) {
        if (j && j.rotateSession) {
          sid = mintSid()
          return postView(sid)
        }
      })
      .catch(function () {})

    var finish = function () {
      if (pid || fuid) {
        var q = pid ? '_pid=' + encodeURIComponent(pid) : '_fuid=' + encodeURIComponent(fuid)
        fetch('/api/track/e/identify?' + q + '&sid=' + encodeURIComponent(sid), {
          credentials: 'same-origin',
          keepalive: true,
        }).catch(function () {})
        params.delete('_pid')
        params.delete('_fuid')
        var qs = params.toString()
        try {
          history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash)
        } catch (e) { /* ignore */ }
      }
    }
    if (track && track.finally) track.finally(finish)
    else finish()

    // Click tracking (Matt 2026-08-05: the document tracks every click like
    // the site's pages). One delegated listener; every anchor tap posts a
    // cta_click with the destination + the link text, same endpoint, same
    // essential-consent record. Fails silent; navigation is never blocked.
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
          fetch('/api/visitors/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            credentials: 'same-origin',
            body: JSON.stringify({
              sessionId: sid,
              sourceDomain: 'ryan-realty.com',
              eventType: 'cta_click',
              pageUrl: cleanUrl,
              pageTitle: (el.textContent || '').trim().slice(0, 80) || href.slice(0, 80),
              pageCategory: 'client-document',
              consent: 'essential',
              metadata: { destination: destination },
            }),
          }).catch(function () {})
        } catch (e) { /* never break a click */ }
      },
      true,
    )
  } catch (e) { /* never break the document */ }
})()
