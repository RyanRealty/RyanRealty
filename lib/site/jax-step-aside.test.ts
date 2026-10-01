import { describe, expect, it } from 'vitest'
import { jaxStepAside } from './jax-step-aside'

// 375x812: the disc rests at the right edge, halfway down (V3DogFloater.css:
// top 50%, right 1rem, 4.25rem wide).
const DISC = { top: 372, bottom: 440, left: 291, right: 359 }
const H = 812

describe('jaxStepAside', () => {
  it('stays put when no photograph is under the disc', () => {
    expect(jaxStepAside(DISC, [], H)).toBe(0)
    expect(jaxStepAside(DISC, [{ top: 100, bottom: 300, left: 20, right: 355 }], H)).toBe(0)
    // A photograph left of his lane never moves him.
    expect(jaxStepAside(DISC, [{ top: 300, bottom: 500, left: 20, right: 200 }], H)).toBe(0)
  })

  it('stands just under a photograph whose lower corner he covers (the lease dial at 375)', () => {
    // The Bend lease dial's photograph: x 20..355, y 158..410.
    const dy = jaxStepAside(DISC, [{ top: 158, bottom: 410, left: 20, right: 355 }], H)
    expect(dy).toBe(410 + 8 - 372)
  })

  it('stands just over a photograph whose upper corner he covers', () => {
    const dy = jaxStepAside(DISC, [{ top: 420, bottom: 672, left: 20, right: 355 }], H)
    expect(dy).toBe(420 - 8 - 440)
  })

  it('takes the shorter way past a photograph that covers his whole lane', () => {
    // 200..640: over the photograph is 172+8+... shorter than under it.
    const dy = jaxStepAside(DISC, [{ top: 200, bottom: 640, left: 20, right: 355 }], H)
    expect(dy).toBe(200 - 8 - 440)
  })

  it('never leaves the screen and never lands on a second photograph', () => {
    // Under the first photograph is the second one; over it is off the top margin.
    const photos = [
      { top: 60, bottom: 410, left: 20, right: 355 },
      { top: 430, bottom: 700, left: 20, right: 355 },
    ]
    expect(jaxStepAside(DISC, photos, H)).toBe(0)
  })
})
