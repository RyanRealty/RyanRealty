import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

function readRouteFile(relativePath: string): string {
  const filePath = path.resolve(__dirname, '..', relativePath)
  return fs.readFileSync(filePath, 'utf8')
}

describe('SEO route metadata contracts', () => {
  it('enforces canonical alternates on core dynamic route families', () => {
    const files = [
      'app/cities/[slug]/page.tsx',
      'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
      'app/communities/[slug]/page.tsx',
      'app/listing/[listingKey]/page.tsx',
      'app/search/[...slug]/page.tsx',
      'app/blog/[slug]/page.tsx',
      'app/team/[slug]/page.tsx',
    ]

    for (const file of files) {
      const content = readRouteFile(file)
      // The canonical alternates contract is satisfied by either:
      //   (a) literal `alternates: { canonical }` inline in the file, OR
      //   (b) a call to `pageMetadata(...)` from lib/site/page-metadata
      //       which always sets `alternates: { canonical }` per its
      //       signature (see lib/site/page-metadata.ts L69).
      const hasInlineCanonical = /alternates:\s*\{[^}]*\bcanonical\b/m.test(
        content,
      )
      const usesPageMetadata = /\bpageMetadata\s*\(/m.test(content)
      expect(
        hasInlineCanonical || usesPageMetadata,
        `${file} must set alternates.canonical (either inline or via pageMetadata())`,
      ).toBe(true)
    }
  })

  it('enforces noindex policy helpers for variant routes', () => {
    const searchIndex = readRouteFile('app/search/page.tsx')
    const searchPage = readRouteFile('app/search/[...slug]/page.tsx')
    // SITE-29: the blog index's metadata is built once, in the shared view,
    // and applied by the bare index and its category/page routes.
    const blogIndexView = readRouteFile('app/blog/_v3/blog-index-view.tsx')

    expect(searchIndex).toMatch(/shouldNoIndexSearchVariant\(/)
    expect(searchIndex).toMatch(/appendIndexableSearchParams\(/)
    expect(searchPage).toMatch(/shouldNoIndexSearchVariant\(/)
    expect(blogIndexView).toMatch(/shouldNoIndexBlogIndex\(/)
    for (const route of [
      'app/blog/page.tsx',
      'app/blog/category/[category]/page.tsx',
      'app/blog/page/[n]/page.tsx',
      'app/blog/category/[category]/page/[n]/page.tsx',
    ]) {
      expect(readRouteFile(route)).toMatch(/blogIndexMetadata\(/)
    }
  })
})
