/**
 * A LOT UNDER AN ACRE IS DISCLOSED, NEVER A REASON TO DROP A SALE (SKILL.md
 * §0.3 rule 20, Matt 2026-10-08, "Review uses search's rule"): "under 1 acre
 * on both sides the review keeps a sale with a bigger or smaller lot and the
 * letter states the difference".
 *
 * 20676 Wild Rose sits on 0.13 acre (5,663 sqft) and 61197 Cottonwood, which
 * sets the high end of its range, on 0.47 acre (20,473 sqft). The review kept
 * it, as the rule says, and the letter's only word on it was the figure in the
 * grid's Lot size row: Basis and limits disclosed condition and said nothing
 * about the lots (reader review 2026-10-08).
 *
 * A sale's lot "differs" by the review's own test (lotsDiffer in
 * lib/cma/judge-ground.ts: one lot at least twice the other, or 0.15 acre
 * apart), the test it used to cut those sales before the ruling. Every figure
 * is the grid's own Lot size cell (lotCell), so the sentence and the row
 * beside it print the same number. Nothing is adjusted for lot size, which is
 * what the sentence says.
 */

import { lotCell } from '@/lib/cma/comp-matrix'
import { LOT_WALL_ACRES, lotsDiffer } from '@/lib/cma/judge-ground'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'

export type LotDifference = { address: string; lotAcres: number }

function acres(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return v != null && Number.isFinite(n) && n > 0 ? n : null
}

/**
 * The printed sales whose lot differs from the home's, both under an acre,
 * in grid order. Empty when the home's lot is not on the row or is an acre or
 * more (the search's lot wall decides those, and they are not this rule).
 */
export function subAcreLotDifferences(
  subject: Pick<CmaSubject, 'lotAcres'> | null | undefined,
  comps: readonly Pick<CmaAdjustedComp, 'address' | 'lotAcres'>[] | null | undefined,
): LotDifference[] {
  const home = acres(subject?.lotAcres)
  if (home == null || home >= LOT_WALL_ACRES) return []
  const out: LotDifference[] = []
  for (const c of comps ?? []) {
    const lot = acres(c.lotAcres)
    const address = (c.address ?? '').trim()
    if (lot == null || !address || lot >= LOT_WALL_ACRES) continue
    if (!lotsDiffer(home, lot)) continue
    out.push({ address, lotAcres: lot })
  }
  return out
}

/**
 * "Your lot is 5,663 sqft. 61197 Cottonwood sits on 20,473 sqft. Both are
 * under an acre, so the sale stays in the comparison, and the grid does not
 * move it for lot size. What the difference is worth sits inside its sale
 * price and is not broken out."
 *
 * Empty when no printed sale's lot differs.
 */
export function lotDifferenceSentence(
  subject: Pick<CmaSubject, 'lotAcres'> | null | undefined,
  comps: readonly Pick<CmaAdjustedComp, 'address' | 'lotAcres'>[] | null | undefined,
): string {
  const diffs = subAcreLotDifferences(subject, comps)
  if (diffs.length === 0) return ''
  const home = `Your lot is ${lotCell(subject!.lotAcres)}.`
  if (diffs.length === 1) {
    const d = diffs[0]!
    return `${home} ${d.address} sits on ${lotCell(d.lotAcres)}. Both are under an acre, so the sale stays in the comparison, and the grid does not move it for lot size. What the difference is worth sits inside its sale price and is not broken out.`
  }
  const [first, ...rest] = diffs
  const others = rest.map((d) => `${d.address} on ${lotCell(d.lotAcres)}`)
  const tail = others.length === 1 ? ` and ${others[0]}` : `, ${others.slice(0, -1).join(', ')} and ${others[others.length - 1]}`
  return `${home} ${first!.address} sits on ${lotCell(first!.lotAcres)}${tail}. Every one of these lots is under an acre, so the sales stay in the comparison, and the grid does not move them for lot size. What the difference is worth sits inside each sale price and is not broken out.`
}
