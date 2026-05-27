#!/usr/bin/env node
/**
 * meta-user-mint-token.mjs
 *
 * One-time OAuth dance to mint a Meta user access token (Matt Ryan's
 * personal Facebook user) using the Ryan Realty Meta app
 * (META_APP_ID + META_APP_SECRET in .env.local).
 *
 * Why this exists:
 *   The existing META_PAGE_ACCESS_TOKEN belongs to the "RyanRealty
 *   Publisher" System User. System users CANNOT directly complete the
 *   Housing non-discrimination certification — they inherit it from the
 *   personal FB user who owns them in Business Manager. That inheritance
 *   has propagation delays (24+ hours common) and sometimes fails.
 *
 *   For Housing/Employment/Credit ad creation, Meta requires the cert
 *   state of the user actually making the API call. The fix is to use
 *   Matt's PERSONAL user access token (he's certified at user level —
 *   verified 2026-05-27 at the cert page) instead of the system-user
 *   page token. Personal-user calls evaluate his cert immediately and
 *   the HOUSING ad-create path unblocks.
 *
 * Usage:
 *   node scripts/meta-user-mint-token.mjs
 *
 * Pre-requisites (one-time, in Meta App Dashboard):
 *   - "Valid OAuth Redirect URIs" includes http://localhost:53684/
 *     Add at: https://developers.facebook.com/apps/901712509522992/
 *             use_cases/customize/?product=fb_login_for_business&
 *             page=Settings/permissions-and-settings
 *   - Matt's personal FB user must be a Developer / Admin / Tester on
 *     the Ryan Realty Meta app (he is — created the app)
 *   - The app must have these advanced-access permissions live:
 *     ads_management, ads_read, business_management, leads_retrieval,
 *     pages_show_list, pages_read_engagement, pages_manage_ads
 *
 * What it does:
 *   1. Opens a browser OAuth tab using the Ryan Realty Meta app with the
 *      full scope set required for ad management.
 *   2. Matt signs in as matt@ryan-realty.com and approves.
 *   3. Facebook redirects to http://localhost:53684/?code=...
 *   4. The script's local server exchanges the code for a short-lived
 *      access token, then exchanges THAT for a long-lived (60-day) token.
 *   5. Persists to .env.local as META_USER_ACCESS_TOKEN_USER.
 *
 * If Meta returns "URL Blocked" or invalid_redirect_uri, the redirect
 * isn't registered. Add http://localhost:53684/ at the app dashboard URL
 * above, then re-run.
 */
import http from 'node:http'
import { URL } from 'node:url'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'
import dotenv from 'dotenv'

// Load .env.local explicitly (no .env fallback in this repo)
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

