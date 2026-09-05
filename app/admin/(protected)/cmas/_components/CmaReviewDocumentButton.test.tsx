import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CmaReviewDocumentButton } from './CmaReviewDocumentButton'
import { adminCmaEntityActions } from '@/lib/cma/draft-access'

describe('CmaReviewDocumentButton', () => {
  it('opens the broker view in a new tab as a quiet document link', () => {
    const first = adminCmaEntityActions({
      slug: 'cma-850-quince-redmond-97756',
      canOpenDocument: true,
      hasPdf: true,
    })[0]
    expect(first?.label).toBe('Review CMA')
    expect(first?.href).toBe('/admin/cmas/cma-850-quince-redmond-97756/view')
    expect(first?.primary).toBe(false)

    const html = renderToStaticMarkup(
      <CmaReviewDocumentButton slug="cma-850-quince-redmond-97756" />,
    )
    expect(html).toContain('Review CMA')
    expect(html).toContain('href="/admin/cmas/cma-850-quince-redmond-97756/view"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('data-cma-first-action="review-cma"')
    expect(html).toContain('av2-btn--quiet')
    expect(html).toContain('av2-btn--touch')
    expect(html).not.toContain('width:100%')
    expect(html).not.toContain('Open PDF')
  })
})
