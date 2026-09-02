/**
 * Streaming fallback for /about.
 *
 * WHAT THIS REPLACED (2026-09-02). The previous file previewed a page that has
 * not existed since the v3 migration: a max-w-7xl column, a 3:1 hero band, three
 * prose bars and a 3-up grid of rounded-lg cards with aspect-square photos.
 * The served /about renders none of that — 0 elements matching [class*="max-w-7xl"],
 * and the whole public site's --v3-radius-card is 0, so no rounded-lg corner
 * exists anywhere to preview. Every bar it drew also carried a bare `skeleton`
 * class that NO stylesheet in this repo defines (0 matching CSS rules at
 * runtime), so the fallback painted nothing at all: a wrong shape, invisibly.
 *
 * WHY NOT DELETE IT. Removing this file does not fall back to "no loading UI".
 * app/loading.tsx exists, so the nearest Suspense boundary above /about would
 * catch it — and that file is the same retired register. Deleting here would
 * swap a wrong preview for a different wrong preview.
 *
 * WHAT IT DRAWS NOW: the real page's first screen, in the real page's geometry.
 * It imports ./_v3/about-faces.css, the stylesheet AboutFaces itself uses, so
 * the reserved boxes are the boxes the faces land in rather than a second guess
 * at them. Then the opening Quiet's measure below it. Only rows that will hold
 * TEXT are painted; the three portrait slots hold their 2:3 size and show
 * nothing, because the media that lands there is an alpha-matted cutout and a
 * filled block behind it is the rectangle CLAUDE.md section 3 forbids.
 *
 * The visual half is aria-hidden and the region announces itself once.
 */

import { V3_ROOT_CLASS } from '@/components/site/v3'
import './_v3/about-faces.css'
import './_v3/about-loading.css'

const FACE_SLOTS = ['first', 'second', 'third'] as const
const PROSE_LINES = ['first', 'second', 'third'] as const

export default function AboutLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading About Ryan Realty</span>

      <div className={`${V3_ROOT_CLASS} about-loading__crumb`} aria-hidden="true">
        <div className="about-loading__fill" />
      </div>

      {/* --lead, because AboutFaces sets it from headingLevel 1 and /about
          passes 1. It is what buys the section the chrome's 24px top pad
          instead of the 115px section rhythm, and the display-1 H1 ramp. */}
      <section className={`${V3_ROOT_CLASS} about-faces about-faces--lead`} aria-hidden="true">
        <div className="about-faces__head">
          <div className="about-loading__fill about-loading__heading" />
        </div>
        <ul className="about-faces__grid">
          {FACE_SLOTS.map((slot) => (
            <li key={slot} className="about-faces__item">
              {/* Reserved, unfilled: a cutout lands here, not a card. */}
              <div className="about-faces__photo-link about-loading__slot" />
              <div className="about-faces__row">
                <div className="about-loading__fill about-loading__name" />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${V3_ROOT_CLASS} about-loading__quiet`} aria-hidden="true">
        <div className="about-loading__fill about-loading__subhead" />
        <div className="about-loading__lines">
          {PROSE_LINES.map((line) => (
            <div key={line} className="about-loading__fill about-loading__line" />
          ))}
        </div>
      </section>
    </div>
  )
}
