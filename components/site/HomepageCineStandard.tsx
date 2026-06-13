/**
 * HomepageCineStandard — why Ryan Realty, shown not told.
 *
 * Brand-voice locked: no headcount or smallness positioning, no banned words,
 * no em-dashes or semicolons. Positions on the standard every home gets, the
 * data, and direct-broker accountability. Each point is a concrete fact, not
 * a virtue claim.
 */

import { H2 } from '@/components/site/primitives'

const POINTS = [
  {
    n: '01',
    h: 'The full treatment, every home',
    p: 'Drone, a 3D tour, and professional video on every listing we take, not only the eight-figure ones. The marketing does not scale down with the price.',
  },
  {
    n: '02',
    h: 'You talk to the broker who closes it',
    p: 'The person you call negotiates your deal and signs off on every document. Nothing gets handed to an assistant you never met.',
  },
  {
    n: '03',
    h: 'Priced on what actually sold',
    p: 'Every number we give you traces to live MLS data and recent comparable sales, the same feed running this page. No hunches.',
  },
] as const

export default function HomepageCineStandard() {
  return (
    <section className="cine-standard" aria-label="How we work">
      <div className="cine-standard-wrap">
        <H2 className="cine-h2">The standard every home gets.</H2>
        <div className="cine-standard-grid">
          {POINTS.map((pt) => (
            <div key={pt.n} className="cine-standard-item">
              <span className="n">{pt.n}</span>
              {/* heading-display-ok */}
              <h3>{pt.h}</h3>
              <p>{pt.p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
