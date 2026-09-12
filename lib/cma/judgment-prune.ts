/**
 * Judgment may thin a priced set only when Matt's document floor still holds.
 *
 * Falcon 15991: the ladder reached 8 closed sales; judgeComps kept 3 because
 * near-acre same-plat peers had already been cut. buildCma then accepted that
 * prune because the floor was MIN_COMPS (3). FACTS_STANDALONE_MIN /
 * BOUNDARY_EXIT_BELOW is the document floor (≥5). Grok cannot starve a filled
 * ladder below that.
 */
import { FACTS_STANDALONE_MIN } from '@/lib/pricing/ladder'

export const JUDGMENT_PRUNE_FLOOR = FACTS_STANDALONE_MIN

export function pricedSetAfterJudgment<T>(selected: readonly T[], vetted: readonly T[]): T[] {
  return vetted.length >= JUDGMENT_PRUNE_FLOOR ? [...vetted] : [...selected]
}
