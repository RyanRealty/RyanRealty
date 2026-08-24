import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8')

describe('community page leftover 12-month sold overlay', () => {
  it('assigns HUD sold12mo and FAQ soldCount12mo from leftover closedCount', () => {
    expect(SRC).toMatch(/getPublicDetachedPace/)
    expect(SRC).toMatch(/sold12mo:\s*publicPace\.closedCount/)
    expect(SRC).toMatch(/soldCount12mo:\s*publicPace\.closedCount/)
  })

  it('does not assign those figures from cache soldCount', () => {
    expect(SRC).not.toMatch(/sold12mo:[\s\S]{0,80}stats\?\.soldCount/)
    expect(SRC).not.toMatch(/soldCount12mo:[\s\S]{0,80}stats\?\.soldCount/)
    expect(SRC).not.toMatch(/stats\?\.soldCount/)
  })

  it('keeps leftover median sold and sale-to-list', () => {
    expect(SRC).toMatch(/publicPace\.medianClose/)
    expect(SRC).toMatch(/publicPace\.saleToOriginal/)
  })

  it('does not map leftover daysToContract onto median DOM', () => {
    expect(SRC).toMatch(/medianDom12mo:\s*stats\?\.medianDaysOnMarket/)
    expect(SRC).not.toMatch(/medianDom12mo:[\s\S]{0,80}daysToContract/)
    expect(SRC).not.toMatch(/medianDom12mo:[\s\S]{0,80}publicPace\.daysToContract/)
  })
})
