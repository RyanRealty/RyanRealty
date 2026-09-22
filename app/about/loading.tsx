/**
 * Streaming fallback for /about.
 *
 * First screen is faces at display scale, not a storefront postcard.
 * Geometry matches AboutFirm on cream.
 */

import { V3_ROOT_CLASS } from '@/components/site/v3'
import './_v3/about-loading.css'

export default function AboutLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading About Ryan Realty</span>

      <div className={`${V3_ROOT_CLASS} about-loading__crumb`} aria-hidden="true">
        <div className="about-loading__fill" />
      </div>

      <section className={`${V3_ROOT_CLASS} about-loading__faces`} aria-hidden="true">
        <div className="about-loading__group">
          <div className="about-loading__fill about-loading__face about-loading__face--display" />
          <div className="about-loading__fill about-loading__face" />
          <div className="about-loading__fill about-loading__face" />
        </div>
        <div className="about-loading__fill about-loading__line" />
      </section>
    </div>
  )
}
