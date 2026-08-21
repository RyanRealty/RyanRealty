import { describe, expect, it } from 'vitest'
import { buildCommDGroundTiles } from './comm-d-ground'

describe('comm-d ground tiles', () => {
  it('prints architect, acres, and founded from authored facts', () => {
    const tiles = buildCommDGroundTiles({
      heroPhoto: '/lp/tetherow/img/tetherow-aerial-course.jpg',
      courseImage: '/lp/tetherow/img/tetherow-course-118.jpg',
      signatureHoleImage: '/lp/tetherow/img/tetherow-course-284.jpg',
      architect: 'David McLay Kidd',
      acres: 700,
      founded: 2008,
    })
    expect(tiles).toHaveLength(3)
    expect(tiles[0]).toMatchObject({ kicker: 'The course', title: 'David McLay Kidd' })
    expect(tiles[1]).toMatchObject({ kicker: 'The land', title: '700 acres' })
    expect(tiles[2]).toMatchObject({ kicker: 'Opened', title: '2008' })
    expect(new Set(tiles.map((t) => t.img)).size).toBe(3)
  })

  it('does not invent restaurants, HOA dollars, or routes', () => {
    const tiles = buildCommDGroundTiles({
      heroPhoto: '/images/kb/tetherow-golf-aerial.jpg',
      architect: 'David McLay Kidd',
      acres: 700,
      founded: 2008,
    })
    const blob = JSON.stringify(tiles)
    expect(blob).not.toMatch(/Coorie|The Row|restaurant|Dinner/i)
    expect(blob).not.toMatch(/1,?464|HOA/i)
    expect(blob).not.toMatch(/Old Mill|Mt\. Bachelor|7min|drive/i)
  })

  it('hides when no authored facts exist', () => {
    expect(
      buildCommDGroundTiles({
        heroPhoto: '/images/kb/broken-top.jpg',
      }),
    ).toEqual([])
  })
})
