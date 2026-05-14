/**
 * marketing-brain: inbox-auth
 *
 * Google domain-wide-delegation (DWD) auth helper for the dedicated
 * marketing inbox at marketing@ryan-realty.com.
 *
 * The service account `viewer@ryanrealty.iam.gserviceaccount.com` is
 * authorized in Google Workspace to impersonate any user in the
 * ryan-realty.com domain via DWD. The DWD scope allowlist is configured
 * in Workspace Admin → Security → API controls → Domain-wide delegation.
 *
 * Required scopes for the inbox pipeline:
 *   - gmail.modify   — read messages + mark as read (poll path)
 *   - gmail.send     — send confirmation replies (reply path)
 *
 * As of 2026-05-14 the DWD allowlist contains gmail.send only. Adding
 * gmail.modify is the one Workspace-admin step that unlocks the read
 * path. See docs/handoffs/marketing-inbox-admin-setup.md for the exact
 * Admin Console steps. Until then, getReadAuth() returns an AuthStatus
 * with ok=false so callers can short-circuit gracefully.
 *
 * Locked 2026-05-14.
 */

import { google } from 'googleapis'
import type { OAuth2Client, JWT } from 'google-auth-library'

export const MARKETING_INBOX_USER = 'marketing@ryan-realty.com'

export const GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.modify'
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send'

export interface AuthStatus {
  ok: boolean
  client: JWT | OAuth2Client | null
  error: string | null
  hint?: string
}

function buildJwt(scopes: string[]): JWT {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  if (!clientEmail || !privateKey) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY missing',
    )
  }
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes,
    subject: MARKETING_INBOX_USER,
  })
}

async function tryAuthorize(client: JWT): Promise<AuthStatus> {
  try {
    await client.authorize()
    return { ok: true, client, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isUnauthorized = /unauthorized_client|invalid_grant|insufficient/i.test(msg)
    return {
      ok: false,
      client: null,
      error: msg,
      hint: isUnauthorized
        ? 'Workspace Admin → Security → API controls → Domain-wide delegation: add the missing scope(s) to the service account allowlist.'
        : undefined,
    }
  }
}

/**
 * Auth client with read scope (gmail.modify). Used by the poll route to
 * list messages, fetch full payloads, and mark as read.
 */
export async function getReadAuth(): Promise<AuthStatus> {
  return tryAuthorize(buildJwt([GMAIL_READ_SCOPE]))
}

/**
 * Auth client with send scope (gmail.send). Used by the reply layer to
 * send confirmation messages on the original thread.
 *
 * gmail.send is already in the DWD allowlist as of 2026-05-14, so this
 * call should succeed. If it does not, treat as a hard fail and bubble.
 */
export async function getSendAuth(): Promise<AuthStatus> {
  return tryAuthorize(buildJwt([GMAIL_SEND_SCOPE]))
}

/**
 * Combined auth — read + send in one client. Cheaper to call once when
 * both scopes are needed (poll → parse → reply in the same invocation).
 *
 * Returns ok=false if either scope is missing from the DWD allowlist.
 */
export async function getReadSendAuth(): Promise<AuthStatus> {
  return tryAuthorize(buildJwt([GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE]))
}