// Different port than Google mints (53682, 53683) so they coexist
const REDIRECT_PORT = 53684
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/`

// Comprehensive scope set for ad management as Matt's personal user.
// Mirrors the existing META_PAGE_ACCESS_TOKEN scopes (per debug_token
// output 2026-05-27) so the user token can do everything the page token
// could do, PLUS unblock HOUSING ad creation via cert inheritance.
const SCOPES = [
  'ads_management',
  'ads_read',
  'business_management',
  'leads_retrieval',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_ads',
  'pages_manage_metadata',
  'pages_manage_posts',
  'pages_manage_engagement',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
  'public_profile',
].join(',')

const appId = process.env.META_APP_ID?.trim()
const appSecret = process.env.META_APP_SECRET?.trim()

if (!appId || !appSecret) {
  console.error('ERROR: META_APP_ID and META_APP_SECRET must be set in .env.local')
  process.exit(1)
}

const STATE = Math.random().toString(36).slice(2, 16)

const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth')
authUrl.searchParams.set('client_id', appId)
authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
authUrl.searchParams.set('response_type', 'code')
authUrl.searchParams.set('scope', SCOPES)
authUrl.searchParams.set('state', STATE)
authUrl.searchParams.set('auth_type', 'rerequest') // forces consent screen even if already authorized

console.log('\nMeta user-token mint — interactive OAuth dance')
console.log('Sign in as matt@ryan-realty.com (Business Admin + verified cert holder).\n')
console.log('Scopes requested:')
SCOPES.split(',').forEach((s) => console.log('  - ' + s))
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

  // OAuth error path
  const err = url.searchParams.get('error')
  if (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end(`OAuth error: ${err}. Close this tab and check the terminal.`)
    console.error(`\nOAuth error: ${err}`)
    console.error(`Description: ${url.searchParams.get('error_description') || '(none)'}`)
    console.error(`Reason: ${url.searchParams.get('error_reason') || '(none)'}`)
    if (err === 'access_denied') {
      console.error('\nUser declined the consent screen.')
    }
    process.exit(1)
  }

  if (!url.searchParams.has('code')) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Missing ?code in redirect. Close this tab and try again.')
    return
  }

  // State check
  const returnedState = url.searchParams.get('state')
  if (returnedState !== STATE) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('State mismatch. CSRF protection failed. Close this tab and try again.')
    console.error('\nState mismatch — possible CSRF. Aborting.')
    process.exit(1)
  }

  const code = url.searchParams.get('code')
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end('<h1>OK</h1><p>Code captured. Check your terminal. You can close this tab.</p>')

  try {
    // ─── Step 1: exchange code → short-lived user access token ──────
    console.log('Exchanging code for short-lived token...')
    const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
    tokenUrl.searchParams.set('client_id', appId)
    tokenUrl.searchParams.set('client_secret', appSecret)
    tokenUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    tokenUrl.searchParams.set('code', code || '')
    const shortRes = await fetch(tokenUrl.toString())
    const shortJson = await shortRes.json()
    if (!shortRes.ok || !shortJson.access_token) {
      console.error('\nShort-lived exchange failed:', shortJson)
      process.exit(1)
    }
    console.log(`Got short-lived token (expires in ${shortJson.expires_in || '?'}s).`)

    // ─── Step 2: exchange short-lived → long-lived (60-day) ─────────
    console.log('Upgrading to long-lived (60-day) token...')
    const longUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
    longUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longUrl.searchParams.set('client_id', appId)
    longUrl.searchParams.set('client_secret', appSecret)
    longUrl.searchParams.set('fb_exchange_token', shortJson.access_token)
    const longRes = await fetch(longUrl.toString())
    const longJson = await longRes.json()
    if (!longRes.ok || !longJson.access_token) {
      console.error('\nLong-lived upgrade failed:', longJson)
      // Fall back to the short-lived token (still works for ~1 hour)
      console.error('Falling back to short-lived token (only valid for ~1 hour).')
    }

    const finalToken = longJson.access_token || shortJson.access_token
    const finalExpires = longJson.expires_in || shortJson.expires_in

    // ─── Step 3: verify token identity via /me ──────────────────────
    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${finalToken}`)
    const meJson = await meRes.json()
    if (meRes.ok && meJson.id) {
      console.log(`\nToken belongs to: ${meJson.name} (FB user id ${meJson.id})`)
    } else {
      console.warn('\nCould not verify token identity:', meJson)
    }

    console.log('\nToken minted.\n')
    console.log(`META_USER_ACCESS_TOKEN_USER=${finalToken}`)
    console.log(`Expires in: ${finalExpires ? Math.round(finalExpires / 86400) + ' days' : 'unknown'}\n`)

    // ─── Step 4: persist to .env.local ──────────────────────────────
    const envPath = path.join(process.cwd(), '.env.local')
    try {
      const cur = await fs.readFile(envPath, 'utf-8').catch(() => '')
      const lines = cur.split(/\r?\n/).filter((l) => !l.startsWith('META_USER_ACCESS_TOKEN_USER='))
      lines.push(`META_USER_ACCESS_TOKEN_USER=${finalToken}`)
      await fs.writeFile(envPath, lines.filter(Boolean).join('\n') + '\n')
      console.log(`Persisted to ${envPath}.\n`)
    } catch (e) {
      console.warn('Could not write to .env.local:', e.message)
    }

    console.log('Next steps:')
    console.log('  1. Update scripts/meta-attach-seller-ads.mjs (and any')
    console.log('     other HOUSING-category ad creation scripts) to use')
    console.log('     META_USER_ACCESS_TOKEN_USER instead of')
    console.log('     META_PAGE_ACCESS_TOKEN for the ad-create POST.')
    console.log('  2. Re-run the ad-attach script — HOUSING ads should')
    console.log('     create successfully now that the actor is Matt\'s')
    console.log('     certified personal user.')
    console.log('  3. Token expires in ~60 days. Re-run this script to')
    console.log('     mint a fresh one before then.')
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
