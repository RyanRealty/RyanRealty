/**
 * Portal lead-email parser (FUB-cutover intake, 2026-06-29).
 *
 * Zillow Premier Agent and Realtor.com leads used to flow into Follow Up Boss
 * via FUB's portal integrations. FUB disconnects 2026-06-30, so those feeds are
 * re-pointed to deliver lead emails to matt@ryan-realty.com, and the
 * crm-portal-lead-intake cron parses them into native CRM leads.
 *
 * Pure + unit-tested (no IO). Given an email's from/subject/body, detect the
 * portal and extract the lead's contact info. Built against the standard portal
 * formats; the cron applies a SAFETY NET on top (an email from a portal sender
 * that yields at least an email or phone still becomes a lead; one that yields
 * neither alerts the broker with the raw body — nothing is ever dropped).
 */

export type Portal = 'zillow' | 'realtor.com'

export type ParsedPortalLead = {
  portal: Portal
  name: string | null
  email: string | null
  phone: string | null
  message: string | null
  property: string | null
}

// Sender substrings that identify a portal LEAD email. Kept broad on purpose —
// the cron's Gmail query already scopes to these domains, and a false positive
// just creates a (real) lead from a portal email. Refine when a real sample lands.
const ZILLOW_SENDERS = ['zillow.com', 'zillowgroup.com', 'convo.zillow', 'premieragent']
const REALTOR_SENDERS = ['realtor.com', 'leads.realtor', 'move.com', 'connectionsplus', 'e-success.realtor']

// Consumer-marketing senders to ignore (not leads). Zillow/Realtor blast these.
const MARKETING_HINTS = ['zmail.zillow', 'email.zillow', 'news.realtor', 'marketing']

export function detectPortal(from: string | null | undefined): Portal | null {
  const f = String(from ?? '').toLowerCase()
  if (!f) return null
  if (MARKETING_HINTS.some((m) => f.includes(m))) return null
  if (ZILLOW_SENDERS.some((s) => f.includes(s))) return 'zillow'
  if (REALTOR_SENDERS.some((s) => f.includes(s))) return 'realtor.com'
  return null
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g

/** Emails that are the portal's own, not the lead's — never use as the lead email. */
function isPortalOwnedEmail(e: string): boolean {
  const x = e.toLowerCase()
  return [
    'zillow', 'realtor.com', 'move.com', 'noreply', 'no-reply', 'donotreply',
    'leads@', 'notifications@', 'mailer', 'support@', 'team@followupboss', 'followupboss',
  ].some((s) => x.includes(s))
}

function firstLeadEmail(body: string, replyTo: string | null): string | null {
  // A reply-to that isn't portal-owned is the most reliable lead address.
  if (replyTo) {
    const rt = (replyTo.match(EMAIL_RE) ?? []).find((e) => !isPortalOwnedEmail(e))
    if (rt) return rt.toLowerCase()
  }
  const all = body.match(EMAIL_RE) ?? []
  const lead = all.find((e) => !isPortalOwnedEmail(e))
  return lead ? lead.toLowerCase() : null
}

function firstPhone(body: string): string | null {
  const m = body.match(PHONE_RE)
  if (!m) return null
  for (const raw of m) {
    const d = raw.replace(/\D/g, '')
    const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
    if (ten.length === 10) return ten
  }
  return null
}

/** Pull the lead's name from the subject, then a body "Name:" label. */
function extractName(subject: string, body: string): string | null {
  const s = subject.trim()
  const patterns: RegExp[] = [
    /new (?:contact|lead|inquiry|connection)(?: request)?(?: from| by| with|:)\s+(.+?)(?:\s+(?:is|wants|for|about|on|\(|-)|$)/i,
    /^(.+?)\s+is interested in/i,
    /^(.+?)\s+(?:wants|requested|asked|inquired)/i,
    /lead:\s*(.+)$/i,
  ]
  for (const re of patterns) {
    const m = s.match(re)
    if (m && m[1]) {
      const n = m[1].replace(/["']/g, '').trim()
      if (n && n.length <= 80 && /[a-z]/i.test(n)) return n
    }
  }
  // Body label fallback: "Name: Jane Doe"
  const bm = body.match(/\bname[:\s]+([A-Z][a-zA-Z'’.-]+(?:\s+[A-Z][a-zA-Z'’.-]+){0,3})/)
  if (bm && bm[1]) return bm[1].trim()
  return null
}

function extractProperty(body: string): string | null {
  // Common labels in portal lead emails.
  const m = body.match(/\b(?:property|listing|address|home|regarding)[:\s]+([^\n\r]{6,90})/i)
  return m && m[1] ? m[1].trim() : null
}

function extractMessage(body: string): string | null {
  const m = body.match(/\b(?:message|comments?|note)[:\s]+([^\n\r]{2,400})/i)
  if (m && m[1]) return m[1].trim()
  return null
}

export function parsePortalLead(input: {
  from: string | null | undefined
  replyTo?: string | null
  subject: string | null | undefined
  body: string | null | undefined
}): ParsedPortalLead | null {
  const portal = detectPortal(input.from)
  if (!portal) return null
  const subject = String(input.subject ?? '')
  const body = String(input.body ?? '')
  return {
    portal,
    name: extractName(subject, body),
    email: firstLeadEmail(body, input.replyTo ?? null),
    phone: firstPhone(body),
    message: extractMessage(body),
    property: extractProperty(body),
  }
}
