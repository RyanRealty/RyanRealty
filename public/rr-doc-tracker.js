/**
 * rr-doc-tracker — visitor tracking + email-click identity for RAW-HTML client
 * documents (the /cma/[slug] and /bpo/[slug] route handlers serve stored HTML,
 * so none of the site's React trackers run there).
 *
 * Injected at serve time by those route handlers. Does three things, in order:
 *   1. Posts a page_view to /api/visitors/track with the SAME localStorage
 *      session id ('rr_session_id') the site snippet uses, at 'essential'
 *      consent (no banner exists on a client document; minimal record only).
 *   2. If the URL carries ?_pid= (native crm_people.id) or ?_fuid= (legacy id)
 *      from a tracked email link, calls /api/track/e/identify so the session
 *      stitches to the contact server-side (rr_pid cookie + history backfill).
 *   3. Strips the identity params from the address bar.
 *
 * Fails silent by design: a tracking error must never break the document.
 */
(function () {
  try {
    var KEY = 'rr_session_id'
    var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    var sid = null
    try { sid = localStorage.getItem(KEY) } catch (e) { /* storage blocked */ }
    if (!sid || !UUID.test(sid)) {
      sid = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
          })
      try { localStorage.setItem(KEY, sid) } catch (e) { /* storage blocked */ }
    }

    var params = new URLSearchParams(location.search)
    var pid = params.get('_pid')
    var fuid = params.get('_fuid')
    // The stored page_url never carries identity params (privacy rule: no
    // personal identifiers in stored URLs).
    var cleanUrl = location.origin + location.pathname

    var track = fetch('/api/visitors/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      credentials: 'same-origin',
      body: JSON.stringify({
        sessionId: sid,
        sourceDomain: 'ryan-realty.com',
        eventType: 'page_view',
        pageUrl: cleanUrl,
        pageTitle: document.title || undefined,
        pageCategory: 'client-document',
        referrer: document.referrer || undefined,
        landingPage: cleanUrl,
        consent: 'essential',
      }),
    }).catch(function () {})

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
  } catch (e) { /* never break the document */ }
})()
