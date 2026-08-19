import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('adjustment grid stays inside the print box', () => {
  it('uses a fixed six-column table and short headers', () => {
    const css = readFileSync(join(process.cwd(), 'lib/cma/render-css.ts'), 'utf8')
    const render = readFileSync(join(process.cwd(), 'lib/cma/render.ts'), 'utf8')
    expect(css).toMatch(/table\.comps \{[\s\S]*table-layout: fixed/)
    expect(render).toContain('<th class="num">Time</th>')
    expect(render).toContain('<th class="num">Size</th>')
    expect(render).not.toContain('Market conditions (time)')
  })
})
