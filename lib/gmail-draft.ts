/**
 * Gmail draft creation via Google domain-wide delegation (DWD).
 *
 * Creates a DRAFT (never sends) in a Ryan Realty mailbox — by default
 * matt@ryan-realty.com — with optional file attachments (e.g. a CMA PDF) and an
 * optional Bcc (e.g. the FUB email-logging address ryan.realty@followupboss.me,
 * so the message is logged in Follow Up Boss the moment Matt hits Send in Gmail).
 *
 * Why a draft, not a send: a CMA carries real pricing numbers (CLAUDE.md §0
 * data-accuracy mandate) and lands far better from Matt's real mailbox than a
 * no-reply. Matt reviews the draft in Gmail and sends it himself — keeping a human
 * on the one document that most affects winning the listing.
 *
 * Auth: the service account viewer@ryanrealty.iam.gserviceaccount.com impersonates
 * the target user via DWD (same pattern as lib/marketing-brain/inbox-auth.ts).
 *
 * DWD scope: https://www.googleapis.com/auth/gmail.modify
 *   Verified live 2026-05-29: gmail.modify IS in the DWD allowlist for the service
 *   account (along with gmail.send + gmail.readonly), and it covers drafts.create.
 *   A create+delete round-trip in matt@ryan-realty.com succeeded — no Workspace
 *   change was needed. (gmail.compose, the narrower draft scope, is NOT allowlisted;
 *   DWD matches scope strings exactly, so we request the one that's authorized.)
 *   If auth ever fails, createGmailDraft() returns { ok:false, error, hint } so
 *   callers degrade gracefully (e.g. fall back to the Resend delivery path).
 *
 * Locked 2026-05-29.
 */

import { google } from 'googleapis'

/** drafts.create requires gmail.modify | gmail.compose | full mail. gmail.modify is the one
 *  that's actually allowlisted for our service account (verified 2026-05-29). */
export const GMAIL_DRAFT_SCOPE = 'https://www.googleapis.com/auth/gmail.modify'

/** Default mailbox the draft is created in. */
export const DEFAULT_DRAFT_USER =
  process.env.GOOGLE_SERVICE_ACCOUNT_SUBJECT?.trim() || 'matt@ryan-realty.com'

export interface GmailDraftAttachment {
  filename: string
  content: Buffer
  /** e.g. 'application/pdf' */
  mimeType: string
}

export interface CreateGmailDraftParams {
  to: string
  subject: string
  bodyHtml: string
  bodyText: string
  bcc?: string
  cc?: string
  replyTo?: string
  /** Mailbox to create the draft in. Defaults to DEFAULT_DRAFT_USER (matt@ryan-realty.com). */
  impersonateAs?: string
  attachments?: GmailDraftAttachment[]
}

export interface GmailDraftResult {
  ok: boolean
  draftId?: string
  messageId?: string
  error?: string
  hint?: string
}

function buildJwt(subject: string) {
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
    scopes: [GMAIL_DRAFT_SCOPE],
    subject,
  })
}

/** RFC 2047 encode a header value only if it contains non-ASCII. */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

/** Wrap a base64 string at 76 chars per line (RFC 2045). */
function wrap76(b64: string): string {
  return b64.replace(/.{1,76}/g, '$&\r\n').trimEnd()
}

function randomBoundary(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

/** Build a raw RFC 822 MIME message (multipart/mixed with a multipart/alternative body). */
function buildMimeMessage(p: CreateGmailDraftParams, from: string): string {
  const CRLF = '\r\n'
  const mixed = randomBoundary('mixed')
  const alt = randomBoundary('alt')
  const hasAttachments = !!p.attachments && p.attachments.length > 0

  const headers: string[] = [
    `From: ${from}`,
    `To: ${p.to}`,
  ]
  if (p.cc) headers.push(`Cc: ${p.cc}`)
  if (p.bcc) headers.push(`Bcc: ${p.bcc}`)
  if (p.replyTo) headers.push(`Reply-To: ${p.replyTo}`)
  headers.push(`Subject: ${encodeHeader(p.subject)}`)
  headers.push('MIME-Version: 1.0')

  // text/plain + text/html alternative, both base64 (robust against brand glyphs).
  const altBlock = [
    `--${alt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(Buffer.from(p.bodyText, 'utf8').toString('base64')),
    `--${alt}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(Buffer.from(p.bodyHtml, 'utf8').toString('base64')),
    `--${alt}--`,
  ].join(CRLF)

  if (!hasAttachments) {
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${alt}"`,
      '',
      altBlock,
    ].join(CRLF)
  }

  const parts: string[] = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    '',
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    altBlock,
  ]
  for (const a of p.attachments!) {
    parts.push(
      `--${mixed}`,
      `Content-Type: ${a.mimeType}; name="${a.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${a.filename}"`,
      '',
      wrap76(a.content.toString('base64')),
    )
  }
  parts.push(`--${mixed}--`)
  return parts.join(CRLF)
}

function toBase64Url(raw: string): string {
  return Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Create a Gmail draft (does NOT send). Returns { ok:true, draftId, messageId }
 * on success, or { ok:false, error, hint } if auth/scope is missing so callers
 * can fall back to another delivery path.
 */
export async function createGmailDraft(
  params: CreateGmailDraftParams,
): Promise<GmailDraftResult> {
  const from = params.impersonateAs?.trim() || DEFAULT_DRAFT_USER
  let jwt
  try {
    jwt = buildJwt(from)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  try {
    await jwt.authorize()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const scopeIssue = /unauthorized_client|invalid_grant|insufficient|access_denied/i.test(msg)
    return {
      ok: false,
      error: msg,
      hint: scopeIssue
        ? `Add ${GMAIL_DRAFT_SCOPE} to the DWD allowlist in Workspace Admin → Security → API controls → Domain-wide delegation for the service account, then retry.`
        : undefined,
    }
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth: jwt })
    const raw = toBase64Url(buildMimeMessage(params, from))
    const res = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw } },
    })
    return {
      ok: true,
      draftId: res.data.id ?? undefined,
      messageId: res.data.message?.id ?? undefined,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const scopeIssue = /insufficient|scope|forbidden|403/i.test(msg)
    return {
      ok: false,
      error: msg,
      hint: scopeIssue
        ? `drafts.create was rejected — confirm ${GMAIL_DRAFT_SCOPE} is in the DWD allowlist for the service account.`
        : undefined,
    }
  }
}
