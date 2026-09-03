/**
 * PATTERN: COURSE MAP. A golf course drawn the way a yardage book draws it,
 * with the card for whichever hole you are pointing at.
 *
 * WHERE THE SHAPE COMES FROM. Two sources, because neither is enough alone.
 * OpenStreetMap has this region's greens, bunkers, tees and hole routings in
 * detail, but it maps only 12 of Tetherow's fairways, so a course drawn from it
 * alone is a scatter of floating greens. The body comes from Oregon's own 2018
 * aerial survey instead: mown turf segmented out of the imagery and clipped to
 * the course's own boundary, which is the fairway system whether or not anyone
 * tagged it. Tetherow measures 39.6 acres of maintained turf that way,
 * Crosswater 36.3. scripts/golf/build-course-maps.mjs is the whole pipeline.
 *
 * WHY THE HOLE NOTES ARE MEASURED AND NOT WRITTEN. Every other course page on
 * the internet describes a hole in marketing prose. Here the dogleg is the turn
 * angle of the routing on screen, the bunker count is the number of bunker
 * shapes that light up when you point at the hole, and the water is drawn. The
 * sentence and the picture come from one array, so the reader can check the
 * claim by looking at it. lib/golf/course-map.ts does the measuring.
 *
 * THE SCORECARD RECONCILES OR IT DOES NOT PRINT (CLAUDE.md §0). OSM's per-hole
 * par sums to 71 on par-72 Tetherow and to nothing at all on Sunriver Meadows,
 * because the tags are partial. So per-hole par prints only when the holes sum
 * to the club's published par, and per-hole yardage only when the routings sum
 * to within 1% of the published card. Totals always come from the registry.
 *
 * Server component. The whole drawing, all eighteen cards and the scorecard are
 * server HTML — before hydration and with JavaScript off, every hole's card is
 * on the page and readable, which is also what makes it worth indexing. The
 * client island only collapses that to one card at a time and wires the
 * pointer, so nothing about the geometry ships twice.
 */
import { cn } from '@/lib/utils'
import {
  V3Eyebrow,
  V3Heading,
  V3SourceLine,
  V3_ROOT_CLASS,
  v3Text,
  type V3Text,
} from './atoms'
import {
  courseFacts,
  courseNines,
  holeNotes,
  type CourseMapData,
  type HoleNote,
} from '@/lib/golf/course-map'
import { V3CourseMapControl } from './V3CourseMap.client'
import './tokens.css'
import './V3CourseMap.css'

export type { CourseMapData } from '@/lib/golf/course-map'

const W = 1000
const PAD = 22

/** Paint order: ground first, hazards, then the things that sit on top. */
const LAYERS: ReadonlyArray<{ kinds: readonly string[]; cls: string }> = [
  { kinds: ['bounds'], cls: 'v3-course__bounds' },
  { kinds: ['turf'], cls: 'v3-course__turf' },
  { kinds: ['rough'], cls: 'v3-course__rough' },
  { kinds: ['fairway'], cls: 'v3-course__fairway' },
  { kinds: ['water_hazard', 'lateral_water_hazard'], cls: 'v3-course__water' },
  { kinds: ['bunker'], cls: 'v3-course__bunker' },
  { kinds: ['tee'], cls: 'v3-course__tee' },
  { kinds: ['green'], cls: 'v3-course__green' },
]

export type V3CourseMapProps = {
  data: CourseMapData
  /** Section heading. The page owns the wording; this owns the pattern. */
  heading: V3Text
  /**
   * The club's own line about the course, when the registry has one. Printed
   * once under the claim and attributed there — it is the one sentence on this
   * section that is not measured off the drawing.
   */
  note?: V3Text
  /** The section's own id, for the hash and aria-labelledby. */
  id?: string
  className?: string
}

/** "Par 4 · 486 yards" — only the halves that reconciled. */
function figureLine(h: HoleNote): string | null {
  const bits: string[] = []
  if (h.par != null) bits.push(`Par ${h.par}`)
  if (h.yards != null) bits.push(`${h.yards.toLocaleString('en-US')} yards`)
  if (h.handicap != null) bits.push(`Stroke index ${h.handicap}`)
  return bits.length ? bits.join(' · ') : null
}

