/**
 * Derives the per-hole facts a yardage book prints, from a course map file.
 *
 * Every note is measured off the same geometry the map draws: the dogleg is the
 * turn angle of the routing, the bunker count is the number of bunker polygons
 * assigned to the hole. Selecting a hole lights exactly the shapes the sentence
 * counted, so a reader can check the claim against the picture.
 *
 * CLAUDE.md §0. Per-hole par and stroke index come from OSM tags, not geometry,
 * and the tagging is partial: Tetherow's holes sum to par 71 on a par-72 course,
 * Sunriver Meadows tags none. Per-hole par prints only when the holes sum to the
 * published par; yardage only when the routings sum to within 1% of the
 * published card. Neither gate affects the drawing.
 */

export type CourseShape = { k: string; h: string | null; r: [number, number][] }
export type CourseHole = {
  ref: string
  par: number | null
  yards: number | null
  handicap: number | null
  line: [number, number][]
}
export type CourseMapData = {
  slug: string
  name: string
  published: {
    par: number | null
    yards: number | null
    holes: number | null
    designer: string | null
  } | null
  parReconciles: boolean
  yardsReconcile: boolean
  turfAcres: number | null
  holes: CourseHole[]
  shapes: CourseShape[]
}

export type HoleBend = 'left' | 'right' | 'straight' | null

export type HoleNote = {
  ref: string
  /** Null when the per-hole par did not reconcile with the published card. */
  par: number | null
  /** Null when the routings did not reconcile with the published card. */
  yards: number | null
  handicap: number | null
  bend: HoleBend
  /** Degrees of turn in the routing; null when the way is a straight two-point line. */
  bendDegrees: number | null
  bunkers: number
  greensideBunkers: number
  /** True when a mapped water hazard belongs to this hole. */
  water: boolean
  /** How many tee boxes are mapped on this hole. */
  teeBoxes: number
  /** Where this hole stands on its own course, when it stands out. */
  standout: string | null
  /** The measured sentence. Never empty — a hole with no features says so. */
  note: string
}

/** Metres between two lon/lat points, flat-earth about their own latitude. */
function metres(a: [number, number], b: [number, number]): number {
  const k = Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180))
  return Math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * 111320
}

function centroid(ring: [number, number][]): [number, number] {
  let x = 0
  let y = 0
  for (const [a, b] of ring) {
    x += a
    y += b
  }
  return [x / ring.length, y / ring.length]
}

/**
 * Signed turn of a routing, in degrees. Negative is clockwise on a north-up map,
 * which is a right-hand dogleg. A two-point way has no interior vertex and so no
 * shape information: that returns null rather than 'straight'.
 */
function turnDegrees(line: [number, number][]): number | null {
  if (line.length < 3) return null
  const k = Math.cos(line[0]![1] * (Math.PI / 180))
  const pts = line.map(([lo, la]) => [lo * k, la] as [number, number])
  let total = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i - 1]!
    const [bx, by] = pts[i]!
    const [cx, cy] = pts[i + 1]!
    const u = [bx - ax, by - ay]
    const v = [cx - bx, cy - by]
    const cross = u[0]! * v[1]! - u[1]! * v[0]!
    const dot = u[0]! * v[0]! + u[1]! * v[1]!
    total += Math.atan2(cross, dot) * (180 / Math.PI)
  }
  return total
}

/**
 * A stroke index runs 1 to the number of holes. OSM carries a `handicap=-1` on
 * Eagle Crest Ridge, which printed "Stroke index -1" on the card; anything
 * outside the range is a tag, not an index.
 */
function validStrokeIndex(value: number | null, holes: number): number | null {
  if (value == null || !Number.isInteger(value)) return null
  return value >= 1 && value <= holes ? value : null
}

/** A dogleg is called at 15°; below that the routing reads straight on the map. */
const BEND_DEGREES = 15
/** A bunker within this many metres of the green centre is greenside. */
const GREENSIDE_M = 40

const WATER_KINDS = new Set(['water_hazard', 'lateral_water_hazard'])

function sentence(n: HoleNote): string {
  const bits: string[] = []
  if (n.bend === 'left') bits.push('Doglegs left')
  else if (n.bend === 'right') bits.push('Doglegs right')
  else if (n.bend === 'straight') bits.push('Plays straight')

  if (n.bunkers > 0) {
    const word = n.bunkers === 1 ? '1 bunker' : `${n.bunkers} bunkers`
    bits.push(
      n.greensideBunkers > 0
        ? `${word}, ${n.greensideBunkers} at the green`
        : word,
    )
  }
  if (n.water) bits.push('water on the hole')
  // Mapped tee polygons, not rated tee sets: a single set is sometimes drawn as
  // two adjacent boxes, so the count is of what the map shows.
  if (n.teeBoxes >= 2) bits.push(`${n.teeBoxes} tee boxes`)

  if (bits.length === 0) return 'Nothing else is mapped on this hole.'
  const first = bits[0]!
  const rest = bits.slice(1)
  const head = first.charAt(0).toUpperCase() + first.slice(1)
  return rest.length ? `${head}. ${rest.join(', ')}.` : `${head}.`
}

