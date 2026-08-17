import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve('components/site/v3/ArrivalIntent.client.tsx')

describe('ArrivalIntent source lock', () => {
  it('does not render a Buy/Sell/Look quiz bar or a modal', () => {
    const src = readFileSync(SRC, 'utf8')
    expect(src).not.toMatch(/What are you trying to do/)
    expect(src).not.toMatch(/>\s*Buy\s*</)
    expect(src).not.toMatch(/>\s*Sell\s*</)
    expect(src).not.toMatch(/>\s*Look\s*</)
    expect(src).not.toMatch(/from ['"]@\/components\/ui\/dialog['"]/)
    expect(src).not.toMatch(/from ['"]@\/components\/ui\/sheet['"]/)
  })
})
