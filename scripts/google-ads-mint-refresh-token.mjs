#!/usr/bin/env node
/**
 * google-ads-mint-refresh-token.mjs
 *
 * One-time OAuth dance to mint a Google Ads API refresh token using the
 * existing GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET in .env.local.
 *
 * Why: Google Ads REST API needs an access token from the
 * https://www.googleapis.com/auth/adwords scope. That scope must be added
 * to the OAuth consent screen scopes for your Google Cloud project, and a
 * refresh token must be minted via the OAuth code flow once. After that,
 * the refresh token mints fresh access tokens for every API call.
 *
 * Usage:
 *   node scripts/google-ads-mint-refresh-token.mjs
 *
 * What it does:
 *   1. Prints a Google OAuth URL with the adwords scope and a localhost
 *      redirect (port 53682).
 *   2. Opens that URL in your default browser (or you paste manually).
 *   3. You consent to the adwords scope. Google redirects to localhost
 *      with a ?code=... param.
 *   4. The script's local server captures the code, exchanges it for a
 *      refresh token, and prints the result.
 *   5. You copy the refresh token into Vercel env as
 *      GOOGLE_ADS_REFRESH_TOKEN, then deploy the snapshot cron will start
 *      working the next time it runs.
 *
 * Pre-requisites in Google Cloud Console:
 *   - OAuth consent screen has https://www.googleapis.com/auth/adwords listed
 *   - OAuth client has http://localhost:53682/ as an authorized redirect URI
 *
 * The script also writes the refresh token to .env.local under
 * GOOGLE_ADS_REFRESH_TOKEN= so local dev / cron tests work immediately.
 */
import http from 'node:http'
import { URL } from 'node:url'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'
import 'dotenv/config'

const REDIRECT_PORT = 53682
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/`
const SCOPE = 'https://www.googleapis.com/auth/adwords'

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()

if (!clientId || !clientSecret) {
  console.error('ERROR: GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in .env.local')
  process.exit(1)
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
authUrl.searchParams.set('client_id', clientId)
authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
authUrl.searchParams.set('response_type', 'code')
authUrl.searchParams.set('scope', SCOPE)
authUrl.searchParams.set('access_type', 'offline')
authUrl.searchParams.set('prompt', 'consent') // forces refresh_token in response
authUrl.searchParams.set('include_granted_scopes', 'true')

console.log('\nGoogle Ads refresh-token mint — interactive OAuth dance\n')
console.log('Open this URL in the browser of the Google account that owns')
console.log('the Google Ads Manager (MCC) account. Approve the adwords scope.\n')
console.log(authUrl.toString())
console.log('\nOpening browser ...\n')

// Best-effort browser open
const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open'
exec(`${opener} "${authUrl.toString()}"`, () => { /* swallow */ })

// Local server to catch the redirect
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', REDIRECT_URI)
  if (!url.searchParams.has('code')) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Missing ?code in redirect. Close this tab and try again.')
    return
  }
  const code = url.searchParams.get('code')
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end('<h1>OK</h1><p>Refresh token captured. Check your terminal. You can close this tab.</p>')

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code || '',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
    })
    const json = await tokenRes.json()
    if (!tokenRes.ok || !json.refresh_token) {
      console.error('Token exchange failed:', json)
      process.exit(1)
    }
    console.log('\n✅ Refresh token minted.\n')
    console.log('GOOGLE_ADS_REFRESH_TOKEN=' + json.refresh_token + '\n')

    // Also persist to .env.local so local dev works immediately
    const envPath = path.join(process.cwd(), '.env.local')
    try {
      const cur = await fs.readFile(envPath, 'utf-8').catch(() => '')
      const lines = cur.split(/\r?\n/).filter((l) => !l.startsWith('GOOGLE_ADS_REFRESH_TOKEN='))
      lines.push(`GOOGLE_ADS_REFRESH_TOKEN=${json.refresh_token}`)
      await fs.writeFile(envPath, lines.filter(Boolean).join('\n') + '\n')
      console.log(`Persisted to ${envPath}.\n`)
    } catch (e) {
      console.warn('Could not write to .env.local:', e.message)
    }

    console.log('Next steps:')
    console.log('  1. Set GOOGLE_ADS_REFRESH_TOKEN in Vercel:')
    console.log('     echo "<token>" | vercel env add GOOGLE_ADS_REFRESH_TOKEN production')
    console.log('  2. Set GOOGLE_ADS_DEVELOPER_TOKEN (once Google approves the API application):')
    console.log('     echo "<token>" | vercel env add GOOGLE_ADS_DEVELOPER_TOKEN production')
    console.log('  3. Add a small access-token mint helper to /api/cron/marketing-snapshot-google-ads')
    console.log('     OR run scripts/google-ads-refresh-access-token.mjs in CI to refresh.')
    console.log('  4. Wait for the next 06:30 UTC snapshot run, or trigger manually:')
    console.log('     curl -H "Authorization: Bearer $CRON_SECRET" \\')
    console.log('       https://ryanrealty.vercel.app/api/cron/marketing-snapshot-google-ads\n')
    server.close()
    process.exit(0)
  } catch (e) {
    console.error('Token exchange threw:', e.message)
    process.exit(1)
  }
})

server.listen(REDIRECT_PORT, () => {
  console.log(`Listening on ${REDIRECT_URI} for the OAuth redirect...`)
})

// Safety: kill after 5 min
setTimeout(() => {
  console.error('Timed out waiting for OAuth redirect.')
  process.exit(1)
}, 5 * 60 * 1000)
