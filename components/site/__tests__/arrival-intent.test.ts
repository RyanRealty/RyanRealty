import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve('components/site/v3/ArrivalIntent.client.tsx')
const PAGE = resolve('app/page.tsx')

describe('ArrivalIntent source lock', () => {
  it('is deleted and not remounted on public /', () => {
    expect(existsSync(SRC)).toBe(false)
    const page = readFileSync(PAGE, 'utf8')
    expect(page).not.toMatch(/from ['"]@\/components\/site\/v3\/ArrivalIntent/)
    expect(page).not.toMatch(/<ArrivalIntent/)
    expect(page).not.toMatch(/What are you trying to do/)
  })
})
