import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx'), 'utf8')

describe('nested neighborhood FAQ leftover sold count', () => {
  const faqBlock = SRC.match(/const marketFaqInput[\s\S]*?buildMarketFaq/)?.[0] ?? ''

  it('assigns soldCount12mo from leftover publicPace.closedCount, never cache stats.soldCount', () => {
    expect(faqBlock).toMatch(/soldCount12mo:\s*publicPace\.closedCount/)
    expect(faqBlock).not.toMatch(/stats\?\.soldCount/)
    expect(faqBlock).not.toMatch(/soldCount12mo:\s*publishSoldCount\(\{\s*value:\s*stats\?\.soldCount/)
  })

  it('FAQ Median to pending is leftover HUD, not pulse or cache DOM', () => {
    expect(faqBlock).toMatch(/medianDaysToPending:\s*hud\.daysToPending/)
    expect(faqBlock).not.toMatch(/pulse\?\.medianDaysToPending/)
    expect(faqBlock).not.toMatch(/stats\?\.medianDaysOnMarket/)
  })
})
