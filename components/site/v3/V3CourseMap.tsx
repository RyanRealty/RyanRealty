/**
 * PATTERN: COURSE MAP. A golf course drawn hole by hole, with the card for the
 * selected hole beside it.
 *
 * GEOMETRY SOURCES. OSM supplies greens, bunkers, tees and hole routings. OSM
 * fairway coverage is partial (12 of Tetherow's 18), so the fairway body comes
 * from mown turf traced out of Oregon's 2018 aerial imagery, clipped to the
 * course's own OSM boundary. Pipeline: scripts/golf/build-course-maps.mjs.
 *
 * HOLE NOTES ARE MEASURED. The dogleg is the turn angle of the routing, the
 * bunker count is the number of bunker shapes assigned to the hole, the water is
 * a mapped hazard. Measured in lib/golf/course-map.ts off the same array this
 * file draws, so the sentence and the picture cannot disagree.
 *
 * FIGURES RECONCILE OR THEY DO NOT PRINT (CLAUDE.md §0). OSM per-hole par sums
 * to 71 on par-72 Tetherow and to 0 on Sunriver Meadows. Per-hole par prints
 * only when the holes sum to the published par; per-hole yardage only when the
 * routings sum to within 1% of the published card. Totals come from the
 * registry.
 *
 * Server component. The drawing, all eighteen cards and the scorecard are server
 * HTML, so the section reads without JavaScript and is indexable. The client
 * island hides the unselected cards and wires the pointer.
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

export function V3CourseMap({ data, heading, id, className }: V3CourseMapProps) {
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

  const headingId = id ? `${id}-heading` : undefined
  const nines = courseNines(notes)
  const facts = courseFacts(data, notes)
  const missing = data.missingHoles ?? []
  const greenAnchored = data.anchor === 'green'
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
            {data.holes
              .filter((h) => h.line.length > 1)
              .map((h) => (
                <path
                  key={`route-${h.ref}`}
                  className={cn('v3-course__route', `H${h.ref}`)}
                  d={path(h.line, false)}
                />
              ))}
          </svg>

          {/* The tap layer sits OVER the drawing in HTML, not inside the SVG.
              Anything sized in SVG user units scales with the drawing: a 44px
              target measured 20px on Juniper at 390, and the hole numbers were
              6px on a desktop Juniper because its viewBox is wide. Both are
              fixed px here, positioned by percent against the same box the paths
              are drawn in.

              aria-hidden with no roles: the scorecard below is the accessible
              control for every hole and carries the same label, so exposing
              these too would announce eighteen holes twice. */}
          <div className="v3-course__taps" aria-hidden="true">
            {notes.map((n, i) => {
              const [a, b] = px(data.holes[i]!.line[0]!)
              return (
                <span
                  key={`tap-${n.ref}`}
                  className={cn('v3-course__hit', `H${n.ref}`)}
                  data-hole={n.ref}
                  style={{ left: `${((a / W) * 100).toFixed(2)}%`, top: `${((b / H) * 100).toFixed(2)}%` }}
                >
                  <span className="v3-course__disc">{n.ref}</span>
                </span>
              )
            })}
          </div>
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
      {greenAnchored ? (
        <p className="v3-course__gap">
          No hole routings are mapped for this course, so each number marks its green
          rather than its tee, and no hole prints a length or a shape.
        </p>
      ) : null}
      {missing.length ? (
        <p className="v3-course__gap">
          {missing.length === 1
            ? `Hole ${missing[0]} has no routing in the map data, so it is not drawn.`
            : `Holes ${missing.join(', ')} have no routing in the map data, so they are not drawn.`}
        </p>
      ) : null}
      <V3SourceLine
        source={v3Text(
          (greenAnchored
            ? 'greens, bunkers and tees from OpenStreetMap contributors'
            : 'hole routings, greens, bunkers and tees from OpenStreetMap contributors') +
            ', clipped to the course boundary; fairway turf traced from Oregon statewide aerial imagery; ' +
            'par and yardage from the USGA National Course Rating Database',
        )}
      />
    </section>
  )
}
