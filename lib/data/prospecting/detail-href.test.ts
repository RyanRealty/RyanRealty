import { describe, expect, it } from 'vitest'
import { prospectDetailHref } from './detail-href'

describe('prospectDetailHref', () => {
  it('encodes FSBO urls once for the path segment', () => {
    expect(prospectDetailHref('fsbo', 'https://example.com/a/b')).toBe(
      '/admin/prospecting/fsbo/https%3A%2F%2Fexample.com%2Fa%2Fb',
    )
  })

  it('passes listing keys through for expired', () => {
    expect(prospectDetailHref('expired', '22012345')).toBe('/admin/prospecting/expired/22012345')
  })
})
