/**
 * Email deliverability + anti-spam analyzer (CONTACT360 Phase 9.E).
 *
 * Pure, testable scoring of an outbound email's inbox-placement risk. The
 * `prepareDeliverableEmail()` preflight and the `ci:email-quality` gate both run
 * this so a spammy/undeliverable email is caught before it ships. Higher score =
 * worse. Returns concrete, fixable issues — not a black-box number.
 *
 * Scope: AUTOMATED / bulk sends (CMA, sequence, alert, newsletter). A 1:1 broker
 * reply is exempt (it's a personal email, not a list send).
 */

export type EmailIssueSeverity = 'fail' | 'warn'

export interface EmailIssue {
  code: string
  severity: EmailIssueSeverity
  message: string
}

export interface EmailDeliverabilityReport {
  score: number // 0 = clean; higher = worse
  level: 'ok' | 'warn' | 'fail'
  issues: EmailIssue[]
}

export interface EmailToAnalyze {
  subject: string
  html: string
  /** Plain-text alternative — required for automated sends (HTML-only is a spam signal). */
  text?: string | null
}

// Domains a CRM email is allowed to link to. Anything else (esp. shorteners) is flagged.
const ALLOWED_LINK_HOSTS = [
  'ryan-realty.com',
  'mail.ryan-realty.com',
  'resend.com', // tracking/unsubscribe infra
]
const URL_SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'buff.ly', 'is.gd', 'rebrand.ly']

// Classic spam-trigger vocabulary (real-estate-tuned; case-insensitive whole-word).
const SPAM_WORDS = [
  'free', 'guarantee', 'guaranteed', 'act now', 'limited time', 'urgent', 'winner',
  'congratulations', 'risk-free', 'no obligation', 'cash', 'earn money', 'click here',
  'buy now', "don't miss", 'once in a lifetime', '100%', 'amazing deal', 'cheap',
]

const SEVERITY_WEIGHT: Record<EmailIssueSeverity, number> = { fail: 40, warn: 10 }

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

function isAllowedHost(host: string): boolean {
  return ALLOWED_LINK_HOSTS.some((h) => host === h || host.endsWith('.' + h))
}

function visibleText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Analyze an automated/bulk email for spam + deliverability risk. */
export function analyzeEmailDeliverability(email: EmailToAnalyze): EmailDeliverabilityReport {
  const issues: EmailIssue[] = []
  const subject = (email.subject ?? '').trim()
  const html = email.html ?? ''
  const text = (email.text ?? '').trim()
  const bodyText = visibleText(html)
  const add = (code: string, severity: EmailIssueSeverity, message: string) => issues.push({ code, severity, message })

  // ── Subject ──
  if (!subject) add('subject-empty', 'fail', 'Subject is empty.')
  if (subject.length > 78) add('subject-long', 'warn', `Subject is ${subject.length} chars; keep ≤ 78 so it isn't truncated.`)
  const letters = subject.replace(/[^a-z]/gi, '')
  if (letters.length >= 6 && letters === letters.toUpperCase()) add('subject-allcaps', 'fail', 'Subject is ALL CAPS — a strong spam signal.')
  if ((subject.match(/!/g) || []).length > 1) add('subject-exclaim', 'warn', 'More than one "!" in the subject reads as spammy.')
  if (/\$|\bfree\b|\bwinner\b|\bact now\b/i.test(subject)) add('subject-spam-token', 'warn', 'Subject contains a money/urgency spam token.')
  if (/^\s*(re|fwd):/i.test(subject)) add('subject-fake-reply', 'fail', 'Fake "Re:/Fwd:" prefix on a non-reply is a deceptive-subject (CAN-SPAM) violation.')
  const emojiCount = (subject.match(/\p{Extended_Pictographic}/gu) || []).length
  if (emojiCount > 1) add('subject-emoji', 'warn', 'More than one emoji in the subject hurts deliverability.')

  // ── Multipart (HTML-only is a spam signal) ──
  if (!text) add('no-plaintext', 'fail', 'No plain-text alternative — automated email must be multipart (text + HTML).')

  // ── Body content ──
  const imgCount = (html.match(/<img\b/gi) || []).length
  if (bodyText.length < 40 && imgCount > 0) add('image-only', 'fail', 'Image-heavy with almost no text — image-only emails are filtered as spam.')
  if (/<img\b(?![^>]*\balt=)/i.test(html)) add('img-no-alt', 'warn', 'An <img> is missing alt text.')
  if (/<script\b/i.test(html)) add('has-script', 'fail', '<script> in an email body is stripped by clients and flags spam.')

  // ── CAN-SPAM body requirements ──
  if (!/unsubscrib|opt[\s-]?out|email preferences/i.test(bodyText + ' ' + text)) {
    add('no-unsubscribe', 'fail', 'No visible unsubscribe link/text in the body (CAN-SPAM + Gmail/Yahoo bulk rules).')
  }
  const hasZip = /\b\d{5}(?:-\d{4})?\b/.test(bodyText + ' ' + text)
  const hasStateOr = /\b(OR|Oregon)\b/.test(bodyText + ' ' + text)
  if (!(hasZip && hasStateOr)) {
    add('no-physical-address', 'warn', 'No postal mailing address detected in the footer (CAN-SPAM requires a physical address).')
  }

  // ── Links ──
  const urls = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]).filter((u) => /^https?:/i.test(u))
  let externalLinks = 0
  for (const u of urls) {
    const host = hostOf(u)
    if (!host) continue
    if (URL_SHORTENERS.includes(host)) add('url-shortener', 'fail', `Link uses a URL shortener (${host}) — major spam signal; link to ryan-realty.com directly.`)
    else if (!isAllowedHost(host)) externalLinks += 1
  }
  if (externalLinks > 0) add('external-links', 'warn', `${externalLinks} link(s) point off ryan-realty.com — mismatched link domains lower trust.`)
  if (urls.length > 20) add('too-many-links', 'warn', `${urls.length} links is high; trim to the essentials.`)

  // ── Spam vocabulary in the body ──
  const hay = (bodyText + ' ' + subject).toLowerCase()
  const hits = SPAM_WORDS.filter((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i').test(hay))
  if (hits.length >= 3) add('spam-words', 'warn', `Multiple spam-trigger phrases: ${hits.slice(0, 5).join(', ')}.`)

  const score = issues.reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0)
  const level: EmailDeliverabilityReport['level'] = issues.some((i) => i.severity === 'fail')
    ? 'fail'
    : issues.length > 0
      ? 'warn'
      : 'ok'
  return { score, level, issues }
}
