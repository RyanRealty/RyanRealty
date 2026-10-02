import { describe, expect, it } from 'vitest'
import { storageImageAtWidth } from './storage-image-width'

const OBJ =
  'https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/asset-library/photos/grok-imagine/imagine-place-city-bend.png'

describe('storageImageAtWidth', () => {
  it('serves a Supabase Storage object through the renderer at the drawn width', () => {
    expect(storageImageAtWidth(OBJ, 160)).toBe(
      'https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/render/image/public/asset-library/photos/grok-imagine/imagine-place-city-bend.png?width=160&quality=72',
    )
  })

  it('leaves every other source as it was', () => {
    expect(storageImageAtWidth('/images/communities/broken-top.jpg', 160)).toBe('/images/communities/broken-top.jpg')
    expect(storageImageAtWidth('https://cdn.photos.sparkplatform.com/or/x.jpg', 160)).toBe(
      'https://cdn.photos.sparkplatform.com/or/x.jpg',
    )
    expect(storageImageAtWidth(`${OBJ}?v=2`, 160)).toBe(`${OBJ}?v=2`)
    expect(storageImageAtWidth(OBJ, 0)).toBe(OBJ)
  })

  it('never invents a source', () => {
    expect(storageImageAtWidth(null, 160)).toBeNull()
    expect(storageImageAtWidth('  ', 160)).toBeNull()
  })
})
