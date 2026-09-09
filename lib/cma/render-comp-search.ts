/**
 * WHY THESE SALES — the one sentence chapter 3 opens its method with.
 *
 * Round-four class E, 2465 7th: the chapter told the seller "There were not
 * enough recent sales inside Diamond Bar Ranch, so we opened past the
 * subdivision," while THREE OF ITS FIVE SALES ARE DIAMOND BAR RANCH, chapter 5
 * printed four Diamond Bar Ranch sales from the last ten weeks, and the MLS
 * holds twelve in the window. A reader who can count found the document
 * contradicting itself inside two screens.
 *
 * The cause is structural, not a typo. `lib/pricing/search-story.ts` composes
 * that clause from the TIER LADDER alone: any rung outside the subdivision
 * makes it claim a shortage, and the ladder does not know what the kept set
 * turned out to be. Walking a wider rung is not the same event as finding
 * nothing at home — the ladder walks on to fill a target, and the sales it
 * already had stay in the set.
 *
 * So the sentence resolves in this order:
 *
 *   1. `render_args.compSearch.sentence` — the pricing side's own account,
 *      printed as written. It sees the rungs AND the kept set.
 *   2. the rungs, when `compSearch` carries them without a sentence.
 *   3. `compTrace` plus `comps[].subdivision`, here.
 *
 * And one rule outranks all three: **the document may never claim a shortage
 * inside a subdivision that supplied kept sales.** It is not a wording
 * preference. It is the §0 rule that narrative changes when it contradicts the
 * data, applied to the one sentence in the chapter that is prose rather than a
 * figure.
 */

import { cleanText, countWord } from '@/lib/cma/render-blocks'
import { readCompSearch, type CompSearch, type CompSearchRung } from '@/lib/cma/render-contract'
import type { CmaAdjustedComp } from '@/lib/cma/types'