export function V3CourseMap({ data, heading, note, id, className }: V3CourseMapProps) {
  const notes = holeNotes(data)
  if (notes.length === 0) return null

  const pts: [number, number][] = [
    ...data.shapes.flatMap((s) => s.r),
    ...data.holes.flatMap((h) => h.line),
  ]
  if (pts.length === 0) return null

  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [lo, la] of pts) {
    if (lo < x0) x0 = lo
    if (lo > x1) x1 = lo
    if (la < y0) y0 = la
    if (la > y1) y1 = la
  }
  const mx = (x1 - x0) * 0.02
  const my = (y1 - y0) * 0.02
  x0 -= mx
  x1 += mx
  y0 -= my
  y1 += my

  // Equirectangular about the course's own latitude. A course spans under two
  // kilometres, where the error is centimetres.
  const kx = Math.cos(((y0 + y1) / 2) * (Math.PI / 180))
  const spanX = (x1 - x0) * kx
  const spanY = y1 - y0
  if (!(spanX > 0) || !(spanY > 0)) return null
  const s = (W - PAD * 2) / spanX
  const H = Math.round(spanY * s) + PAD * 2

  const px = ([lo, la]: [number, number]): [number, number] => [
    PAD + (lo - x0) * kx * s,
    PAD + (y1 - la) * s,
  ]
  const path = (ring: [number, number][], close = true) =>
    ring
      .map((p, i) => {
        const [a, b] = px(p)
        return `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`
      })
      .join(' ') + (close ? ' Z' : '')

  // Marker size is in USER units but the drawing is scaled to fit a height cap,
  // so a fixed radius shrinks as the property gets taller: Crosswater runs twice
  // Tetherow's viewBox and its hole numbers rendered at six pixels. Sizing off
  // the box keeps the discs about constant on screen.
  const unit = Math.max(1, H / 900)
  const discR = 12 * unit
  const hitR = 26 * unit

  const headingId = id ? `${id}-heading` : undefined
  const nines = courseNines(notes)
  const facts = courseFacts(data, notes)
  const first = notes[0]!

  const claim = [
    data.published?.par ? `Par ${data.published.par}` : null,
    data.published?.yards
      ? `${data.published.yards.toLocaleString('en-US')} yards from the back tees`
      : null,
    data.published?.designer,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-course', className)}
      aria-labelledby={headingId}
      data-course={data.slug}
      data-hole={first.ref}
    >
      <V3Eyebrow>The course</V3Eyebrow>
      <V3Heading level={2} id={headingId}>
        {heading}
      </V3Heading>
      {claim ? <p className="v3-course__claim">{claim}</p> : null}
      {note ? <p className="v3-course__note">{note}</p> : null}

      <div className="v3-course__body">
        <div className="v3-course__stage">
          <svg
            className="v3-course__svg"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Course map of ${data.name}, ${data.holes.length} holes`}
          >
            <rect width={W} height={H} className="v3-course__ground" />
            {LAYERS.map(({ kinds, cls }) =>
              data.shapes
                .filter((sh) => kinds.includes(sh.k))
                .map((sh, i) => (
                  <path key={`${cls}-${i}`} className={cn(cls, sh.h && `H${sh.h}`)} d={path(sh.r)} />
                )),
            )}
            {data.holes.map((h) => (
              <path
                key={`route-${h.ref}`}
                className={cn('v3-course__route', `H${h.ref}`)}
                d={path(h.line, false)}
              />
            ))}
            {data.holes.map((h) => {
              const [a, b] = px(h.line[0]!)
              return (
                <g
                  key={`tag-${h.ref}`}
                  className={cn('v3-course__tag', `H${h.ref}`)}
                  transform={`translate(${a.toFixed(1)},${b.toFixed(1)})`}
                >
                  <circle r={discR.toFixed(1)} />
                  <text
                    y={(discR * 0.34).toFixed(1)}
                    textAnchor="middle"
                    fontSize={(discR * 0.95).toFixed(1)}
                  >
                    {h.ref}
                  </text>
                </g>
              )
            })}
            {/* The targets. A 26-unit radius on a 1000-unit box clears the 44px
                thumb floor at every width the stage renders; the 12-unit number
                disc does not. */}
            {notes.map((n, i) => {
              const [a, b] = px(data.holes[i]!.line[0]!)
              const line = figureLine(n)
              return (
                <circle
                  key={`hit-${n.ref}`}
                  className="v3-course__hit"
                  data-hole={n.ref}
                  cx={a.toFixed(1)}
                  cy={b.toFixed(1)}
                  r={hitR.toFixed(1)}
                  aria-label={line ? `Hole ${n.ref}, ${line}` : `Hole ${n.ref}`}
                />
              )
            })}
          </svg>
        </div>

        <div className="v3-course__aside">
          <div className="v3-course__cards" aria-live="polite">
            {notes.map((n) => {
              const line = figureLine(n)
              return (
                <article key={n.ref} className="v3-course__card" data-hole={n.ref}>
                  <p className="v3-course__cardnum">Hole {n.ref}</p>
                  {line ? <p className="v3-course__cardfig">{line}</p> : null}
                  {n.standout ? <p className="v3-course__standout">{n.standout}</p> : null}
                  <p className="v3-course__cardnote">{n.note}</p>
                </article>
              )
            })}
          </div>

          {facts.length ? (
            <dl className="v3-course__facts">
              {facts.map((f) => (
                <div key={f.label} className="v3-course__fact">
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="v3-course__rail">
          {nines.map((nine) => (
            <div key={nine.label} className="v3-course__nine">
              <div className="v3-course__holes">
                {nine.holes.map((n) => (
                  <button
                    key={n.ref}
                    type="button"
                    className="v3-course__pick"
                    data-hole={n.ref}
                    aria-pressed={n.ref === first.ref}
                  >
                    <span className="v3-course__picknum">{n.ref}</span>
                    {n.par == null ? null : <span className="v3-course__pickpar">{n.par}</span>}
                  </button>
                ))}
              </div>
              <p className="v3-course__ninetotal">
                <span>{nine.label}</span>
                {nine.par == null ? null : <span>Par {nine.par}</span>}
                {nine.yards == null ? null : (
                  <span>{nine.yards.toLocaleString('en-US')} yards</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>

      <V3CourseMapControl />
      <V3SourceLine
        source={v3Text(
          'hole routings, greens, bunkers and tees from OpenStreetMap contributors, clipped to the course boundary; ' +
            'fairway turf traced from Oregon statewide aerial imagery; par and yardage from the USGA National Course Rating Database',
        )}
      />
    </section>
  )
}
