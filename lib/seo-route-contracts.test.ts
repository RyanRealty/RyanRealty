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
    const searchPage = readRouteFile('app/search/[...slug]/page.tsx')
    const blogIndex = readRouteFile('app/blog/page.tsx')

    expect(searchPage).toMatch(/shouldNoIndexSearchVariant\(/)
    expect(blogIndex).toMatch(/shouldNoIndexBlogIndex\(/)
  })
})
