import { describe, expect, it } from 'vitest'
import { pickCoverPhoto, BRAND_HERO, MAX_GRADES, type CoverPhotoDeps } from './cover-photo'
import type { PhotoGrade } from '@/lib/grok/classify'

function grade(subject: PhotoGrade['subject'], quality: number, hasOverlay = false) {
  return { subject, quality, animatable: true, hasOverlay, describes: '', costUsd: 0.01 }
}

function deps(over: Partial<CoverPhotoDeps> & { grades?: Record<string, ReturnType<typeof grade> | null> }): CoverPhotoDeps {
  const grades = over.grades ?? {}
  return {
    enabled: over.enabled ?? (() => true),
    fetchPhotos: over.fetchPhotos ?? (async () => []),
    grade: over.grade ?? (async (url) => grades[url] ?? null),
  }
}

describe('pickCoverPhoto — the best exterior, one grade in the common case', () => {
  it('a strong front-exterior hero is kept after ONE grade', async () => {
    let calls = 0
    const pick = await pickCoverPhoto(
      { listingKey: 'K', heroUrl: 'https://cdn/hero.jpg' },
      deps({
        fetchPhotos: async () => [{ url: 'https://cdn/2.jpg', primary: false }, { url: 'https://cdn/3.jpg', primary: false }],
        grade: async (url) => { calls++; return url.endsWith('hero.jpg') ? grade('exterior_front', 72) : grade('kitchen', 90) },
      }),
    )
    expect(pick.url).toBe('https://cdn/hero.jpg')
    expect(pick.source).toBe('hero')
    expect(calls).toBe(1)
  })

  it('a kitchen hero is replaced by the front exterior from the feed', async () => {
    const pick = await pickCoverPhoto(
      { listingKey: 'K', heroUrl: 'https://cdn/kitchen.jpg' },
      deps({
        fetchPhotos: async () => [{ url: 'https://cdn/front.jpg', primary: true }, { url: 'https://cdn/rear.jpg', primary: false }],
        grades: { 'https://cdn/kitchen.jpg': grade('kitchen', 90), 'https://cdn/front.jpg': grade('exterior_front', 61) },
      }),
    )
    expect(pick.url).toBe('https://cdn/front.jpg')
    expect(pick.source).toBe('graded')
    expect(pick.reason).toContain('chosen over the MLS hero')
  })

  it('an aerial beats a rear view when no front exists; a clean exterior beats an overlaid one', async () => {
    const pick = await pickCoverPhoto(
      { listingKey: 'K', heroUrl: 'https://cdn/a.jpg' },
      deps({
        fetchPhotos: async () => [{ url: 'https://cdn/b.jpg', primary: false }, { url: 'https://cdn/c.jpg', primary: false }],
        grades: {
          'https://cdn/a.jpg': grade('exterior_rear', 80),
          'https://cdn/b.jpg': grade('aerial', 60),
          'https://cdn/c.jpg': grade('exterior_front', 95, true),
        },
      }),
    )
    expect(pick.url).toBe('https://cdn/b.jpg')
  })

  it('no usable exterior at all → the brand hero, and says why', async () => {
    const pick = await pickCoverPhoto(
      { listingKey: 'K', heroUrl: 'https://cdn/k.jpg' },
      deps({ grades: { 'https://cdn/k.jpg': grade('kitchen', 50) } }),
    )
    expect(pick.url).toBe(BRAND_HERO)
    expect(pick.source).toBe('brand')
    expect(pick.reason).toContain('kitchen')
  })

  it('fails open: no vision pass, no key, or every grade failing keeps the MLS hero', async () => {
    const off = await pickCoverPhoto({ listingKey: 'K', heroUrl: 'https://cdn/h.jpg' }, deps({ enabled: () => false }))
    expect(off).toMatchObject({ url: 'https://cdn/h.jpg', source: 'hero', costUsd: 0 })
    const noKey = await pickCoverPhoto({ listingKey: null, heroUrl: 'https://cdn/h.jpg' }, deps({ grade: async () => null }))
    expect(noKey.url).toBe('https://cdn/h.jpg')
    const nothing = await pickCoverPhoto({ listingKey: null, heroUrl: null }, deps({}))
    expect(nothing.url).toBeNull()
  })

  it('grades at most MAX_GRADES photos', async () => {
    let calls = 0
    await pickCoverPhoto(
      { listingKey: 'K', heroUrl: null },
      deps({
        fetchPhotos: async () => Array.from({ length: 20 }, (_, i) => ({ url: `https://cdn/${i}.jpg`, primary: false })),
        grade: async () => { calls++; return grade('kitchen', 40) },
      }),
    )
    expect(calls).toBe(MAX_GRADES)
  })
})

describe('pickCoverPhoto — the home before the brand', () => {
  it("2465 NE 7th: the only exterior is an overlaid aerial, and it is still the seller's home", async () => {
    const pick = await pickCoverPhoto(
      { listingKey: 'K', heroUrl: 'https://cdn/aerial.jpg' },
      deps({ grades: { 'https://cdn/aerial.jpg': grade('aerial', 58, true) } }),
    )
    expect(pick.url).toBe('https://cdn/aerial.jpg')
    expect(pick.source).toBe('hero')
  })
})
