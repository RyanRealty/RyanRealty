/**
 * Streaming fallback for /about.
 *
 * First screen is Call/Text, not the faces poster. Geometry matches V3Quiet
 * on cream. Tokens from components/site/v3/tokens.css via V3_ROOT_CLASS.
 */

import { V3_ROOT_CLASS } from '@/components/site/v3'
import './_v3/about-loading.css'

const REACH_ROWS = ['call', 'text'] as const

export default function AboutLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading About Ryan Realty</span>

      <div className={`${V3_ROOT_CLASS} about-loading__crumb`} aria-hidden="true">
        <div className="about-loading__fill" />
      </div>

      <section className={`${V3_ROOT_CLASS} about-loading__quiet about-loading__quiet--lead`} aria-hidden="true">
        <div className="about-loading__fill about-loading__subhead" />
        <div className="about-loading__lines">
          <div className="about-loading__fill about-loading__line" />
        </div>
        <div className="about-loading__reach">
          {REACH_ROWS.map((row) => (
            <div key={row} className="about-loading__fill about-loading__reach-row" />
          ))}
        </div>
      </section>
    </div>
  )
}
