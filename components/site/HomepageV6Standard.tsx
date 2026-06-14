/**
 * HomepageV6Standard — why Ryan Realty, shown not told, Linear finish.
 * Brand-voice locked: no headcount/smallness positioning, no banned words,
 * no em-dashes or semicolons. Each point is a concrete fact, not a virtue claim.
 */

const POINTS = [
  {
    num: '01',
    h: 'The full treatment, every home',
    p: 'Drone, a 3D tour, and professional video on every listing we take, not only the eight-figure ones. The marketing does not scale down with the price.',
  },
  {
    num: '02',
    h: 'You talk to the broker who closes it',
    p: 'The person you call negotiates your deal and signs off on every document. Nothing gets handed to an assistant you never met.',
  },
  {
    num: '03',
    h: 'Priced on what actually sold',
    p: 'Every number we give you traces to live MLS data and recent comparable sales, the same feed running this page. No hunches.',
  },
] as const

export default function HomepageV6Standard() {
  return (
    <section className="v6-section" aria-label="How we work">
      <div className="v6-section-wrap">
        <div className="v6-section-head">
          {/* heading-display-ok */}
          <h2>The standard every home gets</h2>
        </div>
        <div className="v6-grid3">
          {POINTS.map((pt) => (
            <div key={pt.num} className="v6-standard-item">
              <span className="num v6-tnum">{pt.num}</span>
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
