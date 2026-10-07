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
import { presence, progress } from './ease'
import { CHART_DRAW_SECONDS, chartGeometry, dotAt, drawProgress, type ChartPoint, type MotionSeries } from './chart'
import { cameraAt, mapGeometry, type MapGeometry, type MotionOutline } from './map'

export type { MotionSeries } from './chart'
export type { MotionOutline } from './map'

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
  /**
   * Over footage: 'listing' (address, then price and rooms) or 'market' (the
   * place's months of supply). Drawn whole, no footage, on cream paper:
   * 'trend' (a verified monthly price line drawing on, then the meter) or
   * 'map' (the city, the camera in to the place, its outline, its figures).
   */
  lead: 'listing' | 'market' | 'trend' | 'map'
  /**
   * 'brand': wordmark card. 'listing-agent': the listing agent's card, our
   * listings only. 'none': no brand in frame; attribution lives in the caption.
   */
  closer: 'brand' | 'listing-agent' | 'none'
  /**
   * The score (lib/studio/score), composed from this plan's cues. 'calm' is
   * pad and felt notes on events, no percussion (listings: platform canon,
   * "No percussion on premium/luxury listings"); 'measured' adds a soft pulse
   * for market and place films. Absent: the film is silent.
   */
  sound?: 'calm' | 'measured'
}

