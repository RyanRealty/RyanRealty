/**
 * Primary broker action on the CMA entity page. A real <a target="_blank"> —
 * not next/link — so the request hits view/route.ts (full HTML). A Next.js
 * Link client-navigates as RSC, finds no page.tsx, and renders the public 404.
 */
import { brokerCmaViewHref } from '@/lib/cma/draft-access'

export function CmaReviewDocumentButton({ slug }: { slug: string }) {
  return (
    <a
      href={brokerCmaViewHref(slug)}
      target="_blank"
      rel="noopener noreferrer"
      className="av2-btn av2-btn--touch"
      style={{ textDecoration: 'none', width: '100%' }}
      data-cma-first-action="review-cma"
    >
      Review CMA
    </a>
  )
}
