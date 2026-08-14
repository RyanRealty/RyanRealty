/**
 * Inbound valuation first packet (Value my home → CMA send + report open).
 *
 * Same C bar as expired/FSBO first-touch: THIS home, and how we would market
 * THIS home. Compose only. Manual send. No auto-send. No invented numbers.
 * No worth-question CTA. No prior-agent blame.
 *
 * Plan lines come from buildThisHomeMarketingPlan (lib/cma/expired-audit.ts).
 * Do not duplicate or weaken that helper.
 */

import { composeThisHomeMarketClause, formatFirstTouchUsd } from '@/lib/crm/first-touch-copy'
import { buildServicesList } from '@/lib/cma/expired-audit'

export type InboundPacketFacts = {
  address: string | null
  firstName: string | null
  valueLow: number | null
  valueHigh: number | null
  recommendedList: number | null
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
  return `${named}: the number and how we would market this house.`
}

export function inboundImmersiveHeroKick(streetAddress: string | null, generatedAtIso: string): string {
  const named = trim(streetAddress) ?? 'this home'
  const day = generatedAtIso.slice(0, 10)
  return `How we would market ${named} · ${day}`
}

export function inboundImmersiveTitle(streetAddress: string | null): string {
  const named = trim(streetAddress) ?? 'This home'
  return `${named} · How we would market this home · Ryan Realty`
}

export function composeInboundCoverLine(streetAddress: string | null): string {
  return composeThisHomeMarketClause(streetAddress)
}

export function composeInboundNumbersClause(facts: InboundPacketFacts): string | null {
  const lo = finiteMoney(facts.valueLow)
  const hi = finiteMoney(facts.valueHigh)
  const rec = finiteMoney(facts.recommendedList)
  if (lo == null || hi == null || rec == null) return null
  const named = trim(facts.address) ?? 'this home'
  return `Closed sales near ${named} support ${formatFirstTouchUsd(lo)} to ${formatFirstTouchUsd(hi)}. Recommended list: ${formatFirstTouchUsd(rec)}.`
}

export function composeInboundValuationCopy(facts: InboundPacketFacts): InboundValuationCopy {
  const first = trim(facts.firstName) ?? 'there'
  const greeting = `Hi ${first},`
  const plan = composeThisHomeMarketClause(facts.address)
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
