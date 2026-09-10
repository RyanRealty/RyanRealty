import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'app/activity/page.tsx'), 'utf8')

describe('activity #feed photo scale', () => {
  it('opts the listing-shaped feed into media="photo"', () => {
    expect(page).toMatch(/id="feed"[\s\S]{0,500}?media="photo"/)
  })
})
