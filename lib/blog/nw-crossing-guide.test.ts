import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { posts } from '../../scripts/blog-content/community-spotlights'
import { extractBlogFaq } from './publish-blog-faq'

const post = posts.find((p) => p.slug === 'living-in-nw-crossing-bend')!
const html = post.content
const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261009160000_blog_nw_crossing_guide_refresh.sql'),
  'utf8',
)

describe('living-in-nw-crossing-bend refresh (brief 2026-10-09)', () => {
  it('seed body is the migration body', () => {
    const body = migration.split('$nw$')[1]
    expect(body).toBe(html)
    const md5 = createHash('md5').update(html).digest('hex')
    expect(migration).toContain(`md5(content) <> '${md5}'`)
  })

  it('opens with the answer-first block dated to the figures', () => {
    expect(html.trimStart().startsWith('<div class="v3-blog-answer" data-figures-as-of="2026-10-08">')).toBe(true)
    expect(html).toContain('$1,149,500')
    expect(html).toContain('54 single-family sales')
  })

  it('has the corrected schools and none of the old ones', () => {
    for (const s of ['High Lakes Elementary', 'William E. Miller Elementary', 'Pacific Crest Middle School', 'Summit High School']) {
      expect(html).toContain(s)
    }
    expect(html).not.toMatch(/Elk Meadow|Cascade Middle/)
  })

  it('drops old price bands, dues figures, and unsourced claims', () => {
    expect(html).not.toMatch(/\$475,000|\$1,000,000|\$1,200,000|\$175|\$1,620|\$135|active homeowners/)
    expect(html).not.toMatch(/New Urbanist|stucco|concert|one of the few|minute/i)
    expect(html).not.toContain('\u2014')
  })

  it('emits the five FAQs in brief order', () => {
    const faq = extractBlogFaq(html)
    expect(faq.map((f) => f.question)).toEqual([
      'What is the median home price in NorthWest Crossing?',
      'Are home prices going up in NorthWest Crossing?',
      'What schools serve NorthWest Crossing?',
      'Does NorthWest Crossing have an HOA?',
      'When is the NorthWest Crossing farmers market?',
    ])
    expect(faq[3].answer).toMatch(/^No\. NorthWest Crossing has no neighborhood-wide HOA or dues\./)
  })

  it('keeps the old anchors on the retitled sections', () => {
    expect(html).toContain('<h2 id="price-ranges-and-market-trends">What homes cost in NorthWest Crossing</h2>')
    expect(html).toContain('<h2 id="hoa-and-community-rules">Design rules and HOA</h2>')
  })

  it('fits the title budget and credits Matt', () => {
    expect(post.seo_title!.length).toBeLessThanOrEqual(46)
    expect((post.seo_description ?? '').length).toBeLessThanOrEqual(155)
    expect(post.author_broker_id).toBe('2fda6811-2edf-49e3-b3ca-33e1052f82e6')
  })
})