/** True for films drawn whole, with no footage under them. */
export function isPaperFilm(spec: MotionSpec): boolean {
  return spec.lead === 'trend' || spec.lead === 'map'
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
  /** A trend film's verified monthly series. */
  series?: MotionSeries
  /** A map film's outlines, from the boundaries table. */
  outline?: MotionOutline
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
      kind: 'chart'
      eyebrow: string
      line: string
      scope: string
      /** The line, in film pixels, and the plotted months under it. */
      d: string
      points: ChartPoint[]
      x0: number
      x1: number
      /** The two labelled months: the point, the value as its trace holds it, the month. */
      first: { x: number; y: number; text: string; tick: string }
      last: { x: number; y: number; text: string; tick: string }
      /** The scale: hairlines at round values, labelled in the gutter (chart.ts). */
      gridlines: Array<{ y: number; label: string }>
      /** When the line starts drawing; it lands CHART_DRAW_SECONDS later. */
      drawStart: number
      asOf: string | null
      figureKeys: string[]
    })
  | (CueTiming & {
      kind: 'map'
      eyebrow: string
      line: string
      geometry: MapGeometry
      zoomStart: number
      zoomSeconds: number
      drawStart: number
      drawSeconds: number
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
  /** 'footage' lays the cards over a clip; 'paper' draws the whole film on cream. */
  surface: 'footage' | 'paper'
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
  // A paper film's opening frame is the picture and its heading, whole, so
  // frame 0 (the thumbnail, the first impression muted) already says what
  // this is. Nothing enters; the line and the camera are the motion.
  chart: [
    { part: 'axis', delay: 0 },
    { part: 'head', delay: 0 },
  ],
  map: [
    { part: 'card', delay: 0 },
    { part: 'head', delay: 0 },
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
  // The figure's own trace first: two figures can print the same string (a
  // list price and a sale price both "$725,000"), and the date is the trace's.
  const trace =
    subject.citations.find((c) => c.figure_key === figureKey) ??
    subject.citations.find((c) => c.figure === value && c.figure_key == null)
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
        eyebrow: figureScope(subject, 'months of supply') ? `${subject.label} · single-family homes` : subject.label,
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

/** When the trend line starts to draw: the opening frame reads first. */
export const CHART_DRAW_START = 0.4
/** How long the line holds once it has landed, for reading both labels. */
export const CHART_HOLD_SECONDS = 3.2
/** The meter card on a paper film: marker travel plus a full read. */
export const PAPER_METER_SECONDS = 4.4
/**
 * The map film's timings. The camera starts moving at once; the outline
 * starts drawing while the camera is still settling (at 60% of the move), so
 * the beats overlap instead of queueing, and the figures are up by 3s.
 */
export const MAP_ZOOM_START = 0.3
export const MAP_ZOOM_SECONDS = 1.6
export const MAP_DRAW_OVERLAP = 0.6
export const MAP_DRAW_SECONDS = 1.4
/** The place's figure card under the map. */
export const MAP_FIGURE_SECONDS = 4.0

/**
 * What a figure measures, in words, when its trace says it is the detached
 * segment: Market Truth's single-family homes. A number printed as "Bend" or
 * "homes" while it measures single-family only is a different number from
 * the whole market (3.5 against 3.69 months for Bend on 2026-10-07).
 */
export function figureScope(subject: MotionSubject, figureKey: string): 'Single-family' | null {
  const value = subject.figures[figureKey]
  if (!value) return null
  const trace =
    subject.citations.find((c) => c.figure_key === figureKey) ??
    subject.citations.find((c) => c.figure === value && c.figure_key == null)
  return typeof trace?.filter === 'string' && trace.filter.includes("segment='detached'") ? 'Single-family' : null
}

/** The closing card after the last lead, or null, with the planner's note. */
function closerFor(spec: MotionSpec, subject: MotionSubject, notes: string[]): Extract<MotionCue, { kind: 'closer' }> | null {
  if (spec.closer === 'brand') return { kind: 'closer', id: 'closer', start: 0, end: 0, cta: CLOSER_CTA, agent: null }
  if (spec.closer === 'none') return null
  if (subject.agent) return { kind: 'closer', id: 'closer', start: 0, end: 0, cta: CLOSER_CTA, agent: subject.agent }
  notes.push('No closing card: the listing agent is not a Ryan Realty broker.')
  return null
}

/** Put the closer after the last lead and close the film on it. */
function sealPaperFilm(leads: MotionCue[], closer: MotionCue | null, notes: string[]): MotionPlan {
  const lastEnd = leads.length ? Math.max(...leads.map((c) => c.end)) : 0
  if (!closer) return { cues: leads, duration: round3(lastEnd + CUE_GAP_SECONDS), surface: 'paper', notes }
  const start = round3(lastEnd + CUE_GAP_SECONDS)
  const end = round3(start + CLOSER_SECONDS)
  return { cues: [...leads, { ...closer, start, end }], duration: end, surface: 'paper', notes }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * The trend film: the line, then the meter, then the closer. Its length is
 * what the content needs, not a format constant: a market whose months of
 * supply the cache withheld simply has no meter card.
 */
function planTrend(spec: MotionSpec, subject: MotionSubject): MotionPlan {
  const notes: string[] = []
  const series = subject.series
  const geometry = series ? chartGeometry(series) : null
  const firstText = series ? subject.figures[series.firstKey] : undefined
  const lastText = series ? subject.figures[series.lastKey] : undefined
  if (!series || !geometry || !firstText || !lastText) {
    notes.push('No trend film: fewer than two months of verified prices, or their labels have no trace.')
    return { cues: [], duration: 0, surface: 'paper', notes }
  }
  const drawStart = CHART_DRAW_START
  const chartEnd = round3(drawStart + CHART_DRAW_SECONDS + CHART_HOLD_SECONDS)
  const chart: MotionCue = {
    kind: 'chart',
    id: 'lead1',
    start: 0,
    end: chartEnd,
    eyebrow: subject.label,
    line: series.title,
    scope: series.scope,
    d: geometry.d,
    points: geometry.points,
    x0: geometry.x0,
    x1: geometry.x1,
    first: { x: geometry.first.x, y: geometry.first.y, text: firstText, tick: geometry.first.tick },
    last: { x: geometry.last.x, y: geometry.last.y, text: lastText, tick: geometry.last.tick },
    gridlines: geometry.gridlines,
    drawStart,
    asOf: figureAsOf(subject, series.lastKey),
    figureKeys: [series.firstKey, series.lastKey],
  }
  const leads: MotionCue[] = [chart]
  const meter = marketLeads(subject).find((draft) => draft.kind === 'meter')
  if (meter) {
    const start = round3(chartEnd + CUE_GAP_SECONDS)
    leads.push({ ...meter, id: 'lead2', start, end: round3(start + PAPER_METER_SECONDS) } as MotionCue)
  } else {
    notes.push('No meter card: the cache withheld months of supply for this place.')
  }
  return sealPaperFilm(leads, closerFor(spec, subject, notes), notes)
}

/**
 * The map film: the city, the camera in to the place, the place's outline
 * drawing on and filling, then its live figures under it, then the closer.
 */
function planMap(spec: MotionSpec, subject: MotionSubject): MotionPlan {
  const notes: string[] = []
  const geometry = subject.outline ? mapGeometry(subject.outline) : null
  if (!geometry) {
    notes.push('No map film: the place has no outline in the boundaries table.')
    return { cues: [], duration: 0, surface: 'paper', notes }
  }
  // With no city to open on, there is no move: the outline draws at once.
  const moves = geometry.open.s !== geometry.arrive.s
  const zoomSeconds = moves ? MAP_ZOOM_SECONDS : 0
  const drawStart = round3(MAP_ZOOM_START + zoomSeconds * MAP_DRAW_OVERLAP)
  const drawEnd = round3(drawStart + MAP_DRAW_SECONDS)

  // The place's count with its median list price beside it: the two figures
  // a buyer asks first, both from the same live cache row. Months of supply
  // is not offered here: at a neighborhood's grain the cache withholds it
  // (lib/market/geo-grain-trust.ts).
  const figureStart = round3(drawEnd + 0.3)
  const figureEnd = round3(figureStart + MAP_FIGURE_SECONDS)
  const count = subject.figures['active listings']
  const price = subject.figures['median list price']
  const leads: MotionCue[] = []
  let mapEnd = round3(drawEnd + CHART_HOLD_SECONDS)
  if (count || price) {
    leads.push({
      kind: 'figure',
      id: 'lead2',
      start: figureStart,
      end: figureEnd,
      eyebrow: count
        ? figureScope(subject, 'active listings')
          ? 'Single-family homes for sale now'
          : 'Homes for sale now'
        : 'Median list price',
      value: (count ?? price) as string,
      detail: count && price ? `Median list price ${price}` : null,
      asOf: figureAsOf(subject, count ? 'active listings' : 'median list price'),
      figureKeys: [...(count ? ['active listings'] : []), ...(price ? ['median list price'] : [])],
    })
    mapEnd = figureEnd
  } else {
    notes.push('No figure card: the cache holds no live count or price for this place.')
  }
  leads.unshift({
    kind: 'map',
    id: 'lead1',
    start: 0,
    end: mapEnd,
    eyebrow: subject.heading?.eyebrow ?? '',
    line: subject.heading?.line ?? subject.label,
    geometry,
    zoomStart: MAP_ZOOM_START,
    zoomSeconds,
    drawStart,
    drawSeconds: MAP_DRAW_SECONDS,
    figureKeys: [],
  })
  return sealPaperFilm(leads, closerFor(spec, subject, notes), notes)
}

/**
 * Place the cards in time.
 *
 * `beats` are the start times of the film's cuts (one entry for a single
 * clip). Each lead card sits on its own beat and leaves before the next cut,
 * so a card never straddles a change of picture; the beats after the lead
 * cards run clean, because the pause is part of the film.
 *
 * A paper film (trend, map) has no footage to fit, so `duration` is ignored
 * and the plan's own length is what its cards need.
 */
export function planMotion(input: {
  spec: MotionSpec
  subject: MotionSubject
  duration: number
  beats?: number[]
}): MotionPlan {
  if (input.spec.lead === 'trend') return planTrend(input.spec, input.subject)
  if (input.spec.lead === 'map') return planMap(input.spec, input.subject)
  const { spec, subject, duration } = input
  const notes: string[] = []
  const beats = (input.beats?.length ? input.beats : [0]).filter((b) => b >= 0 && b < duration)

  let closer: MotionCue | null = closerFor(spec, subject, notes)
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
  return { cues: closer ? [...leads, closer] : leads, duration, surface: 'footage', notes }
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
    case 'chart':
      return [
        cue.eyebrow,
        cue.line,
        cue.first.text,
        cue.last.text,
        cue.first.tick,
        cue.last.tick,
        ...cue.gridlines.map((g) => g.label),
        cue.scope,
        cue.asOf ?? '',
      ]
    case 'map':
      return [cue.eyebrow, cue.line]
    case 'closer':
      return [cue.agent ? 'Listed by' : '', cue.agent?.name ?? '', cue.cta]
  }
}

/**
 * §0 backstop: numbers on screen that are not a verified figure.
 *
 * Authored text is allowed through on purpose and only that: the subject's
 * own label (a street number is not a market claim), the as-of dates read
 * from the traces, the meter's threshold constants, and a chart's scale
 * labels (round values, a ruler). A chart's month labels pass because they
 * are part of its figures' keys ("median sale price, Sep 2026"), the way
 * every figure label is. Anything else that looks
 * like a number is a leak, and a leak kills the draft.
 */
export function figureLeaks(plan: MotionPlan, subject: MotionSubject, rendered?: string[]): string[] {
  const authored: string[] = [subject.label, subject.heading?.line ?? '', subject.heading?.eyebrow ?? '', CLOSER_CTA]
  for (const cue of plan.cues) {
    if (cue.kind === 'meter') authored.push(String(cue.thresholds[0]), String(cue.thresholds[1]))
    if ((cue.kind === 'figure' || cue.kind === 'meter' || cue.kind === 'chart') && cue.asOf) authored.push(cue.asOf)
    // A chart's scale labels are a ruler at round values, not a claim.
    if (cue.kind === 'chart') authored.push(...cue.gridlines.map((g) => g.label))
    if (cue.kind === 'closer' && cue.agent) authored.push(cue.agent.name)
  }
  const text = (rendered ?? plan.cues.flatMap(cueTexts)).join('\n')
  return unauthorisedFigures(text, subject.figures, { subject: authored.join(' ') })
}

/**
 * One element's state at frame t. Rounded so identical frames compare equal.
 * The optional fields drive the paper films' pictures: the chart's reveal,
 * its riding dot and its two labels; the map's camera, outline and fill.
 */
export type ElementState = {
  id: string
  opacity: number
  y: number
  marker?: number
  /** Chart: the reveal's right edge, film pixels. */
  reveal?: number
  /** Chart: the riding dot [x, y, opacity]. */
  dot?: [number, number, number]
  /** Chart: opacity of the first and the latest month's labels. */
  labels?: [number, number]
  /** Map: camera [scale, tx, ty]. */
  camera?: [number, number, number]
  /** Map: how much of the outline has drawn (0..1), its fill, the locator dot, the city's opacity. */
  draw?: number
  fill?: number
  locator?: number
  context?: number
}


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
      // A paper film's picture (the chart's axis, the map) is up on frame 0:
      // no entrance, so the opening frame is a picture and not blank paper.
      const instant = cue.kind === 'chart' || cue.kind === 'map'
      const p = presence(t, { start: cue.start + delay, end: cue.end }, instant ? 0 : ENTER_SECONDS, exit)
      const state: ElementState = {
        id: `${cue.id}-${part}`,
        opacity: Math.round(p * 1000) / 1000,
        y: instant ? 0 : Math.round((1 - p) * TRAVEL_PX * scale * 100) / 100,
      }
      if (cue.kind === 'chart' && part === 'axis') {
        const drawn = drawProgress(t, cue.drawStart)
        const x = cue.x0 + (cue.x1 - cue.x0) * drawn
        const dot = t >= cue.drawStart ? dotAt(cue.points, x) : null
        const dotIn = progress(t, cue.drawStart, 0.2)
        // Nothing of the line before it starts; then the reveal ends at the dot.
        state.reveal = t < cue.drawStart ? 0 : Math.round(x * 100) / 100
        state.dot = dot ? [dot.x, dot.y, round3(dotIn)] : [cue.x0, cue.first.y, 0]
        const landed = cue.drawStart + CHART_DRAW_SECONDS
        // The first month is up from frame 0 with its ring; the latest lands
        // on the frame the dot reaches it ("a reaction starts on the frame of
        // its cause").
        state.labels = [1, round3(presence(t, { start: landed, end: cue.end }, ENTER_SECONDS, 0))]
      }
      if (cue.kind === 'map' && part === 'card') {
        const camera = cameraAt(cue.geometry, t, cue.zoomStart, cue.zoomSeconds)
        state.camera = [camera.s, camera.tx, camera.ty]
        state.draw = round3(drawProgress(t, cue.drawStart, cue.drawSeconds))
        state.fill = round3(presence(t, { start: cue.drawStart + cue.drawSeconds - 0.2, end: cue.end }, ENTER_SECONDS, 0))
        // The locator is up from frame 0 to show where the camera is going,
        // then fades over 9 frames as the outline takes over.
        state.locator = round3(presence(t, { start: 0, end: cue.drawStart + 0.3 }, 0, 0.3))
        // The city gives way while the camera leaves it, so no city line is
        // ever seen cut by the map's edge.
        state.context = round3(
          cue.zoomSeconds > 0 ? 1 - drawProgress(t, cue.zoomStart, cue.zoomSeconds * MAP_DRAW_OVERLAP) : 1,
        )
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
 * Where each card's QA still is pulled: 1.3s in (a chart or map once its
 * picture has finished), when every staggered part has
 * landed and the meter marker has stopped, or just before it leaves if the
 * card is shorter than that.
 */
export function stillTimes(plan: MotionPlan): Array<{ cueId: string; t: number }> {
  return plan.cues.map((cue) => {
    // A chart or map still is taken once its picture has finished: the line
    // landed with both labels in, the outline drawn and filled.
    const settled =
      cue.kind === 'chart'
        ? cue.drawStart + CHART_DRAW_SECONDS + ENTER_SECONDS + 0.2
        : cue.kind === 'map'
          ? cue.drawStart + cue.drawSeconds + ENTER_SECONDS
          : cue.start + 1.3
    return { cueId: cue.id, t: Math.round(Math.min(settled, cue.end - 0.35) * 1000) / 1000 }
  })
}
