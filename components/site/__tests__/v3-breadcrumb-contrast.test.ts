import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CSS = join(process.cwd(), 'components/site/v3/V3Breadcrumb.css')

describe('V3Breadcrumb on-media contrast', () => {
  it('paints the inverse surface so current-page ink is not white on cream', () => {
    const css = readFileSync(CSS, 'utf8')
    expect(css).toMatch(
      /\.v3\.v3-breadcrumb--on-media\s*\{[^}]*background:\s*var\(--v3-surface-inverse\)/,
    )
  })
})
