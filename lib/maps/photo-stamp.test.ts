import { describe, expect, it } from 'vitest'
import { PHOTO_STAMP_MIN_ZOOM, buildPhotoStampElement } from './photo-stamp'

describe('photo-stamp', () => {
  it('exposes zoom threshold aligned with search storytelling', () => {
    expect(PHOTO_STAMP_MIN_ZOOM).toBe(15)
  })

  it('builds a stamp DOM node with price caption', () => {
    // jsdom or happy-dom — vitest unit may use node without document
    if (typeof document === 'undefined') return
    const el = buildPhotoStampElement('https://example.com/p.jpg', '$525K')
    expect(el.textContent).toContain('$525K')
    expect(el.querySelector('img')?.src).toContain('example.com')
  })
})
