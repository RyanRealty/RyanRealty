import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const nextConfig = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')

const BLOG_CACHE = 'public, s-maxage=300, stale-while-revalidate=3600'

function headerValueFor(source: string): string | null {
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `source:\\s*'${escaped}'[\\s\\S]*?key:\\s*'Cache-Control'[\\s\\S]*?value:\\s*'([^']+)'`,
  )
  const match = nextConfig.match(re)
  return match?.[1] ?? null
}

describe('blog edge Cache-Control headers (SITE-29)', () => {
  it("next.config.ts headers include /blog with s-maxage=300", () => {
    expect(headerValueFor('/blog')).toBe(BLOG_CACHE)
  })

  it("next.config.ts headers include /blog/:path* with s-maxage=300", () => {
    expect(headerValueFor('/blog/:path*')).toBe(BLOG_CACHE)
  })
})
