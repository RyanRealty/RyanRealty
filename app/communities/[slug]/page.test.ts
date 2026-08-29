import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8')

describe('community page leftover 12-month sold overlay', () => {
  it('assigns HUD sold12mo and FAQ soldCount12mo from leftover closedCount', () => {
    expect(SRC).toMatch(/getPublicDetachedPace/)
    expect(SRC).toMatch(/leftoverHudKpis/)
    // v3 spelling (2026-08-26): the HUD figures print through the shared
    // leftoverMarketFigures builder (app/cities/[slug]/_v3/city-sections.ts),
    // which prints hud.sold12mo under 'sold · 12 months'. The FAQ input stays
    // page-local and stays leftover.
    expect(SRC).toMatch(/leftoverMarketFigures/)
    expect(SRC).toMatch(/soldCount12mo:\s*publicPace\.closedCount/)
  })

  it('does not assign those figures from cache soldCount', () => {
    expect(SRC).not.toMatch(/sold12mo:[\s\S]{0,80}stats\?\.soldCount/)
    expect(SRC).not.toMatch(/soldCount12mo:[\s\S]{0,80}stats\?\.soldCount/)
    expect(SRC).not.toMatch(/stats\?\.soldCount/)
  })

  it('keeps leftover median sold and sale-to-list', () => {
    // Community restyle (2026-08-29): sale-to-list and the HUD pile still ride
    // leftoverMarketFigures. Pace feeds leftoverHudKpis. The pace run does
    // not print on the face.
    expect(SRC).not.toMatch(/publicPaceItems\(publicPace\)/)
    expect(SRC).toMatch(/leftoverHudKpis/)
    expect(SRC).toMatch(/leftoverMarketFigures/)
    expect(SRC).toMatch(/communityFaceMarketFigures/)
  })

  it('does not map leftover daysToContract onto median DOM', () => {
    expect(SRC).not.toMatch(/medianDom12mo:/)
    expect(SRC).not.toMatch(/medianDom12mo:[\s\S]{0,80}daysToContract/)
    expect(SRC).not.toMatch(/medianDom12mo:[\s\S]{0,80}publicPace\.daysToContract/)
  })
})