function key(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

/**
 * How many of the sales the document PRINTS are in the subject's own
 * subdivision.
 *
 * `keptBySubdivision` wins when the row carries it, because the pricing side
 * counted the kept set and the renderer only sees what survived into
 * `comps[]`. Both answers are about the same set on a healthy row; when they
 * differ, the one that decided the price is the honest one.
 */
export function keptInSubdivision(
  subdivision: string | null | undefined,
  comps: readonly CmaAdjustedComp[],
  stored?: CompSearch | null,
): number {
  const name = cleanText(subdivision ?? null)
  if (!name) return 0
  const byName = stored?.keptBySubdivision ?? {}
  for (const [k, v] of Object.entries(byName)) {
    if (key(k) === key(name)) return Math.max(0, Math.round(v))
  }
  return comps.filter((c) => key(c.subdivision) === key(name)).length
}

/** The widest window any rung names, for the "from the last N months" tail. */
function monthsFromTrace(trace: readonly string[]): number | null {
  const months = trace
    .map((t) => /(\d+)\s*mo/i.exec(t)?.[1])
    .map((m) => (m ? Number(m) : NaN))
    .filter((n) => Number.isFinite(n) && n > 0)
  return months.length ? Math.max(...months) : null
}

/** The widest radius any rung names, in miles. Null when no rung names one. */
function milesFromTrace(trace: readonly string[]): number | null {
  const miles = trace
    .map((t) => /(\d+(?:\.\d+)?)\s*mi\b/i.exec(t)?.[1])
    .map((m) => (m ? Number(m) : NaN))
    .filter((n) => Number.isFinite(n) && n > 0)
  return miles.length ? Math.max(...miles) : null
}

/** True when any rung in the trace sits outside the subject's subdivision. */
function leftSubdivision(trace: readonly string[]): boolean {
  return trace.some((t) => {
    const k = key(t)
    return k !== '' && !k.startsWith('subdivision-') && k !== 'broker-selected'
  })
}

function rungKeys(rungs: readonly CompSearchRung[]): string[] {
  return rungs.map((r) => r.key ?? r.label ?? '').filter(Boolean)
}

function widerPhrase(miles: number | null): string {
  return miles != null
    ? `out to ${miles} mile${miles === 1 ? '' : 's'}`
    : 'past the subdivision'
}

function monthTail(months: number | null): string {
  return months != null ? ` from the last ${months} months` : ''
}

/**
 * The sentence, resolved.
 *
 * `comps` is what the chapter PRINTS, which is the only set the reader can
 * count. Every branch below is checkable against the grid two inches under it.
 */
function baseCompSearchSentence(input: {
  subdivision: string | null | undefined
  /** `render_args.compSearch`, when the row carries it. */
  args?: unknown
  /** `render_args.compTrace` — the rungs the selector actually walked. */
  compTrace?: readonly string[] | null
  comps: readonly CmaAdjustedComp[]
  /** `describeCompSearch(...).body`, the sentence this replaces. */
  fallback?: string | null
}): string {
  const stored = readCompSearch(input.args)
  const name = cleanText(stored?.subdivision ?? input.subdivision ?? null)
  const inside = keptInSubdivision(name, input.comps, stored)

  // 1. The pricing side's own sentence — but never one that claims a shortage
  //    the printed sales refute. A stored sentence is evidence, not authority.
  if (stored?.sentence && !(inside > 0 && claimsShortage(stored.sentence, name))) {
    return stored.sentence
  }

  const trace =
    rungKeys(stored?.rungs ?? []).length > 0
      ? rungKeys(stored?.rungs ?? [])
      : (input.compTrace ?? []).filter((t) => typeof t === 'string' && t.trim())
  const months = monthsFromTrace(trace)
  const miles = milesFromTrace(trace)
  const wider = trace.length > 0 ? leftSubdivision(trace) : null

  if (!name) {
    // No subdivision on the subject: there is no shortage to claim about one.
    if (wider === true) {
      return `We used the closest recent closed sales, ${widerPhrase(miles)}${monthTail(months)}.`
    }
    return cleanText(input.fallback ?? null) ?? `We used the closest recent closed sales${monthTail(months)}.`
  }

  // 2. Every printed sale is in the subdivision. Whether the ladder walked a
  //    wider rung on the way is not what the reader can check; what they can
  //    check is that every address in the grid is theirs. 19968 walked a
  //    two-mile rung and every one of its six sales is Romaine Village.
  if (inside > 0 && inside >= input.comps.length) {
    return `Every one of these sales is inside ${name}${monthTail(months)}.`
  }

  // 3. Some in the subdivision, and a wider rung walked. Both facts, in the
  //    order the reader can check them: the count first, because it is the one
  //    they can verify against the grid.
  if (inside > 0 && wider === true) {
    const of = input.comps.length
    return `${capitalise(countWord(inside))} of ${
      of > 0 ? `these ${countWord(of)} sales` : 'these sales'
    } ${inside === 1 ? 'is' : 'are'} inside ${name}. We looked ${widerPhrase(
      miles,
    )}${monthTail(months)} for the rest.`
  }

  if (inside > 0) {
    const of = input.comps.length
    return `${capitalise(countWord(inside))} of ${
      of > 0 ? `these ${countWord(of)} sales` : 'these sales'
    } ${inside === 1 ? 'is' : 'are'} inside ${name}${monthTail(months)}.`
  }

  // 5. No printed sale is inside it. The shortage claim is now the true one,
  //    and the pricing side's own wording is the best version of it.
  const fb = cleanText(input.fallback ?? null)
  if (fb) return fb
  return wider === false
    ? `We used the closest recent closed sales${monthTail(months)}.`
    : `There were no recent sales inside ${name} to price against, so we looked ${widerPhrase(
        miles,
      )}${monthTail(months)}.`
}

/**
 * Does this sentence tell the seller there were not enough sales in their own
 * subdivision? Matched on the claim, not on one phrasing — the sentence may be
 * written upstream and this is the assertion the printed grid can refute.
 */
export function claimsShortage(sentence: string, subdivision: string | null): boolean {
  if (!subdivision) return false
  const s = sentence.toLowerCase()
  if (!s.includes(subdivision.toLowerCase())) return false
  return /\b(not enough|no recent|too few|none|not sufficient|were no)\b/.test(s)
}

function capitalise(s: string): string {
  return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}` : s
}

/**
 * The search story a chapter prints: the base sentence, and on acreage the
 * splits that set sales aside (Delta 4, Matt 2026-09-09: "the story names
 * which set the price").
 */
export function compSearchSentence(input: Parameters<typeof baseCompSearchSentence>[0]): string {
  const base = baseCompSearchSentence(input)
  const rural = cleanText(readCompSearch(input.args)?.ruralSentence ?? null)
  return rural ? `${base} ${rural}` : base
}
