'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

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
        // Design-system Button carrying the KB skin: .kb-reviews-more (kb.css,
        // unlayered so it wins over the utility layer) supplies display, border,
        // color, padding, and type; h-auto/rounded-none clear the primitive's
        // fixed height + radius so the brutalist square look is unchanged.
        <Button type="button" variant="ghost" className="kb-reviews-more h-auto rounded-none" onClick={() => setExpanded(true)}>
          Show all {total} reviews <span className="arr">↓</span>
        </Button>
      ) : null}
    </>
  )
}
