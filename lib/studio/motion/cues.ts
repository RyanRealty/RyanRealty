/**
 * lib/studio/motion/cues.ts — what the type layer says, and when.
 *
 * A cue is one card on screen: the address over the first beat, the verified
 * figure, the closing card. This module decides the cues for a draft from its
 * format and its subject, places them in time, and computes, for any frame t,
 * how present each element is. It is pure: no browser, no ffmpeg, no network.
 *
 * The rules it holds, each from a canon document rather than taste:
 *  - Content text is up by 1.0s (platform-best-practices: hook timing). The
 *    lead card starts at 0.3s and is fully in by 0.7s.
 *  - Nothing readable is on screen for less than 2.5s, and the lead holds
 *    longer when the clip allows it (PROGRAM_2026-07-21 reconciled rules).
 *  - Entrances fade up 400ms with at most 16px of travel on the brand
 *    ease-out (design_system/ryan-realty/SKILL.md motion ladder). Type never
 *    scales and never rides the moving photo.
 *  - The logo is a closer, never an opener: the brand card is the final 2.5s.
 *  - Every number on screen is one of the subject's verified figures, written
 *    exactly as the §0 trace holds it (figureLeaks is the backstop). The
 *    months-of-supply verdict comes from lib/market/classify.ts, so the words
 *    can never disagree with the number they sit beside.
 *  - A listing's closing card carries the LISTING AGENT's headshot. A listing
 *    from another brokerage gets no brand card at all: we do not put the
 *    brokerage's name on another office's listing.
 */
import { MOS_BALANCED_MAX, MOS_SELLER_MAX, marketVerdict } from '@/lib/market/classify'
import { formatDate } from '@/lib/format/date'
import { unauthorisedFigures } from '../caption'
import { presence } from './ease'

/** Entrance length, seconds. The brand motion ladder's 400ms fade-up. */
export const ENTER_SECONDS = 0.4
/** Exit length, seconds. */
export const EXIT_SECONDS = 0.3
/** Entrance travel, px at 1080 wide. The ladder caps travel at 16px. */
export const TRAVEL_PX = 16
/** When the first card starts. Fully in by 0.7s, inside the 1.0s rule. */
export const LEAD_START_SECONDS = 0.3
/** The closing card's share of the end of the film. */
export const CLOSER_SECONDS = 2.5
/** No readable card shorter than this. */
export const MIN_CARD_SECONDS = 2.5
/** A card past this length is a held slide, not motion. */
export const MAX_CARD_SECONDS = 5.2
/** Air between one card leaving and the next arriving. */
export const CUE_GAP_SECONDS = 0.2
/**
 * How long before a cut a card is gone. Wider than the gap: beat times come
 * from the plan, and a returned clip can run a little long or short, so the
 * margin absorbs that drift and a card never straddles a change of picture.
 */
export const CUT_MARGIN_SECONDS = 0.5
/** The address a viewer types. One CTA, no tracking string on screen. */
export const CLOSER_CTA = 'ryan-realty.com'

/** How a format uses the type layer (StudioFormat.motion). */
export type MotionSpec = {
  /** 'listing': address, then price and rooms. 'market': the place's months of supply. */
  lead: 'listing' | 'market'
  /**
   * 'brand': wordmark card. 'listing-agent': the listing agent's card, our
   * listings only. 'none': no brand in frame; attribution lives in the caption.
   */
  closer: 'brand' | 'listing-agent' | 'none'
}

/** The listing agent, when the listing is ours. */
export type MotionAgent = {
  name: string
  /**
   * Site-relative path of the agent's own transparent headshot, e.g.
   * /images/brokers/ryan-matt.png. Null when the roster has no file for this
   * broker: the card then carries the name without a portrait.
   */
  headshotPath: string | null
}

/** The parts of a Studio subject the type layer reads. */
export type MotionSubject = {
  label: string
  figures: Record<string, string>
  citations: Array<Record<string, unknown>>
  /** Two-line heading for a listing: the city small, the street large. */
  heading?: { eyebrow: string; line: string }
  /** Resolved for listings. Null when the listing belongs to another office. */
  agent?: MotionAgent | null
}

type CueTiming = { id: string; start: number; end: number }

