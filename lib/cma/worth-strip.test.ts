/**
 * The strip's two axis labels are the two numbers the chapter states as worth,
 * and the two marks under it never print through each other (tasteReview round
 * three, §2 item 3).
 */
import { describe, expect, it } from 'vitest'
import { WORTH_STRIP_WIDE, worthStripSvg } from '@/lib/cma/worth-strip'

/** 19968's shape: the range is $331K–$479K, the outer dots are $322K/$480K. */
const sales = [
  { n: 1, address: '1 A', adjustedPrice: 322_000 },
  { n: 2, address: '2 B', adjustedPrice: 355_000 },
  { n: 3, address: '3 C', adjustedPrice: 402_000 },
  { n: 4, address: '4 D', adjustedPrice: 455_000 },
  { n: 5, address: '5 E', adjustedPrice: 480_000 },
]

function labels(svg: string): string[] {
  return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!)
}

describe('the worth strip', () => {
  it('labels the axis with the stated range, never the outer dots', () => {
    const svg = worthStripSvg({
      sales,
      rangeLow: 331_000,
      rangeHigh: 479_000,
      recommended: 435_000,
      lastAsk: null,
    })
    const text = labels(svg)
    expect(text).toContain('$331K')
    expect(text).toContain('$479K')
    expect(text).not.toContain('$322K')
    expect(text).not.toContain('$480K')
  })

  it('drops the second mark label a line when the two would collide', () => {
    // Concorde: list $1.47M and asked $1.50M, 2 percent apart on a 39 percent
    // axis — the one mark that carries the recommendation was illegible.
    const svg = worthStripSvg({
      sales: [
        { n: 1, address: '1 A', adjustedPrice: 1_390_000 },
        { n: 2, address: '2 B', adjustedPrice: 1_460_000 },
        { n: 3, address: '3 C', adjustedPrice: 1_600_000 },
        { n: 4, address: '4 D', adjustedPrice: 1_930_000 },
      ],
      rangeLow: 1_390_000,
      rangeHigh: 1_930_000,
      recommended: 1_473_000,
      lastAsk: 1_500_000,
    })
    const list = /<text x="([\d.]+)" y="([\d.]+)"[^>]*>list \$1\.47M<\/text>/.exec(svg)
    const asked = /<text x="([\d.]+)" y="([\d.]+)"[^>]*>asked \$1\.50M<\/text>/.exec(svg)
    expect(list).not.toBeNull()
    expect(asked).not.toBeNull()
    expect(Number(asked![2])).toBeGreaterThan(Number(list![2]) + WORTH_STRIP_WIDE.fontSize)
  })

  it('keeps both mark labels on one line when there is room', () => {
    const svg = worthStripSvg({
      sales,
      rangeLow: 331_000,
      rangeHigh: 479_000,
      recommended: 350_000,
      lastAsk: 470_000,
    })
    const list = /<text x="[\d.]+" y="([\d.]+)"[^>]*>list \$350K<\/text>/.exec(svg)
    const asked = /<text x="[\d.]+" y="([\d.]+)"[^>]*>asked \$470K<\/text>/.exec(svg)
    expect(list).not.toBeNull()
    expect(asked).not.toBeNull()
    expect(asked![1]).toBe(list![1])
  })

  it('pushes the two range labels outward rather than through each other', () => {
    const svg = worthStripSvg({
      // A tight range on a wide axis: the two labels would print through
      // each other at the same x.
      sales: [
        { n: 1, address: '1 A', adjustedPrice: 300_000 },
        { n: 2, address: '2 B', adjustedPrice: 400_000 },
        { n: 3, address: '3 C', adjustedPrice: 500_000 },
      ],
      rangeLow: 399_000,
      rangeHigh: 401_000,
      recommended: 400_000,
      lastAsk: null,
    })
    const anchors = [...svg.matchAll(/<text x="[\d.]+" y="[\d.]+" text-anchor="(\w+)"[^>]*>\$\d/g)].map(
      (m) => m[1],
    )
    expect(anchors).toContain('end')
    expect(anchors).toContain('start')
  })
})