export function holeNotes(data: CourseMapData): HoleNote[] {
  const byHole = new Map<string, CourseShape[]>()
  for (const s of data.shapes) {
    if (!s.h) continue
    const list = byHole.get(s.h)
    if (list) list.push(s)
    else byHole.set(s.h, [s])
  }

  const notes = data.holes.map((h) => {
    const own = byHole.get(h.ref) ?? []
    const bunkers = own.filter((s) => s.k === 'bunker')
    const greens = own.filter((s) => s.k === 'green')
    const pin = h.line[h.line.length - 1]

    // A hole can own more than one green polygon (a practice green inside the
    // same catchment); the one at the end of the routing is the green. Green
    // AREA is not published: OSM traces some greens as the whole complex, so
    // Crosswater would print an 18,300 sq ft putting surface, and there is no
    // published card to reconcile a green against.
    let greenAt: [number, number] | null = null
    let greenD = Infinity
    for (const g of greens) {
      const c = centroid(g.r)
      const d = pin ? metres(c, pin) : 0
      if (d < greenD) {
        greenD = d
        greenAt = c
      }
    }
    const greenside = greenAt
      ? bunkers.filter((b) => metres(centroid(b.r), greenAt!) <= GREENSIDE_M).length
      : 0

    const deg = turnDegrees(h.line)
    const bend: HoleBend =
      deg == null ? null : deg <= -BEND_DEGREES ? 'right' : deg >= BEND_DEGREES ? 'left' : 'straight'

    const note: HoleNote = {
      ref: h.ref,
      par: data.parReconciles ? h.par : null,
      yards: data.yardsReconcile ? h.yards : null,
      handicap: validStrokeIndex(h.handicap, data.holes.length),
      bend,
      bendDegrees: deg == null ? null : Math.round(deg),
      bunkers: bunkers.length,
      greensideBunkers: greenside,
      water: own.some((s) => WATER_KINDS.has(s.k)),
      teeBoxes: own.filter((s) => s.k === 'tee').length,
      standout: null,
      note: '',
    }
    note.note = sentence(note)
    return note
  })

  return markStandouts(notes)
}

/**
 * Tag the holes that lead their own course. A tie is left untagged: 'the longest'
 * is not a fact when two holes share it.
 */
function markStandouts(notes: HoleNote[]): HoleNote[] {
  const soleLeader = <T,>(
    pick: (n: HoleNote) => number | null,
    better: (a: number, b: number) => boolean,
  ): HoleNote | null => {
    let lead: HoleNote | null = null
    let leadV: number | null = null
    let tied = false
    for (const n of notes) {
      const v = pick(n)
      if (v == null) continue
      if (leadV == null || better(v, leadV)) {
        lead = n
        leadV = v
        tied = false
      } else if (v === leadV) {
        tied = true
      }
    }
    return tied ? null : lead
  }

  const tag = (n: HoleNote | null, label: string) => {
    if (n && !n.standout) n.standout = label
  }
  tag(
    soleLeader((n) => n.yards, (a, b) => a > b),
    'Longest hole on the course',
  )
  tag(
    soleLeader((n) => n.yards, (a, b) => a < b),
    'Shortest hole on the course',
  )
  tag(
    soleLeader((n) => (n.handicap === 1 ? 1 : null), () => false),
    'Number one stroke index',
  )
  tag(
    soleLeader((n) => (n.bunkers > 0 ? n.bunkers : null), (a, b) => a > b),
    'Most bunkers on the course',
  )
  return notes
}

/** One measured line about the whole course, for the panel beside the map. */
export type CourseFact = { label: string; value: string }

/**
 * Course-level figures, each checkable against the drawing: the bunkers are
 * drawn, and the two extremes are holes the reader can find in the rail.
 */
export function courseFacts(data: CourseMapData, notes: HoleNote[]): CourseFact[] {
  const facts: CourseFact[] = []

  const bunkers = data.shapes.filter((s) => s.k === 'bunker').length
  if (bunkers > 0) facts.push({ label: 'Bunkers', value: bunkers.toLocaleString('en-US') })

  // Replaces a water-hole count. Crosswater has the Deschutes running through it
  // and OSM tags three golf hazards, so '1 of 18 holes with water' counts the
  // tagging accurately and describes the course wrongly. Par composition is
  // either complete or absent, so it can print.
  if (data.parReconciles) {
    const by = new Map<number, number>()
    for (const n of notes) {
      if (n.par == null) continue
      by.set(n.par, (by.get(n.par) ?? 0) + 1)
    }
    const shape = [...by.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([par, count]) => `${count} par ${par}`)
      .join(' · ')
    if (shape) facts.push({ label: 'Shape of the card', value: shape })
  }

  const ordinal = (ref: string): string => {
    const n = Number(ref)
    if (!Number.isFinite(n)) return ref
    const rem100 = n % 100
    if (rem100 >= 11 && rem100 <= 13) return `${n}th`
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
  }
  for (const [label, want] of [
    ['Longest hole', 'Longest hole on the course'],
    ['Shortest hole', 'Shortest hole on the course'],
  ] as const) {
    const hit = notes.find((n) => n.standout === want)
    if (hit?.yards != null) {
      facts.push({
        label,
        value: `${ordinal(hit.ref)}, ${hit.yards.toLocaleString('en-US')} yards`,
      })
    }
  }
  return facts
}

/** Front nine, back nine, and the totals a scorecard prints under each. */
export type CourseNine = {
  label: string
  holes: HoleNote[]
  par: number | null
  yards: number | null
}

export function courseNines(notes: HoleNote[]): CourseNine[] {
  const out: HoleNote[] = []
  const back: HoleNote[] = []
  for (const n of notes) {
    const num = Number(n.ref)
    if (Number.isFinite(num) && num > 9) back.push(n)
    else out.push(n)
  }
  const sum = (list: HoleNote[], key: 'par' | 'yards'): number | null => {
    if (list.length === 0) return null
    let total = 0
    for (const n of list) {
      const v = n[key]
      if (v == null) return null
      total += v
    }
    return total
  }
  const nines: CourseNine[] = [
    { label: 'Out', holes: out, par: sum(out, 'par'), yards: sum(out, 'yards') },
  ]
  if (back.length) {
    nines.push({ label: 'In', holes: back, par: sum(back, 'par'), yards: sum(back, 'yards') })
  }
  return nines
}
