import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HOME_FIELD_LIMIT } from './home-constants'

const PAGE = readFileSync(resolve('app/page.tsx'), 'utf8')
const FIELD = readFileSync(resolve('app/_v3/HomeHomesField.tsx'), 'utf8')
const CSS = readFileSync(resolve('app/_v3/home-homes-field.css'), 'utf8')

describe('homepage featured rail stays in document flow', () => {
  it('caps the photographed set at 4-6 homes', () => {
    expect(HOME_FIELD_LIMIT).toBeGreaterThanOrEqual(4)
    expect(HOME_FIELD_LIMIT).toBeLessThanOrEqual(6)
    expect(PAGE).toContain('HOME_FIELD_LIMIT')
    expect(PAGE).toContain('seeAll')
    expect(PAGE).toMatch(/See all \$\{hud\.active/)
  })

  it('unsets the barrel 560px list cap so cards cannot paint over Towns', () => {
    expect(CSS).toMatch(/\.home-homes-field \.v3-field__list\s*\{[^}]*max-height:\s*none/)
    expect(CSS).toMatch(/\.home-homes-field \.v3-field__list\s*\{[^}]*overflow:\s*visible/)
    expect(CSS).toContain('isolation: isolate')
  })

  it('keeps town chips on one swipe row', () => {
    expect(CSS).toMatch(/\.home-homes-field__towns\s*\{[^}]*flex-wrap:\s*nowrap/)
    expect(CSS).toMatch(/\.home-homes-field__towns\s*\{[^}]*overflow-x:\s*auto/)
    expect(CSS).not.toMatch(/\.home-homes-field__towns\s*\{[^}]*flex-wrap:\s*wrap/)
  })

  it('mounts a still tap-through on a phone instead of PlaceFieldMap', () => {
    expect(FIELD).toContain('home-homes-field__map-still')
    expect(FIELD).toContain('/homes-for-sale?view=map')
    expect(FIELD).toContain('Open the map')
    expect(FIELD).toMatch(/const mapForSlot = wide \? liveMap/)
    expect(FIELD).toContain('PlaceFieldMap')
  })
})
