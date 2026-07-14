'use client'

import { useState } from 'react'

/**
 * design-audit: on mobile all 24 review cards stacked into a ~20-screen scroll.
 * This caps the mobile view to the first 8 with a "Show all" button. Every review
 * is still rendered server-side inside the <ul> (SEO + JSON-LD unaffected) — CSS
 * just hides cards past the 8th on small screens until the visitor expands.
 * Desktop (multi-column grid) is untouched.
 */
export function ReviewsCollapse({ total, children }: { total: number; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const collapsed = total > 8 && expanded === false
  return (
    <>
      <ul className={`kb-reviews-grid${collapsed ? ' kb-reviews-collapsed' : ''}`}>{children}</ul>
      {collapsed ? (
        <button type="button" className="kb-reviews-more" onClick={() => setExpanded(true)}>
          Show all {total} reviews <span className="arr">↓</span>
        </button>
      ) : null}
    </>
  )
}
