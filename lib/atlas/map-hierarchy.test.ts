import { describe, expect, it } from 'vitest'
import {
  FIRST_LOOK_PHOTO_CAP,
  foldChildRegions,
  foldSubjectRegions,
  hierarchyPaint,
  photoCardsFromOpening,
  SUBJECT_FRAME_PAD,
  subjectAsTown,
} from './map-hierarchy'

const SUBJECT = {
  id: 'neighborhood:old-bend',
  kind: 'town' as const,
  name: 'Old Bend',
  href: '/cities/bend/old-bend',
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [-121.32, 44.05],
        [-121.3, 44.05],
        [-121.3, 44.06],
        [-121.32, 44.06],
        [-121.32, 44.05],
      ],
    ],
  },
}

const CHILD = {
  id: 'subdivision:park-addition',
  kind: 'neighborhood' as const,
  name: 'Park Addition',
  href: '/subdivisions/park-addition',
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [-121.31, 44.052],
        [-121.305, 44.052],
        [-121.305, 44.055],
        [-121.31, 44.055],
        [-121.31, 44.052],
      ],
    ],
  },
}

describe('map hierarchy lock', () => {
  it('keeps only the subject outline on the fold', () => {
    expect(foldSubjectRegions([SUBJECT, CHILD])).toEqual([SUBJECT])
    expect(foldChildRegions([SUBJECT, CHILD])).toEqual([CHILD])
  })

  it('zooms a selected child until that ring is the frame', () => {
    const rest = hierarchyPaint({ subject: [SUBJECT], children: [CHILD] })
    expect(rest.regions).toEqual([SUBJECT])
    expect(rest.frame).toEqual(SUBJECT.geometry)
    expect(rest.framePad).toBe(SUBJECT_FRAME_PAD)

    const zoomed = hierarchyPaint({
      subject: [SUBJECT],
      children: [CHILD],
      selectedChildId: CHILD.id,
    })
    expect(zoomed.regions).toEqual([subjectAsTown(CHILD)])
    expect(zoomed.frame).toEqual(CHILD.geometry)
    expect(zoomed.framePad).toBe(SUBJECT_FRAME_PAD)
  })

  it('builds first-look photo cards from opening listings, houses first, cap 6', () => {
    const cards = photoCardsFromOpening([
      {
        key: 'condo',
        listings: [{ href: '/c', photoSrc: '/c.jpg', title: 'Condo', price: '$400K' }],
      },
      {
        key: 'houses',
        listings: Array.from({ length: 8 }, (_, i) => ({
          href: `/h${i}`,
          photoSrc: `/h${i}.jpg`,
          title: `${i} Main`,
          price: `$${i}00K`,
        })),
      },
    ])
    expect(cards).toHaveLength(FIRST_LOOK_PHOTO_CAP)
    expect(cards[0]?.href).toBe('/h0')
    expect(cards.some((c) => c.href === '/c')).toBe(false)
  })
})
