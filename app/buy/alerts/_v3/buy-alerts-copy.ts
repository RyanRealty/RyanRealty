/**
 * Interpolate BUY_ALERTS_COPY with live published city and price-drop facts.
 * Pure: the page loads facts, this fills tokens. Missing figures omit their
 * sentence. No figure is invented here.
 */
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { BUY_ALERTS_COPY, BUY_ALERTS_LINKS } from './buy-alerts-constants'
import type { BuyAlertsFacts } from './buy-alerts-facts'

export type BuyAlertsFaq = { question: string; answer: string }

export type BuyAlertsCopy = {
  title: string
  meta: string
  h1: string
  eyebrow: string
  whatYouGet: string
  source: string
  leverage: string
  leverageMos: string | null
  volume: string | null
  dropsCount: string | null
  dropsMedian: string | null
  leftoverStamp: string | null
  dropsStamp: string | null
  faqs: BuyAlertsFaq[]
  signupEyebrow: string
  signupHeading: string
  questionsHeading: string
  sourcesHeading: string
  nextHeading: string
  formCadence: string
  links: typeof BUY_ALERTS_LINKS
}

export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')
}

export function countLabel(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function pctLabel(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1)
}

export function buyAlertsCopy(facts: BuyAlertsFacts): BuyAlertsCopy {
  const leftoverStamp = facts.leftoverStamp
  const dropsStamp = facts.dropsStamp
  const volume =
    facts.newCount30d != null && leftoverStamp
      ? fill(BUY_ALERTS_COPY.volume, { count: countLabel(facts.newCount30d), asOf: leftoverStamp })
      : null
  const dropsCount =
    facts.dropsCount != null && dropsStamp
      ? fill(BUY_ALERTS_COPY.dropsCount, { count: countLabel(facts.dropsCount), asOf: dropsStamp })
      : null
  const dropsMedian =
    facts.dropsMedianPct != null && dropsStamp
      ? fill(BUY_ALERTS_COPY.dropsMedian, { pct: pctLabel(facts.dropsMedianPct) })
      : null
  const leverageMos =
    facts.monthsUnder4 && leftoverStamp && facts.monthsSupply != null
      ? fill(BUY_ALERTS_COPY.leverageMos, {
          mos: formatMonthsOfSupply(facts.monthsSupply),
          asOf: leftoverStamp,
        })
      : null

  return {
    title: BUY_ALERTS_COPY.title,
    meta: BUY_ALERTS_COPY.meta,
    h1: BUY_ALERTS_COPY.h1,
    eyebrow: BUY_ALERTS_COPY.eyebrow,
    whatYouGet: BUY_ALERTS_COPY.whatYouGet,
    source: BUY_ALERTS_COPY.source,
    leverage: BUY_ALERTS_COPY.leverage,
    leverageMos,
    volume,
    dropsCount,
    dropsMedian,
    leftoverStamp,
    dropsStamp,
    faqs: [
      { question: BUY_ALERTS_COPY.faqSpeedQ, answer: BUY_ALERTS_COPY.faqSpeedA },
      { question: BUY_ALERTS_COPY.faqDropsQ, answer: BUY_ALERTS_COPY.faqDropsA },
      { question: BUY_ALERTS_COPY.faqFreeQ, answer: BUY_ALERTS_COPY.faqFreeA },
      { question: BUY_ALERTS_COPY.faqTownsQ, answer: BUY_ALERTS_COPY.faqTownsA },
      { question: BUY_ALERTS_COPY.faqUnsubQ, answer: BUY_ALERTS_COPY.faqUnsubA },
      { question: BUY_ALERTS_COPY.faqSourceQ, answer: BUY_ALERTS_COPY.faqSourceA },
    ],
    signupEyebrow: BUY_ALERTS_COPY.signupEyebrow,
    signupHeading: BUY_ALERTS_COPY.signupHeading,
    questionsHeading: BUY_ALERTS_COPY.questionsHeading,
    sourcesHeading: BUY_ALERTS_COPY.sourcesHeading,
    nextHeading: BUY_ALERTS_COPY.nextHeading,
    formCadence: BUY_ALERTS_COPY.formCadence,
    links: BUY_ALERTS_LINKS,
  }
}
