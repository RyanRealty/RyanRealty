/**
 * Atlas place-name packing. Labels live in SCREEN pixels (outside the camera
 * transform) so zoom does not blow type up on top of its neighbours. Greedy:
 * higher rank keeps the slot, a colliding lower-rank name is dropped.
 */

export type AtlasLabelKind = 'town' | 'place' | 'active' | 'home' | 'street'

export type PackedAtlasLabel = {
  id: string
  kind: AtlasLabelKind
  text: string
  x: number
  y: number
}

export type AtlasLabelCandidate = PackedAtlasLabel & {
  /** Half-width of the label box in screen pixels. */
  hw: number
  /** Half-height of the label box in screen pixels. */
  hh: number
  /** Higher wins a collision. */
  rank: number
}

/** Average glyph width in ems. The painter and the box use the same figure. */
const LABEL_EM = 0.58

/**
 * Word-wrap a label to `maxW` pixels. A single word longer than the line is
 * broken, so a recorded plat name cannot paint as one line past the map edge.
 * The page check refuses that ink: a one-line "Deschutes River Recreation
 * Homesites…" label crossed the CMA's right margin by about 5pt.
 */
export function wrapLabelLines(text: string, maxW: number, fs: number): string[] {
  const cw = Math.max(1, fs * LABEL_EM)
  const limit = Math.max(cw * 4, maxW)
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let line = ''
  const fits = (s: string) => s.length * cw <= limit + 0.01
  const pushWord = (word: string) => {
    if (fits(word)) {
      line = word
      return
    }
    let rest = word
    while (!fits(rest)) {
      const n = Math.max(1, Math.floor(limit / cw))
      lines.push(rest.slice(0, n))
      rest = rest.slice(n)
    }
    line = rest
  }
  for (const word of words) {
    if (!line) {
      pushWord(word)
      continue
    }
    const next = `${line} ${word}`
    if (fits(next)) line = next
    else {
      lines.push(line)
      line = ''
      pushWord(word)
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Approximate the painted box so packing can run without measuring the DOM. */
export function atlasLabelBox(text: string, kind: AtlasLabelKind): { hw: number; hh: number } {
  const fs = kind === 'street' ? 9.5 : kind === 'place' ? 11 : kind === 'active' || kind === 'home' ? 13 : 12
  const maxW = kind === 'active' || kind === 'home' ? 220 : kind === 'street' ? 92 : 120
  const content = Math.max(28, text.length * fs * LABEL_EM)
  const w = Math.min(maxW, content)
  const lines = Math.max(1, wrapLabelLines(text, w, fs).length)
  return { hw: w / 2 + 4, hh: (lines * fs * 1.2) / 2 + 4 }
}

function overlaps(a: AtlasLabelCandidate, b: AtlasLabelCandidate, gap: number): boolean {
  return Math.abs(a.x - b.x) < a.hw + b.hw + gap && Math.abs(a.y - b.y) < a.hh + b.hh + gap
}

function clampIntoView(c: AtlasLabelCandidate, view: { w: number; h: number }): AtlasLabelCandidate {
  return {
    ...c,
    x: Math.min(Math.max(c.x, c.hw), Math.max(c.hw, view.w - c.hw)),
    y: Math.min(Math.max(c.y, c.hh), Math.max(c.hh, view.h - c.hh)),
  }
}

function fullyOutside(c: AtlasLabelCandidate, view: { w: number; h: number }): boolean {
  return c.x + c.hw < 0 || c.x - c.hw > view.w || c.y + c.hh < 0 || c.y - c.hh > view.h
}

/**
 * Keep the highest-rank labels that do not sit on each other. Home and the
 * hovered/pinned place are clamped into the stage rather than dropped.
 */
export function packAtlasLabels(
  candidates: readonly AtlasLabelCandidate[],
  view: { w: number; h: number },
  gap = 6,
): PackedAtlasLabel[] {
  if (view.w <= 0 || view.h <= 0) return []
  const sorted = [...candidates].sort((a, b) => b.rank - a.rank || a.text.localeCompare(b.text))
  const placed: AtlasLabelCandidate[] = []
  for (const raw of sorted) {
    const keep = raw.kind === 'home' || raw.kind === 'active'
    const c = keep ? clampIntoView(raw, view) : raw
    if (!keep && fullyOutside(c, view)) continue
    if (placed.some((p) => overlaps(c, p, gap))) continue
    placed.push(c)
  }
  return placed.map(({ id, kind, text, x, y }) => ({ id, kind, text, x, y }))
}
