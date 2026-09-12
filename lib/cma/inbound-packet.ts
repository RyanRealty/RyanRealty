/**
 * Inbound valuation first packet (Value my home → CMA send + report open).
 *
 * Same C bar as expired/FSBO first-touch: THIS home, and the number.
 * Compose only. Manual send. No auto-send. No invented numbers.
 * No worth-question CTA. No prior-agent blame.
 *
 * resolveThisHomePlan still exists for admin/data. It does not render here.
 */

import { formatFirstTouchUsd } from '@/lib/crm/first-touch-copy'
import { buildServicesList } from '@/lib/cma/expired-audit'

export type InboundPacketFacts = {
  address: string | null
  firstName: string | null
  valueLow: number | null
  valueHigh: number | null
  recommendedList: number | null
  lastListPrice?: number | null
}

export type InboundValuationCopy = {
  subject: string
  previewText: string
  mastheadLine: string
  greeting: string
  plan: string
  numbers: string | null
  close: string
  bodyText: string
}

function trim(v: string | null | undefined): string | null {
  const s = (v ?? '').trim()
  return s || null
}

function finiteMoney(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return n
}

export function resolveThisHomePlan(input: {
  thisHomePlan?: string[] | null
  streetAddress?: string | null
}): string[] {
  const fromArgs = (input.thisHomePlan ?? []).map((s) => s.trim()).filter(Boolean)
  if (fromArgs.length) return fromArgs
  return buildServicesList({ streetAddress: input.streetAddress })
}

export function composeInboundValuationSubject(address: string | null): string {
  const named = trim(address)
  return named ? `Your report on ${named}` : 'Your report on this home'
}

export function inboundValuationMasthead(): string {
  return 'THIS HOME'
}

export function inboundValuationPreview(address: string | null): string {
  const named = trim(address) ?? 'this home'
  return `${named}: the number, then the sales behind it.`
}

/**
 * The cover eyebrow. ONE DATE ON THE COVER, and it is the byline's.
 *
 * This printed a raw ISO slice — 2026-09-08 — five lines above a byline
 * reading Sep 7, 2026. Both came from the same timestamp: the slice takes the
 * UTC day and the byline takes the Pacific one, so a document prepared after
 * 5pm Central Oregon time carried two different dates on its own cover
 * (CLAUDE.md §0: a date is a number). Rather than print the same day twice in
 * two registers, the eyebrow names the document and the house and stops; the
 * byline under the title carries the date, formatted once.
 *
 * `generatedAtIso` stays on the signature so every caller keeps compiling and
 * so the choice is visible here rather than at the call site.
 */
export function inboundImmersiveHeroKick(
  streetAddress: string | null,
  _generatedAtIso?: string,
): string {
  const named = trim(streetAddress) ?? 'this home'
  return `Comparative market analysis · ${named}`
}

export function inboundImmersiveTitle(streetAddress: string | null): string {
  const named = trim(streetAddress) ?? 'This home'
  return `${named} · Comparative market analysis · Ryan Realty`
}

export function composeInboundCoverLine(streetAddress: string | null): string {
  const named = trim(streetAddress)
  return named ? `A comparative market analysis for ${named}.` : 'A comparative market analysis for this home.'
}

export function composeInboundNumbersClause(facts: InboundPacketFacts): string | null {
  const lo = finiteMoney(facts.valueLow)
  const hi = finiteMoney(facts.valueHigh)
  const rec = finiteMoney(facts.recommendedList)
  if (lo == null || hi == null || rec == null) return null
  const last = finiteMoney(facts.lastListPrice)
  const lastClause = last != null ? ` Last list was ${formatFirstTouchUsd(last)}.` : ''
  return `Closed sales nearby support ${formatFirstTouchUsd(lo)} to ${formatFirstTouchUsd(hi)}. Recommended list: ${formatFirstTouchUsd(rec)}.${lastClause}`
}

export function composeInboundValuationCopy(facts: InboundPacketFacts): InboundValuationCopy {
  const first = trim(facts.firstName) ?? 'there'
  const greeting = `Hi ${first},`
  const named = trim(facts.address) ?? 'this home'
  const plan = `The number for ${named}, and the sales behind it.`
  const numbers = composeInboundNumbersClause(facts)
  const close = 'The report is attached as a PDF. You can also read it online.'
  const bodyText = [greeting, '', plan, numbers, '', close]
    .filter((p) => p !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return {
    subject: composeInboundValuationSubject(facts.address),
    previewText: inboundValuationPreview(facts.address),
    mastheadLine: inboundValuationMasthead(),
    greeting,
    plan,
    numbers,
    close,
    bodyText,
  }
}

export function emptyInboundPacketFacts(): InboundPacketFacts {
  return {
    address: null,
    firstName: null,
    valueLow: null,
    valueHigh: null,
    recommendedList: null,
  }
}