export type MotionCue =
  | (CueTiming & {
      kind: 'title'
      eyebrow: string
      line: string
      value: string | null
      detail: string | null
      figureKeys: string[]
    })
  | (CueTiming & {
      kind: 'figure'
      eyebrow: string
      value: string
      detail: string | null
      asOf: string | null
      figureKeys: string[]
    })
  | (CueTiming & {
      kind: 'meter'
      eyebrow: string
      value: string
      mos: number
      verdict: string
      /** Which zone the meter lights: the same marketVerdict call as the words. */
      verdictKind: 'sellers' | 'balanced' | 'buyers'
      /** Methodology constants drawn on the meter, never a market claim. */
      thresholds: [number, number]
      domainMax: number
      asOf: string | null
      figureKeys: string[]
    })
  | (CueTiming & {
      kind: 'closer'
      cta: string
      agent: MotionAgent | null
    })

export type MotionPlan = {
  cues: MotionCue[]
  duration: number
  /** What the planner chose not to draw, and why. Recorded on the draft. */
  notes: string[]
}

/**
 * Elements inside each card and their stagger. The page builder renders an
 * element per part with id `${cue.id}-${part}`; frameState reads the same
 * table, so the two cannot drift.
 */
export const CUE_PARTS: Record<MotionCue['kind'], Array<{ part: string; delay: number }>> = {
  title: [{ part: 'card', delay: 0 }],
  figure: [{ part: 'card', delay: 0 }],
  meter: [
    { part: 'card', delay: 0 },
    { part: 'verdict', delay: 0.45 },
  ],
  closer: [
    { part: 'card', delay: 0 },
    { part: 'mark', delay: 0.15 },
    { part: 'cta', delay: 0.3 },
  ],
}

/** "$1,250,000" stays as written; only the case of a sentence start changes. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * The date the data behind a figure describes, from its §0 trace: the cache's
 * refreshed_at or the cell's computed_at. Never fetched_at: that is when we
 * read the row, and printing it would claim a freshness the data may not have
 * (§0: a date is a number and needs a named basis). No basis, no date.
 */
export function figureAsOf(subject: MotionSubject, figureKey: string): string | null {
  const value = subject.figures[figureKey]
  if (!value) return null
  const trace = subject.citations.find((c) => c.figure === value)
  const stamp = trace?.refreshed_at ?? trace?.computed_at
  if (typeof stamp !== 'string' || !stamp) return null
  const day = formatDate(stamp)
  // formatDate prints a placeholder glyph for a bad stamp; draw nothing instead.
  return /\d{4}/.test(day) ? `As of ${day}` : null
}

