import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const RENDER = readFileSync(resolve('app/blog/[slug]/_v3/render-blog-post.tsx'), 'utf8')

describe('blog post hub link', () => {
  it('renders a contextual exact-match hub after the answer', () => {
    expect(RENDER).toMatch(/import \{ matchHubForPost \} from '@\/lib\/blog\/match-hub-for-post'/)
    expect(RENDER).toMatch(/const hub = matchHubForPost\(post\)/)
    expect(RENDER).toMatch(/className="v3-blog-hub"/)
    expect(RENDER).toMatch(/<Link href=\{hub\.href\}>\{hub\.anchor\}<\/Link>/)
    const afterAnswer = RENDER.slice(RENDER.indexOf('v3-blog-answer'))
    expect(afterAnswer.indexOf('v3-blog-hub')).toBeGreaterThan(-1)
    expect(afterAnswer.indexOf('v3-blog-hub')).toBeLessThan(afterAnswer.indexOf('v3-blog-layout'))
  })
})
