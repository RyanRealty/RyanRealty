/**
 * One ask position for the whole letter.
 *
 * Page 3 used to say "You asked $616,900" from the first exposure segment
 * while page 4 said "The last listing asked $589,900" from lastListPrice.
 * Original and last are allowed to differ. They have to be labeled as such,
 * and both sentences have to come from this resolver.
 */

export type AskExposureLike = {
  segments?: readonly { ask?: number | null }[] | null
  final?: number | null
}

export type AskPosition = {
  /** The first ask the listing wore, when we know one. */
  originalAsk: number | null
  /** The ask it came off at, or the only ask. */
  lastAsk: number | null
}

function positive(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) && n > 0 ? n : null
}

export function resolveAskPosition(input: {
  lastListPrice?: number | null
  /** MLS OriginalListPrice. It is the first ask even when the exposure starts later. */
  originalListPrice?: number | null
  exposure?: AskExposureLike | null
}): AskPosition {
  const segments = (input.exposure?.segments ?? [])
    .map((s) => positive(s?.ask))
    .filter((n): n is number => n != null)
  const first = segments[0] ?? null
  const finalFromExposure = positive(input.exposure?.final) ?? segments[segments.length - 1] ?? null
  const lastList = positive(input.lastListPrice)
  const lastAsk = lastList ?? finalFromExposure
  const originalAsk = positive(input.originalListPrice) ?? first ?? lastAsk
  return { originalAsk, lastAsk }
}

/** True when the letter must name an original ask and a different last ask. */
export function askStepped(position: AskPosition): boolean {
  return (
    position.originalAsk != null &&
    position.lastAsk != null &&
    position.originalAsk !== position.lastAsk
  )
}
