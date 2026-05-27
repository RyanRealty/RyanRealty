import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/meta/oauth-callback
 *
 * One-time Meta OAuth callback for minting a long-lived user access token
 * (Matt's personal FB user, who carries the Housing non-discrimination cert).
 *
 * Why this exists:
 *   The local mint flow at scripts/meta-user-mint-token.mjs needs an HTTPS
 *   redirect because the Ryan Realty Meta app has "Enforce HTTPS" locked ON
 *   (advanced-access scopes can't be downgraded). This route is the HTTPS
 *   endpoint Meta redirects to. It exchanges the code for a short-lived
 *   token, upgrades to long-lived (~60 day), and displays it for Matt to
 *   copy into .env.local.
 *
 * Auth model:
 *   - The route is public (Meta's OAuth flow can't carry a Bearer header).
 *   - The OAuth `state` parameter MUST match META_OAUTH_STATE env var.
 *   - Without that match, the route refuses to exchange the code.
 *   - This prevents random visitors from minting tokens against our app.
 *
 * Setup:
 *   1. Set META_OAUTH_STATE to a random string in Vercel + .env.local.
 *   2. Add https://ryanrealty.vercel.app/api/meta/oauth-callback to the
 *      app's Valid OAuth Redirect URIs.
 *   3. Visit the OAuth dialog URL with state=<same random string>.
 *   4. Approve. The browser lands here with ?code=... &state=...
 *   5. Page renders the access_token + expires_in. Copy the token,
 *      paste into .env.local as META_USER_ACCESS_TOKEN_USER.
 *
 * Single-use, kill after success: this route exists to bootstrap a long-
 * lived token. Once minted, the token survives ~60 days; delete this route
 * or rotate META_OAUTH_STATE to prevent re-use.
 */

const META_GRAPH = 'https://graph.facebook.com/v21.0'

function html(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
      body { font-family: ui-sans-serif, system-ui; max-width: 760px; margin: 40px auto; padding: 0 20px; }
      h1 { font-size: 20px; }
      pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; word-break: break-all; white-space: pre-wrap; }
      code { background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 13px; }
      .err { color: #b91c1c; }
      .ok { color: #166534; }
    </style></head><body>${body}</body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } },
  )
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const errorDesc = url.searchParams.get('error_description')

  // OAuth error path
  if (error) {
    return html('OAuth error', `
      <h1 class="err">OAuth error</h1>
      <p><strong>error:</strong> <code>${error}</code></p>
      <p><strong>description:</strong> ${errorDesc || '(none)'}</p>
      <p>Close this tab and re-run the mint script.</p>
    `)
  }

  if (!code) {
    return html('Missing code', `
      <h1 class="err">Missing ?code in callback</h1>
      <p>This route expects an OAuth redirect from Meta with a ?code= parameter.</p>
    `)
  }

  // State validation — prevents random visitors from minting tokens.
  const expectedState = (process.env.META_OAUTH_STATE || '').trim()
  if (!expectedState) {
    return html('Server misconfigured', `
      <h1 class="err">Server misconfigured</h1>
      <p>META_OAUTH_STATE is not set on the server. Set it before running the OAuth flow.</p>
    `)
  }
  if (state !== expectedState) {
    return html('State mismatch', `
      <h1 class="err">State mismatch</h1>
      <p>The OAuth <code>state</code> parameter does not match the expected value. This is the CSRF protection on this route.</p>
      <p>Re-run the mint script (it generates a fresh state) and try again.</p>
    `)
  }

  const appId = (process.env.META_APP_ID || '').trim()
  const appSecret = (process.env.META_APP_SECRET || '').trim()
  if (!appId || !appSecret) {
    return html('Server misconfigured', `
      <h1 class="err">Server misconfigured</h1>
      <p>META_APP_ID and META_APP_SECRET must be set on the server.</p>
    `)
  }

  const redirectUri = `${url.origin}/api/meta/oauth-callback`

  // Step 1: exchange code → short-lived user access token
  let shortToken = ''
  let shortExpiresIn = 0
  try {
    const u = new URL(`${META_GRAPH}/oauth/access_token`)
    u.searchParams.set('client_id', appId)
    u.searchParams.set('client_secret', appSecret)
    u.searchParams.set('redirect_uri', redirectUri)
    u.searchParams.set('code', code)
    const r = await fetch(u.toString())
    const j = await r.json() as { access_token?: string; expires_in?: number; error?: { message: string } }
    if (!r.ok || !j.access_token) {
      return html('Exchange failed', `
        <h1 class="err">Short-lived exchange failed</h1>
        <pre>${JSON.stringify(j, null, 2)}</pre>
      `)
    }
    shortToken = j.access_token
    shortExpiresIn = j.expires_in || 0
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return html('Exchange threw', `<h1 class="err">Exchange threw</h1><pre>${msg}</pre>`)
  }

  // Step 2: upgrade to long-lived (~60 day)
  let longToken = ''
  let longExpiresIn = 0
  try {
    const u = new URL(`${META_GRAPH}/oauth/access_token`)
    u.searchParams.set('grant_type', 'fb_exchange_token')
    u.searchParams.set('client_id', appId)
    u.searchParams.set('client_secret', appSecret)
    u.searchParams.set('fb_exchange_token', shortToken)
    const r = await fetch(u.toString())
    const j = await r.json() as { access_token?: string; expires_in?: number }
    if (r.ok && j.access_token) {
      longToken = j.access_token
      longExpiresIn = j.expires_in || 0
    }
  } catch {
    // Fall back to short token below
  }

  const finalToken = longToken || shortToken
  const finalExpiresIn = longExpiresIn || shortExpiresIn

  // Step 3: identify the user behind this token
  let userId = ''
  let userName = ''
  try {
    const meRes = await fetch(`${META_GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(finalToken)}`)
    const meJson = await meRes.json() as { id?: string; name?: string }
    if (meRes.ok) {
      userId = meJson.id || ''
      userName = meJson.name || ''
    }
  } catch {
    // Identity is informational only
  }

  return html('Token minted', `
    <h1 class="ok">Token minted</h1>
    <p>This token belongs to <strong>${userName || 'unknown'}</strong> (FB id <code>${userId || 'unknown'}</code>).</p>
    <p>Expires in <strong>${finalExpiresIn ? Math.round(finalExpiresIn / 86400) + ' days' : 'unknown'}</strong>${longToken ? ' (long-lived)' : ' (short-lived only — long-lived upgrade failed)'}.</p>
    <p>Paste this into <code>.env.local</code> as <code>META_USER_ACCESS_TOKEN_USER</code>:</p>
    <pre>META_USER_ACCESS_TOKEN_USER=${finalToken}</pre>
    <p>Then close this tab. The token is also rendered above — copy it once and rotate <code>META_OAUTH_STATE</code> to invalidate this route.</p>
  `)
}
