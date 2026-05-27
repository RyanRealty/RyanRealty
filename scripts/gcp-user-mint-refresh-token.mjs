#!/usr/bin/env node
/**
 * gcp-user-mint-refresh-token.mjs
 *
 * One-time OAuth dance to mint a user refresh token for Google Cloud + Google
 * APIs using the Ryan Realty OAuth client. Mirrors scripts/google-ads-mint-refresh-token.mjs
 * but for the broader scope set Ryan Realty uses across analytics, BigQuery,
 * Search Console, GBP, YouTube, Drive, Sheets.
 *
 * Why this exists:
 *   gcloud's default OAuth client (32555940559 / 764086051850) has been
 *   restricted by Google for these scopes: adwords, analytics, analytics.edit,
 *   drive, spreadsheets, youtube. Google's message:
 *     "To use these scopes, you must provide your own client ID or use service
 *      account impersonation."
 *   We already have our own verified OAuth client (.env.local
 *   GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET). This script uses
 *   that client so the scopes are honored.
 *
 * Usage:
 *   node scripts/gcp-user-mint-refresh-token.mjs
 *
 * What it does:
 *   1. Opens a browser OAuth tab using the Ryan Realty OAuth client with the
 *      full scope set.
 *   2. You sign in as matt@ryan-realty.com (the GCP project owner + GA4 admin)
 *      and click Allow.
 *   3. Google redirects to http://localhost:53683/ with ?code=...
 *   4. The script's local server captures the code, exchanges it for a refresh
 *      token, prints the token, and persists it to .env.local as
 *      GCP_USER_REFRESH_TOKEN.
 *   5. Future API calls can mint a fresh access token via
 *      mintGcpAccessTokenFromRefresh() (see scripts/gcp-user-access-token.mjs).
 *
 * Pre-requisites (one-time, in GCP Console):
 *   - OAuth consent screen has ALL these scopes added: cloud-platform,
 *     analytics.edit, analytics, bigquery, webmasters, business.manage,
 *     youtube, youtube.upload, drive, spreadsheets, userinfo.email,
 *     userinfo.profile.
 *   - OAuth client has http://localhost:53683/ as an authorized redirect URI.
 *
 * If Google returns "Error 400: invalid_scope", the OAuth consent screen
 * doesn't have one of the requested scopes added yet. The error message
 * will name which scope. Add it at:
 *   https://console.cloud.google.com/apis/credentials/consent?project=ryanrealty
 */
import http from 'node:http'
import { URL } from 'node:url'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'
import dotenv from 'dotenv'

// Load .env.local explicitly (no .env fallback in this repo)
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

// Use port 53682 — same as scripts/google-ads-mint-refresh-token.mjs.
// The Ryan Realty OAuth client must have http://localhost:53682/ in its
// Authorized redirect URIs (one-time GCP Console setup, see docs).
// We share the port with the Ads script because (a) only one mint at a time
// will ever run, (b) keeping the URI list short reduces consent-screen drift.
const REDIRECT_PORT = 53682
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/`

// Full Ryan Realty scope set. Order matters for the consent screen presentation.
const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/analytics.edit',
  'https://www.googleapis.com/auth/analytics',
  'https://www.googleapis.com/auth/bigquery',
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')

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
authUrl.searchParams.set('scope', SCOPES)
authUrl.searchParams.set('access_type', 'offline')
authUrl.searchParams.set('prompt', 'consent') // forces refresh_token in response
authUrl.searchParams.set('include_granted_scopes', 'true')

console.log('\nRyan Realty GCP user-token mint — interactive OAuth dance')
console.log('Sign in as matt@ryan-realty.com (the GCP project owner + GA4 admin).\n')
console.log('Scopes requested:')
SCOPES.split(' ').forEach((s) => console.log('  - ' + s.replace('https://www.googleapis.com/auth/', '')))
console.log('\nOpening browser ...\n')
console.log('If the browser does not open, copy this URL manually:')
console.log(authUrl.toString())
console.log()

// Best-effort browser open
const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open'
exec(`${opener} "${authUrl.toString()}"`, () => { /* swallow */ })

// Local server to catch the redirect
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', REDIRECT_URI)
  if (!url.searchParams.has('code')) {
    const err = url.searchParams.get('error')
    if (err) {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end(`OAuth error: ${err}. Close this tab and check the terminal.`)
      console.error(`\nOAuth error: ${err}`)
      console.error(`Description: ${url.searchParams.get('error_description') || '(none)'}`)
      if (err === 'invalid_scope' || err === 'access_denied') {
        console.error('\nLikely cause: one of the requested scopes is not on the OAuth')
        console.error('consent screen for the Ryan Realty client.')
        console.error('\nFix: add the missing scope at')
        console.error('  https://console.cloud.google.com/apis/credentials/consent?project=ryanrealty')
        console.error('then re-run this script.')
      }
      process.exit(1)
    }
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
      console.error('\nToken exchange failed:', json)
      process.exit(1)
    }
    console.log('\nRefresh token minted.\n')
    console.log('Scopes granted:', json.scope || '(not echoed)')
    console.log()
    console.log('GCP_USER_REFRESH_TOKEN=' + json.refresh_token + '\n')

    // Persist to .env.local
    const envPath = path.join(process.cwd(), '.env.local')
    try {
      const cur = await fs.readFile(envPath, 'utf-8').catch(() => '')
      const lines = cur.split(/\r?\n/).filter((l) => !l.startsWith('GCP_USER_REFRESH_TOKEN='))
      lines.push(`GCP_USER_REFRESH_TOKEN=${json.refresh_token}`)
      await fs.writeFile(envPath, lines.filter(Boolean).join('\n') + '\n')
      console.log(`Persisted to ${envPath}.\n`)
    } catch (e) {
      console.warn('Could not write to .env.local:', e.message)
    }

    console.log('Next steps:')
    console.log('  1. (optional) Mirror to Vercel:')
    console.log('     echo "<token>" | vercel env add GCP_USER_REFRESH_TOKEN production')
    console.log('  2. To use in scripts:')
    console.log('     const access = await mintGcpAccessTokenFromRefresh()  // helper at scripts/gcp-user-access-token.mjs')
    console.log()
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

// Safety: kill after 10 min
setTimeout(() => {
  console.error('Timed out waiting for OAuth redirect.')
  process.exit(1)
}, 10 * 60 * 1000)
