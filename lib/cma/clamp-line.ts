/**
 * THE CLAMP SENTENCE NAMES THE WEIGHTED FIGURE (Matt 2026-10-08, "Name the
 * weighted figure").
 *
 * 615 Reed Market's price chapter printed "The sales support a value of
 * $533,000. Because $499,000 already failed to sell, we recommend the price
 * on the cover, which stays under that ask." Its sales' weights blend to
 * $510,945, and $533,000 was the list tier before the failed-ask ceiling,
 * with the list steps on it: a number no weight on the page produces. The
 * sentence now says what the weighted sales support, to the thousand as the
 * letter says "near $X" ($511,000), and then why the list sits at the cover:
 * the ask that failed.
 *
 * Every figure is read off the printed grid, so a stored letter re-renders
 * right without a rebuild:
 *  - the weighted sale the grid's own weights and printed adjusted prices
 *    produce (`weightedSaleFromGrid`, the expected sale's tests minus the one
 *    against the cover) is named;
 *  - when the chapter's lead already names it ("expect it to sell near $X"),
 *    the sentence does not say it again;
 *  - when the grid cannot produce the stored weighted price, no figure is
 *    named, only the reason the cover sits under the ask;
 *  - a row that stored no weighted price prints the sentence as stored.
 *
 * Not on a held letter (rule 26: no clamp sentence at all, and the weights
 * read as the range's, lib/cma/sales-role.ts), and not on a letter for a home
 * on the market (rule 27): both print as before.
 */

import { clampSentence } from '@/lib/cma/set-aside'
import { expectedSaleFor, weightedSaleFromGrid } from '@/lib/cma/expected-sale'
import { failedAskClampHead, splitFailedAskClampHead } from '@/lib/cma/expired-audit'
import { storedWeightedPrice } from '@/lib/cma/sales-role'
import type { CmaAdjustedComp, CmaPricing } from '@/lib/cma/types'

/**
 * The clamp sentence the price chapter prints under the number, or '' when
 * the clamp did not bind. The caller still leaves it off a held letter.
 */
export function clampLineFor(
  pricing: CmaPricing | null | undefined,
  comps: readonly CmaAdjustedComp[] | null | undefined,
  opts?: { onMarket?: boolean },
): string {
  const stored = clampSentence(pricing)
  if (!stored || !pricing) return ''
  if (opts?.onMarket) return stored
  if (pricing.clamp?.kind !== 'failed-ask') return stored
  const split = splitFailedAskClampHead(stored)
  if (!split) return stored
  if (storedWeightedPrice(pricing) == null) return stored
  // The lead already says what the weighted sales point to: once.
  if (expectedSaleFor({ pricing, comps })) return split.tail
  const sale = weightedSaleFromGrid({ pricing, comps })
  if (!sale) return split.tail
  const head = failedAskClampHead({ supported: pricing.clamp.before, weighted: sale.price, rec: pricing.recommended })
  return `${head} ${split.tail}`
}
