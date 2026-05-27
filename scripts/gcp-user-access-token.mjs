#!/usr/bin/env node
/**
 * gcp-user-access-token.mjs
 *
 * Exchange GCP_USER_REFRESH_TOKEN (.env.local) for a fresh access token.
 *
 * Use either:
 *   - as a library:  import { mintGcpAccessTokenFromRefresh } from './gcp-user-access-token.mjs'
 *   - as a CLI:       node scripts/gcp-user-access-token.mjs   (prints the token)
 *
 * The refresh token was minted by scripts/gcp-user-mint-refresh-token.mjs and
 * carries the full Ryan Realty scope set (cloud-platform, analytics.edit,
 * analytics, bigquery, webmasters, business.manage, youtube, youtube.upload,
 * drive, spreadsheets, userinfo).
 */
import dotenv from 'dotenv'
import path from 'node:path'

// Load .env.local explicitly (no .env fallback in this repo)
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

export async function mintGcpAccessTokenFromRefresh(opts = {}) {
  const clientId = opts.clientId ?? process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = opts.clientSecret ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  const refreshToken = opts.refreshToken ?? process.env.GCP_USER_REFRESH_TOKEN?.trim()
  if (!clientId || !clientSecret) throw new Error('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not set')
  if (!refreshToken) throw new Error('GCP_USER_REFRESH_TOKEN not set — run scripts/gcp-user-mint-refresh-token.mjs first')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })
  const json = await res.json()
  if (!res.ok || !json.access_token) {
    throw new Error(`refresh failed: ${JSON.stringify(json)}`)
  }
  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in,
    scope: json.scope,
    tokenType: json.token_type,
  }
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const t = await mintGcpAccessTokenFromRefresh()
    console.log(t.accessToken)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
