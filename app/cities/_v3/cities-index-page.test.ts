import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve('app/cities/page.tsx'), 'utf8')

describe('cities index SITE-92', () => {
  it('keeps required sections and installs catalog surfaces', () => {
    expect(PAGE).toMatch(/<V3Ledger/)
    expect(PAGE).toMatch(/<V3Quiet/)
    expect(PAGE).toMatch(/<RegionalAlertSheet/)
    expect(PAGE).toMatch(/<V3Atlas/)
    expect(PAGE).toMatch(/getBoundaryGeoJSON/)
    expect(PAGE).not.toMatch(/getCityBoundaryGeoJSON/)
    expect(PAGE).toMatch(/<CitiesInsight/)
    expect(PAGE).toMatch(/<CitiesAlertStrip/)
    expect(PAGE.indexOf('<CitiesAlertStrip')).toBeLessThan(PAGE.indexOf('<CitiesInsight'))
    expect(PAGE.indexOf('cities-fold__stage')).toBeLessThan(PAGE.indexOf('{insight}'))
    expect(PAGE).toMatch(/<V3Number/)
    expect(PAGE).toMatch(/<V3MosCompare/)
    expect(PAGE).toMatch(/mediaGaps="omit"/)
    expect(PAGE).toMatch(/cityLeftoverActive/)
    expect(PAGE).toMatch(/regionLeftover: hud.active/)
    expect(PAGE).toMatch(/id="cities-fold"/)
    expect(PAGE).not.toMatch(/snapshotActive:/)
    expect(PAGE).toMatch(/leftover homes for sale in Central Oregon/)
    expect(PAGE).not.toMatch(/homes for sale across these cities/)
    expect(PAGE).not.toMatch(/regionActive/)
    expect(PAGE).toContain("from '@/lib/data'")
  })
})
