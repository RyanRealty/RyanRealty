/**
 * First-contact copy for a delivered CMA, by origin (Matt 2026-09-04).
 *
 * Every CMA used to leave with one body, whoever it was going to: "The number
 * for 123 Main, and the sales that set it." That is right for someone who
 * filled out the valuation form ten minutes ago and wrong for a homeowner
 * whose listing just expired, because it answers a question they never asked.
 *
 * The pricing is identical across origins (one engine, one comp set). Only the
 * opening changes, and only to say truthfully why we are writing. The report
 * itself already carries the origin-specific sections this points at: the
 * expired failure findings and net sheet (lib/cma/expired-audit.ts) and the
 * FSBO "why most sellers list" page with its NAR shares and the Oregon
 * disclosure note (lib/cma/fsbo-cma-templates.ts).
 *
 * Voice: marketing_brain_skills/brand-voice/VOICE.md. Write to one person, say
 * the fact, stop. No em dash, no semicolon, no exclamation. We, never I. No
 * prior-agent blame on an expired — the listing did not sell, and that is the
 * whole claim.
 */

import { composeInboundNumbersClause, type InboundPacketFacts, type InboundValuationCopy } from '@/lib/cma/inbound-packet'
import { isAskedOrigin, type CmaOrigin } from '@/lib/cma/origin'

function trim(v: string | null | undefined): string | null {
  const s = (v ?? '').trim()
  return s || null
}

/** The one close every origin shares. The send rail appends the report URL to it. */
const CLOSE_ASKED = 'The report is attached as a PDF. You can also read it online.'
const CLOSE_EXPIRED =
  'The report is attached as a PDF. It covers the sales that set the number, what happened on the listing, and what you would net at the recommended list.'
const CLOSE_FSBO =
  'The report is attached as a PDF. It covers the sales that set the number and the homes competing with yours right now.'

export function composeCmaFirstContactSubject(origin: CmaOrigin, address: string | null): string {
  const named = trim(address)
  if (!named) return 'Your report on this home'
  if (origin === 'expired') return `${named}, and what sold while it was listed`
  if (origin === 'fsbo') return `${named}, and what it is competing with`
  return `Your report on ${named}`
}

function planFor(origin: CmaOrigin, named: string): string {
  if (origin === 'expired') {
    return `Your listing on ${named} came off the market without a sale. We built a read on what the closed sales support now, and what sold nearby while it was on.`
  }
  if (origin === 'fsbo') {
    return `You are selling ${named} yourself. We built a read on what the closed sales support, and what a buyer shopping that price is seeing instead.`
  }
  return `The number for ${named}, and the sales that set it.`
}

function closeFor(origin: CmaOrigin): string {
  if (origin === 'expired') return CLOSE_EXPIRED
  if (origin === 'fsbo') return CLOSE_FSBO
  return CLOSE_ASKED
}

export function cmaFirstContactPreview(origin: CmaOrigin, address: string | null): string {
  const named = trim(address) ?? 'this home'
  if (origin === 'expired') return `${named}: the number now, and what sold while it was listed.`
  if (origin === 'fsbo') return `${named}: the number, and what it is competing with.`
  return `${named}: the number, then the sales that set it.`
}

/**
 * Origin-aware first-contact copy, shaped exactly like the inbound packet copy
 * so it is a drop-in for the send rail. `close` stays a distinct string that
 * appears verbatim in `bodyText` — the rail splices the report URL onto it.
 */
export function composeCmaFirstContact(
  origin: CmaOrigin,
  facts: InboundPacketFacts,
): InboundValuationCopy {
  const first = trim(facts.firstName) ?? 'there'
  const greeting = `Hi ${first},`
  const named = trim(facts.address) ?? 'this home'
  const plan = planFor(origin, named)
  const numbers = composeInboundNumbersClause(facts)
  const close = closeFor(origin)
  const bodyText = [greeting, '', plan, numbers, '', close]
    .filter((p) => p !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    subject: composeCmaFirstContactSubject(origin, facts.address),
    previewText: cmaFirstContactPreview(origin, facts.address),
    mastheadLine: 'THIS HOME',
    greeting,
    plan,
    numbers,
    close,
    bodyText,
  }
}

/** True when the recipient asked for this value, so the copy may assume it. */
export function firstContactAssumesRequest(origin: CmaOrigin): boolean {
  return isAskedOrigin(origin)
}
