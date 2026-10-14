/**
 * LABELS THAT NEVER SIT ON EACH OTHER OR ON A LINE (reader review 2026-10-09,
 * 915 Saginaw).
 *
 * The "What happened" chart drew its "$925K" ask label on top of "canceled
 * after 138 days", and on a phone its two-line zone caption ran through the
 * "$995K" step label and the $995K line itself. Each label had been placed on
 * its own, by a rule that looked only at itself. A label's place is a joint
 * decision: where one goes decides where the next can go.
 *
 * So a chart hands this every label it wants to draw, each with the places it
 * may sit in order of preference (a cost: 0 where it belongs, more the further
 * it is from what it names), and what leaving it off would cost (its weight:
 * the end of the line and the last ask outweigh a middle cut, which the
 * sentence above the chart already states). The ink a label may not touch,
 * lines, marks, ticks, the frame, is given as boxes. The search returns the
 * cheapest set of placements in which no label touches another label or any
 * of that ink: it moves a label before it drops one, and drops the lesser
 * label before the greater.
 *
 * Pure geometry, no text measurement: the caller measures its own labels
 * (lib/cma/market-charts.ts labelWidth, an upper bound in either face).
 */

/** An axis-aligned rectangle in drawing units, y down. */
export type LabelBox = { x0: number; y0: number; x1: number; y1: number }

export type LabelCandidate<T> = {
  /** The ink this placement covers: one box per line of a label. */
  boxes: readonly LabelBox[]
  /** Preference. 0 is where the label belongs; more is further from it. */
  cost: number
  /** What the caller draws for this placement. */
  value: T
}

export type LabelToPlace<T> = {
  id: string
  /** Every place the label may sit. */
  candidates: readonly LabelCandidate<T>[]
  /** What drawing the chart without this label costs. Larger than any move. */
  dropCost: number
}

/** Ink a label may cross at a price, never for free (a hairline, say). */
export type SoftObstacle = { box: LabelBox; cost: number }

/** True when the two boxes are closer than `gap` on both axes. */
export function boxesTouch(a: LabelBox, b: LabelBox, gap = 0): boolean {
  return a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap
}

/** The ink of a straight horizontal or vertical stroke, as a box. */
export function strokeBox(x1: number, y1: number, x2: number, y2: number, halfWidth: number): LabelBox {
  return {
    x0: Math.min(x1, x2) - halfWidth,
    y0: Math.min(y1, y2) - halfWidth,
    x1: Math.max(x1, x2) + halfWidth,
    y1: Math.max(y1, y2) + halfWidth,
  }
}

/**
 * One line of text as a box, from its baseline. `ascent` and `descent` are the
 * share of the font size above and below the baseline.
 */
export function textBox(input: {
  x: number
  baseline: number
  width: number
  fontSize: number
  anchor: 'start' | 'middle' | 'end'
  ascent?: number
  descent?: number
}): LabelBox {
  const x0 =
    input.anchor === 'start' ? input.x : input.anchor === 'middle' ? input.x - input.width / 2 : input.x - input.width
  return {
    x0,
    x1: x0 + input.width,
    y0: input.baseline - input.fontSize * (input.ascent ?? 0.8),
    y1: input.baseline + input.fontSize * (input.descent ?? 0.24),
  }
}

function inside(b: LabelBox, frame: LabelBox): boolean {
  return b.x0 >= frame.x0 && b.x1 <= frame.x1 && b.y0 >= frame.y0 && b.y1 <= frame.y1
}

function anyTouch(a: readonly LabelBox[], b: readonly LabelBox[], gap: number): boolean {
  for (const x of a) for (const y of b) if (boxesTouch(x, y, gap)) return true
  return false
}

/**
 * The cheapest placement of every label in which no two labels touch and no
 * label touches the hard ink or leaves the frame. A label whose every place
 * is blocked is left off (null). Labels are searched in the order given, so
 * put the weightiest first; the search is exhaustive up to `budget` steps and
 * returns the best it has found when the budget runs out (the first full
 * answer it reaches is the greedy one, so it always has one).
 */
export function placeLabels<T>(input: {
  labels: readonly LabelToPlace<T>[]
  obstacles: readonly LabelBox[]
  soft?: readonly SoftObstacle[]
  frame: LabelBox
  /** Clear space kept between a label and anything else. */
  gap?: number
  budget?: number
}): Map<string, LabelCandidate<T> | null> {
  const gap = input.gap ?? 2
  const budget = input.budget ?? 50_000
  // Each label's admissible places, cheapest first, with the price of every
  // soft line it crosses folded in. Fixed for the whole search.
  const options = input.labels.map((label) =>
    label.candidates
      .filter(
        (c) =>
          c.boxes.length > 0 &&
          c.boxes.every((b) => inside(b, input.frame)) &&
          !anyTouch(c.boxes, input.obstacles, gap),
      )
      .map((c) => ({
        candidate: c,
        cost:
          c.cost +
          (input.soft ?? []).reduce(
            (sum, s) => sum + (c.boxes.some((b) => boxesTouch(b, s.box, 0)) ? s.cost : 0),
            0,
          ),
      }))
      .sort((a, b) => a.cost - b.cost),
  )
  // The cheapest any label can still cost, for the bound.
  const floor = options.map((opts, i) => Math.min(opts[0]?.cost ?? Infinity, input.labels[i]!.dropCost))
  const rest: number[] = new Array(options.length + 1).fill(0)
  for (let i = options.length - 1; i >= 0; i--) rest[i] = rest[i + 1]! + floor[i]!

  let best: Array<LabelCandidate<T> | null> | null = null
  let bestCost = Infinity
  const chosen: Array<LabelCandidate<T> | null> = []
  let steps = 0

  const search = (i: number, cost: number): void => {
    if (steps++ > budget && best) return
    if (cost + rest[i]! >= bestCost) return
    if (i === options.length) {
      best = [...chosen]
      bestCost = cost
      return
    }
    for (const opt of options[i]!) {
      const clash = chosen.some((other) => other != null && anyTouch(opt.candidate.boxes, other.boxes, gap))
      if (clash) continue
      chosen.push(opt.candidate)
      search(i + 1, cost + opt.cost)
      chosen.pop()
    }
    chosen.push(null)
    search(i + 1, cost + input.labels[i]!.dropCost)
    chosen.pop()
  }
  search(0, 0)

  const out = new Map<string, LabelCandidate<T> | null>()
  const answer = (best ?? []) as Array<LabelCandidate<T> | null>
  input.labels.forEach((label, i) => out.set(label.id, answer[i] ?? null))
  return out
}
