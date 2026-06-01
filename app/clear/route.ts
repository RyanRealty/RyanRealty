import { NextResponse } from 'next/server'

/**
 * GET /clear — one-visit browser reset.
 *
 * The apex domain previously served a different stack that may have installed a
 * service worker and HTTP caches. A returning visitor's browser can keep serving
 * that stale shell, hiding the live site. StaleServiceWorkerReset evicts it from
 * the page, but a stale SW can serve an old shell that never runs that code — a
 * catch-22. This route breaks it server-side: the `Clear-Site-Data` response
 * header tells the browser to unregister all service workers and delete every
 * cache / storage bucket for the origin (cookies are intentionally left intact,
 * so the visitor stays signed in), then redirects home.
 *
 * Tell anyone stuck on a stale view: visit https://ryan-realty.com/clear once.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(): NextResponse {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="1; url=/">
<title>Refreshing Ryan Realty…</title></head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:1.5rem">
<div><p style="font-size:1.1rem;margin:0 0 .5rem">Clearing cached data…</p>
<p style="opacity:.7;margin:0">Loading the live site. <a href="/">Continue</a></p></div>
</body></html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Unregister service workers + wipe cache/storage for the origin.
      'Clear-Site-Data': '"cache", "storage"',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
