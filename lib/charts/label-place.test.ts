import { describe, expect, it } from 'vitest'
import { boxesTouch, placeLabels, strokeBox, textBox, type LabelBox } from '@/lib/charts/label-place'

const FRAME: LabelBox = { x0: 0, y0: 0, x1: 200, y1: 100 }
const box = (x0: number, y0: number, x1: number, y1: number): LabelBox => ({ x0, y0, x1, y1 })
const at = (b: LabelBox, cost: number, value: string) => ({ boxes: [b], cost, value })

describe('placeLabels', () => {
  it('keeps every label where it belongs when nothing is in the way', () => {
    const placed = placeLabels({
      labels: [
        { id: 'a', dropCost: 100, candidates: [at(box(10, 10, 40, 20), 0, 'a-home')] },
        { id: 'b', dropCost: 100, candidates: [at(box(60, 10, 90, 20), 0, 'b-home')] },
      ],
      obstacles: [],
      frame: FRAME,
    })
    expect(placed.get('a')?.value).toBe('a-home')
    expect(placed.get('b')?.value).toBe('b-home')
  })

  it('moves a label off another label before it drops one', () => {
    // 915 Saginaw's shape: the last ask and the end label want the same corner.
    const placed = placeLabels({
      labels: [
        { id: 'end', dropCost: 1000, candidates: [at(box(100, 50, 190, 60), 0, 'end-above')] },
        {
          id: 'ask',
          dropCost: 400,
          candidates: [at(box(120, 52, 150, 62), 0, 'ask-right'), at(box(60, 52, 90, 62), 4, 'ask-left')],
        },
      ],
      obstacles: [],
      frame: FRAME,
    })
    expect(placed.get('end')?.value).toBe('end-above')
    expect(placed.get('ask')?.value).toBe('ask-left')
  })

  it('never puts a label on a line, and drops the lesser label when nothing is clear', () => {
    const line = strokeBox(0, 55, 200, 55, 1.25)
    const placed = placeLabels({
      labels: [
        { id: 'big', dropCost: 1000, candidates: [at(box(20, 40, 80, 50), 0, 'big-home')] },
        {
          id: 'small',
          dropCost: 50,
          // Its only places cross the line or sit on the big label.
          candidates: [at(box(30, 50, 60, 60), 0, 'on-line'), at(box(25, 42, 70, 49), 1, 'on-big')],
        },
      ],
      obstacles: [line],
      frame: FRAME,
    })
    expect(placed.get('big')?.value).toBe('big-home')
    expect(placed.get('small')).toBeNull()
  })

  it('keeps a label inside the frame and clear of it by the gap', () => {
    const placed = placeLabels({
      labels: [
        {
          id: 'a',
          dropCost: 100,
          candidates: [at(box(180, 10, 230, 20), 0, 'off-frame'), at(box(100, 10, 150, 20), 1, 'inside')],
        },
      ],
      obstacles: [box(151, 0, 160, 100)],
      frame: FRAME,
      gap: 0.5,
    })
    expect(placed.get('a')?.value).toBe('inside')
  })

  it('finds the cheapest joint answer, not the greedy one', () => {
    // Greedy puts A at 0 and leaves B only its costly place; moving A by 1
    // frees B's home, for a lower total.
    const placed = placeLabels({
      labels: [
        { id: 'A', dropCost: 100, candidates: [at(box(0, 0, 50, 10), 0, 'A0'), at(box(0, 20, 50, 30), 1, 'A1')] },
        { id: 'B', dropCost: 100, candidates: [at(box(10, 0, 60, 10), 0, 'B0'), at(box(10, 60, 60, 70), 5, 'B5')] },
      ],
      obstacles: [],
      frame: FRAME,
    })
    expect(placed.get('A')?.value).toBe('A1')
    expect(placed.get('B')?.value).toBe('B0')
  })
})

describe('textBox and boxesTouch', () => {
  it('anchors a line of text the way SVG does', () => {
    expect(textBox({ x: 100, baseline: 50, width: 40, fontSize: 10, anchor: 'end' })).toMatchObject({ x0: 60, x1: 100 })
    expect(textBox({ x: 100, baseline: 50, width: 40, fontSize: 10, anchor: 'middle' })).toMatchObject({ x0: 80, x1: 120 })
    const b = textBox({ x: 0, baseline: 50, width: 10, fontSize: 10, anchor: 'start', ascent: 0.9, descent: 0.3 })
    expect(b.y0).toBeCloseTo(41)
    expect(b.y1).toBeCloseTo(53)
  })

  it('counts boxes closer than the gap as touching', () => {
    expect(boxesTouch(box(0, 0, 10, 10), box(11, 0, 20, 10))).toBe(false)
    expect(boxesTouch(box(0, 0, 10, 10), box(11, 0, 20, 10), 2)).toBe(true)
  })
})
