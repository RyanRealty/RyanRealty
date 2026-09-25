import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = readFileSync(join(process.cwd(), 'public/rr-doc-tracker.js'), 'utf8')

describe('rr-doc-tracker — in-letter click payload', () => {
  it('posts the destination with identity params stripped', () => {
    expect(src).toContain("eventType: 'cta_click'")
    expect(src).toContain('metadata: { destination: destination }')
    expect(src).toContain("destUrl.searchParams.delete('_pid')")
    expect(src).toContain("destUrl.searchParams.delete('_fuid')")
    expect(src).toMatch(/destination = destUrl\.toString\(\)/)
  })
})
