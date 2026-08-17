import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('admin CMA view frame policy', () => {
  it('overrides X-Frame-Options DENY so the entity iframe can load /view', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
    expect(config).toContain("source: '/admin/cmas/:slug/view'")
    expect(config).toMatch(/\/admin\/cmas\/:slug\/view[\s\S]*X-Frame-Options[\s\S]*SAMEORIGIN/)
  })
})
