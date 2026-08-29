import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const field = readFileSync(resolve('components/site/v3/V3Field.tsx'), 'utf8')
const css = readFileSync(resolve('components/site/v3/V3Field.css'), 'utf8')

describe('V3Field search photo-door hook', () => {
  it('exposes listAsDoors without forking a second Field', () => {
    expect(field).toMatch(/listAsDoors\?: boolean/)
    expect(field).toMatch(/listAsDoors = false/)
    expect(field).toMatch(/useDoors && 'v3-field--doors'/)
    expect(field).toMatch(/door \? 'v3-field__photo' : 'v3-field__row'/)
    expect(field).toMatch(/itemChrome \? 'group\/hide' : null/)
  })

  it('keeps the no-map photo mosaic off when search asks for doors plus a map', () => {
    expect(field).toMatch(/useDoors === false && hasSlot === false && photoItems\.length >= PHOTO_SURFACE_MIN/)
  })

  it('styles the search list as the existing photo tile, not a new skin', () => {
    expect(css).toMatch(/\.v3-field__list--doors/)
    expect(css).toMatch(/\.v3-field__photo/)
  })
})
