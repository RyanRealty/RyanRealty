/**
 * ONE LABEL, ONE NUMBER, ACROSS THE DATASET AND THE FAQ (AEO-1, visibility
 * audit 2026-09-22).
 *
 * A place page publishes the same statistic in up to three machine-readable
 * places: the visible Q&A, the FAQPage JSON-LD built from it, and the Dataset
 * `variableMeasured` (plus the Place `additionalProperty`, which carries the
 * same array). /cities/bend/awbrey-butte shipped "Median List Price 1350000"
 * and "Active Listings 45" in its Dataset while its FAQPage and visible page
 * said $1,312,500 and 54 under the same questions: the Dataset came off the
 * market-truth overlay and the FAQ off the boundary inventory. River West was
 * 43% apart. An answer engine that reads both sees one page contradicting
 * itself, and CLAUDE.md §0 rule 5 calls that a fail.
 *
 * This module is the check. For each Dataset variable that has a question the
 * FAQ answers, it looks for that variable's value, formatted the way the FAQ
 * writes it, inside that answer. `reconcileDatasetToFaq` is the fail-closed
 * version a page runs before it emits: a variable the FAQ contradicts is
 * withheld (§0 rule 7, the page ships with fewer numbers rather than a wrong
 * one), and a variable the FAQ does not ask about passes through untouched.
 */
import type { StatValue } from '@/lib/site/json-ld'
import { formatPriceExact } from '@/lib/format/money'

export type FaqPair = { question: string; answer: string }

export type DatasetFaqConflict = {
  variable: string
  datasetValue: string | number
  question: string
  expected: string
}

type Rule = {
  /** The FAQ question that answers this variable. */
  question: RegExp
  /** How the FAQ prints the value. */
  format: (value: number) => string[]
  /**
   * 'lead': the answer's FIRST number must be this value. Counts are stated
   * first ("54 single-family homes are on the market…") and an answer can go
   * on to name a second count to explain the first (the neighborhood note
   * names the 45 the supply ratio used), so "the number appears somewhere"
   * would pass the very contradiction this module exists to catch.
   * 'any': the value appears anywhere (prices, where a sale and a list median
   * share one answer; days, where the window is also written in days).
   */
  match: 'lead' | 'any'
}

const count = (value: number): string[] => [value.toLocaleString('en-US')]
const days = (value: number): string[] => [`${Math.round(value)} days`]
const price = (value: number): string[] => [formatPriceExact(value)]
const months = (value: number): string[] => [String(value), value.toFixed(1)]

/**
 * Variable name (as buildMarketFaq writes it) → the question that answers it.
 * The question patterns cover both builders' wording: lib/site/market-faq.ts
 * and lib/site/place-answers.ts ask the same questions on purpose so the
 * merge drops the duplicate.
 */
const RULES: Record<string, Rule> = {
  'Median List Price': { question: /median home price/i, format: price, match: 'any' },
  'Median Sale Price': { question: /median home price/i, format: price, match: 'any' },
  'Active Listings': { question: /are for sale in/i, format: count, match: 'lead' },
  'Months of Supply': { question: /buyer's or seller's market/i, format: months, match: 'any' },
  'Median Days to Pending': { question: /take to sell/i, format: days, match: 'any' },
  'Median Days on Market': { question: /stay on the market/i, format: days, match: 'any' },
  'Homes Sold (12 months)': { question: /homes sold in .+ in the last year/i, format: count, match: 'lead' },
}

/** The first number an answer states, commas removed. */
function leadNumber(answer: string): number | null {
  const m = answer.match(/\d[\d,]*(?:\.\d+)?/)
  if (!m) return null
  const n = Number(m[0].replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function answerAgrees(rule: Rule, value: number, answer: string): boolean {
  if (rule.match === 'lead') return leadNumber(answer) === value
  return rule.format(value).some((needle) => answer.includes(needle))
}

function numeric(value: StatValue['value']): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Every Dataset variable whose FAQ answer does not print its value. Empty
 * means the two surfaces agree on every label they share.
 */
export function datasetFaqConflicts(
  variables: readonly StatValue[],
  faqs: readonly FaqPair[],
): DatasetFaqConflict[] {
  const conflicts: DatasetFaqConflict[] = []
  for (const variable of variables) {
    const rule = RULES[variable.name]
    const value = numeric(variable.value)
    if (!rule || value == null) continue
    const answers = faqs.filter((faq) => rule.question.test(faq.question))
    if (answers.length === 0) continue
    const expected = rule.format(value)
    const agrees = answers.some((faq) => answerAgrees(rule, value, faq.answer))
    if (!agrees) {
      conflicts.push({
        variable: variable.name,
        datasetValue: variable.value,
        question: answers[0]!.question,
        expected: expected[0]!,
      })
    }
  }
  return conflicts
}

/**
 * The Dataset variables a page may publish beside these FAQ answers: every
 * variable the FAQ agrees with or does not ask about. A contradicted one is
 * dropped, not corrected, because this module cannot know which read is right;
 * it only knows the page must not print both.
 */
export function reconcileDatasetToFaq(
  variables: readonly StatValue[],
  faqs: readonly FaqPair[],
): StatValue[] {
  const refused = new Set(datasetFaqConflicts(variables, faqs).map((c) => c.variable))
  return variables.filter((variable) => !refused.has(variable.name))
}