function roomsLine(figures: Record<string, string>): { text: string | null; keys: string[] } {
  const parts: string[] = []
  const keys: string[] = []
  if (figures.bedrooms) {
    parts.push(`${figures.bedrooms} ${figures.bedrooms === '1' ? 'bedroom' : 'bedrooms'}`)
    keys.push('bedrooms')
  }
  if (figures.bathrooms) {
    parts.push(`${figures.bathrooms} ${figures.bathrooms === '1' ? 'bathroom' : 'bathrooms'}`)
    keys.push('bathrooms')
  }
  return { text: parts.length ? parts.join(' · ') : null, keys }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
/** A lead card before it is placed in time. */
type LeadDraft = DistributiveOmit<Exclude<MotionCue, { kind: 'closer' }>, 'id' | 'start' | 'end'>

/** The listing cards: address first, then what it costs and holds. */
function listingLeads(subject: MotionSubject, slots: number): LeadDraft[] {
  const heading = subject.heading ?? { eyebrow: '', line: subject.label }
  const price = subject.figures['list price'] ?? null
  const rooms = roomsLine(subject.figures)
  if (slots >= 2 && price) {
    return [
      { kind: 'title', eyebrow: heading.eyebrow, line: heading.line, value: null, detail: null, figureKeys: [] },
      {
        kind: 'figure',
        eyebrow: 'List price',
        value: price,
        detail: rooms.text,
        asOf: figureAsOf(subject, 'list price'),
        figureKeys: ['list price', ...rooms.keys],
      },
    ]
  }
  return [
    {
      kind: 'title',
      eyebrow: heading.eyebrow,
      line: heading.line,
      value: price,
      detail: rooms.text,
      figureKeys: [...(price ? ['list price'] : []), ...rooms.keys],
    },
  ]
}

/**
 * The market card. Months of supply is the one number that says what kind of
 * market this is, so it leads, on a meter with its verdict. When the cache
 * withheld it (an untrusted grain), the median list price stands in; when
 * neither exists the card names the place and claims nothing.
 */
function marketLeads(subject: MotionSubject): LeadDraft[] {
  const mosText = subject.figures['months of supply']
  const mos = mosText ? Number.parseFloat(mosText) : Number.NaN
  const verdict = marketVerdict(mos)
  if (mosText && Number.isFinite(mos) && verdict.kind !== 'unknown') {
    return [
      {
        kind: 'meter',
        eyebrow: subject.label,
        value: mosText,
        mos,
        // The displayed value never crosses a threshold the raw value does
        // not (lib/format/months-of-supply.ts), so the verdict of the printed
        // number is the verdict of the market. One call names the words and
        // lights the zone, so the two cannot disagree.
        verdict: capitalise(verdict.label),
        verdictKind: verdict.kind,
        thresholds: [MOS_SELLER_MAX, MOS_BALANCED_MAX],
        domainMax: Math.max(10, Math.ceil(mos + 1)),
        asOf: figureAsOf(subject, 'months of supply'),
        figureKeys: ['months of supply'],
      },
    ]
  }
  for (const key of ['median list price', 'active listings'] as const) {
    const value = subject.figures[key]
    if (value) {
      return [
        {
          kind: 'figure',
          eyebrow: subject.label,
          value,
          detail: key,
          asOf: figureAsOf(subject, key),
          figureKeys: [key],
        },
      ]
    }
  }
  return [{ kind: 'title', eyebrow: '', line: subject.label, value: null, detail: null, figureKeys: [] }]
}

/**
 * Place the cards in time.
 *
 * `beats` are the start times of the film's cuts (one entry for a single
 * clip). Each lead card sits on its own beat and leaves before the next cut,
 * so a card never straddles a change of picture; the beats after the lead
 * cards run clean, because the pause is part of the film.
 */
export function planMotion(input: {
  spec: MotionSpec
  subject: MotionSubject
  duration: number
  beats?: number[]
}): MotionPlan {
  const { spec, subject, duration } = input
  const notes: string[] = []
  const beats = (input.beats?.length ? input.beats : [0]).filter((b) => b >= 0 && b < duration)

  let closer: MotionCue | null = null
  if (spec.closer === 'brand') {
    closer = { kind: 'closer', id: 'closer', start: 0, end: duration, cta: CLOSER_CTA, agent: null }
  } else if (spec.closer === 'none') {
    closer = null
  } else if (subject.agent) {
    closer = { kind: 'closer', id: 'closer', start: 0, end: duration, cta: CLOSER_CTA, agent: subject.agent }
  } else {
    notes.push('No closing card: the listing agent is not a Ryan Realty broker.')
  }
  const closerStart = duration - CLOSER_SECONDS
  if (closer && closerStart < LEAD_START_SECONDS + MIN_CARD_SECONDS + CUE_GAP_SECONDS) {
    notes.push(`No closing card: a ${duration.toFixed(1)}s clip has no room for one after the lead.`)
    closer = null
  }
  const leadLimit = closer ? closerStart - CUE_GAP_SECONDS : duration - CUE_GAP_SECONDS

  // One lead card per beat while beats remain and the card still fits.
  const windows: Array<{ start: number; end: number }> = []
  for (const [i, beat] of beats.entries()) {
    const start = beat + LEAD_START_SECONDS
    const nextCut = beats[i + 1]
    const beforeCut = nextCut != null ? nextCut - CUT_MARGIN_SECONDS : duration - CUE_GAP_SECONDS
    const end = Math.min(beforeCut, leadLimit, start + MAX_CARD_SECONDS)
    if (end - start < MIN_CARD_SECONDS) break
    windows.push({ start, end })
  }

  const drafts = spec.lead === 'listing' ? listingLeads(subject, windows.length) : marketLeads(subject)
  if (windows.length === 0) {
    notes.push(`No lead card: a ${duration.toFixed(1)}s clip cannot hold one for ${MIN_CARD_SECONDS}s.`)
  }
  const leads: MotionCue[] = drafts.slice(0, windows.length).map((draft, i) => ({
    ...draft,
    id: `lead${i + 1}`,
    start: windows[i].start,
    end: windows[i].end,
  }) as MotionCue)

  if (closer) closer = { ...closer, start: closerStart, end: duration }
  return { cues: closer ? [...leads, closer] : leads, duration, notes }
}

/** Every string a cue puts on screen. */
export function cueTexts(cue: MotionCue): string[] {
  switch (cue.kind) {
    case 'title':
      return [cue.eyebrow, cue.line, cue.value ?? '', cue.detail ?? '']
    case 'figure':
      return [cue.eyebrow, cue.value, cue.detail ?? '', cue.asOf ?? '']
    case 'meter':
      return [cue.eyebrow, cue.value, 'months of supply', cue.verdict, cue.asOf ?? '']
    case 'closer':
      return [cue.agent ? 'Listed by' : '', cue.agent?.name ?? '', cue.cta]
  }
}

/**
 * §0 backstop: numbers on screen that are not a verified figure.
 *
 * Authored text is allowed through on purpose and only that: the subject's
 * own label (a street number is not a market claim), the as-of dates read
 * from the traces, and the meter's threshold constants. Anything else that
 * looks like a number is a leak, and a leak kills the draft.
 */
export function figureLeaks(plan: MotionPlan, subject: MotionSubject, rendered?: string[]): string[] {
  const authored: string[] = [subject.label, subject.heading?.line ?? '', subject.heading?.eyebrow ?? '', CLOSER_CTA]
  for (const cue of plan.cues) {
    if (cue.kind === 'meter') authored.push(String(cue.thresholds[0]), String(cue.thresholds[1]))
    if ((cue.kind === 'figure' || cue.kind === 'meter') && cue.asOf) authored.push(cue.asOf)
    if (cue.kind === 'closer' && cue.agent) authored.push(cue.agent.name)
  }
  const text = (rendered ?? plan.cues.flatMap(cueTexts)).join('\n')
  return unauthorisedFigures(text, subject.figures, { subject: authored.join(' ') })
}

/** One element's state at frame t. Rounded so identical frames compare equal. */
export type ElementState = { id: string; opacity: number; y: number; marker?: number }

/**
 * Where everything is at frame t. The renderer hands this to the page and
 * reuses the previous screenshot whenever it is unchanged, which is most of a
 * film: cards spend far longer holding than moving.
 */
export function frameState(plan: MotionPlan, t: number, scale = 1): ElementState[] {
  const out: ElementState[] = []
  for (const cue of plan.cues) {
    const exit = cue.kind === 'closer' ? 0 : EXIT_SECONDS
    for (const { part, delay } of CUE_PARTS[cue.kind]) {
      const p = presence(t, { start: cue.start + delay, end: cue.end }, ENTER_SECONDS, exit)
      const state: ElementState = {
        id: `${cue.id}-${part}`,
        opacity: Math.round(p * 1000) / 1000,
        y: Math.round((1 - p) * TRAVEL_PX * scale * 100) / 100,
      }
      if (cue.kind === 'meter' && part === 'card') {
        // The marker draws on from the left edge to its value once the card is
        // in, the meter's one movement. The number itself never counts up.
        const travel = presence(t, { start: cue.start + ENTER_SECONDS, end: cue.end }, 0.6, 0)
        state.marker = Math.round(travel * 1000) / 1000
      }
      out.push(state)
    }
  }
  return out
}

/**
 * Where each card's QA still is pulled: 1.3s in, when every staggered part has
 * landed and the meter marker has stopped, or just before it leaves if the
 * card is shorter than that.
 */
export function stillTimes(plan: MotionPlan): Array<{ cueId: string; t: number }> {
  return plan.cues.map((cue) => ({
    cueId: cue.id,
    t: Math.round(Math.min(cue.start + 1.3, cue.end - 0.35) * 1000) / 1000,
  }))
}
