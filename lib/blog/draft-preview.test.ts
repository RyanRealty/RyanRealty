import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { draftPreviewBanner, revisionBaseSlug } from './draft-preview'

const ROOT = join(__dirname, '..', '..')

describe('draftPreviewBanner', () => {
  it('says draft, not public, and prints the row status', () => {
    const b = draftPreviewBanner({ slug: 'bend-deal-faq', status: 'draft' })
    expect(b.title).toBe('Draft preview. Not public.')
    expect(b.status).toBe('Status: draft')
    expect(b.revisionNote).toBeNull()
  })

  it('names the live post a -revision row will replace', () => {
    const b = draftPreviewBanner({ slug: 'awbrey-glen-guide-revision', status: 'pending_review' })
    expect(b.status).toBe('Status: pending_review')
    expect(b.revisionNote).toBe(
      'Revision of /blog/awbrey-glen-guide, the live post is unchanged until you approve.',
    )
  })

  it('does not invent a status or a base slug', () => {
    expect(draftPreviewBanner({ slug: 'x', status: null }).status).toBe('Status: not set')
    expect(revisionBaseSlug('-revision')).toBeNull()
    expect(revisionBaseSlug('revisionist-history')).toBeNull()
  })
})

/**
 * The draft read is service-role and status-blind. It may be named only by the
 * DAL file itself, the lib/data barrel, and admin routes. A public route, the
 * shared render module, or any component naming it could put a draft on the
 * public site, so this walks the source trees and fails on any other mention.
 */
describe('getBlogPostDraftBySlug stays admin-only', () => {
  const ALLOWED = new Set([
    'lib/data/blog/getBlogPostDraftBySlug.ts',
    'lib/data/index.ts',
    'lib/blog/draft-preview.test.ts',
  ])
  const SKIP_DIRS = new Set(['node_modules', '.next', '.git'])

  function walk(dir: string, out: string[]): void {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) walk(full, out)
      else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(full)
    }
  }

  it('is named only by the DAL, the barrel, and app/admin/**', () => {
    const files: string[] = []
    for (const top of ['app', 'components', 'lib']) walk(join(ROOT, top), files)
    const offenders = files
      .map((f) => relative(ROOT, f).split(sep).join('/'))
      .filter((rel) => !ALLOWED.has(rel) && !rel.startsWith('app/admin/'))
      .filter((rel) => readFileSync(join(ROOT, rel), 'utf8').includes('getBlogPostDraftBySlug'))
    expect(offenders).toEqual([])
  })

  it('the shared render module reads no post by slug and the public page reads only published', () => {
    const render = readFileSync(join(ROOT, 'app/blog/[slug]/_v3/render-blog-post.tsx'), 'utf8')
    expect(render).not.toMatch(/getBlogPostBySlug\(|getBlogPostDraftBySlug/)
    const page = readFileSync(join(ROOT, 'app/blog/[slug]/page.tsx'), 'utf8')
    expect(page).toMatch(/getBlogPostBySlug\(slug\)/)
    const dal = readFileSync(join(ROOT, 'lib/data/blog/getBlogPostBySlug.ts'), 'utf8')
    expect(dal).toMatch(/\.eq\('status', 'published'\)/)
  })

  it('the preview route is under the protected admin layout, guarded in-body, noindex and dynamic', () => {
    const preview = readFileSync(
      join(ROOT, 'app/admin/(protected)/blog/preview/[slug]/page.tsx'),
      'utf8',
    )
    expect(preview).toMatch(/await requireAdminPage\('content\.blog'\)/)
    expect(preview.indexOf('requireAdminPage(')).toBeLessThan(preview.indexOf('getBlogPostDraftBySlug(slug)'))
    expect(preview).toMatch(/export const dynamic = 'force-dynamic'/)
    expect(preview).toMatch(/index: false, follow: false/)
  })
})
