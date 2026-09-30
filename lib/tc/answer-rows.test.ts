import { describe, expect, it } from 'vitest'
import { groupAnswerRows } from './answer-rows'
import type { PageTextRun } from './lined-signature-fields'
import type { MappedField } from './skyslope-field-map'

// Geometry and words from the OREF 020 01/2026 blank: 10 pt boxes, each answer's word just right of its box.
const box = (x: number, y: number, page = 2): MappedField => ({
  type: 'checkbox',
  page,
  x,
  y,
  w: 0.014,
  h: 0.0107,
  dataRef: `Check Box ${x}`,
  signerRole: null,
  optional: false,
  label: `Check Box ${x}`,
})
const run = (str: string, x: number, y: number): PageTextRun => ({ str, x, y, w: str.length * 0.0064 })
const onPage2 = (runs: PageTextRun[]) => [[], runs]
const ANSWERS = [0.707, 0.76, 0.808]
const question = (text: string, y: number, words = ['Yes', 'No', 'Unknown']) => [
  run('60', 0.044, y),
  run(`${text} ........................`, 0.104, y),
  ...words.map((w, i) => run(w, ANSWERS[i]! + 0.019, y)),
]

describe('groupAnswerRows', () => {
  it('makes a Yes / No / Unknown question one choice, exactly one where the form says to answer every question', () => {
    const map = ANSWERS.map((x) => box(x, 0.6314))
    const page = onPage2(question('A. Do you have legal authority to sell the Property?', 0.64))
    const strict = groupAnswerRows(map, page, { answerEveryQuestion: true })
    expect(new Set(strict.map((f) => f.group?.key)).size).toBe(1)
    expect(strict[0]!.group).toMatchObject({ min: 1, max: 1 })
    expect(strict[0]!.prompt).toBe('A. Do you have legal authority to sell the Property?')
    // Two answers to one question are never right; skipping one is the broker's call.
    expect(groupAnswerRows(map, page)[0]!.group).toMatchObject({ min: null, max: 1 })
  })

  it('reads an answer word the page text splits in pieces ("U" "nknown")', () => {
    const map = [...ANSWERS, 0.886].map((x) => box(x, 0.6046))
    const y = 0.6153
    const page = onPage2([run('E. Built-in range and oven', 0.104, y), run('Yes', 0.726, y), run('No', 0.781, y), run('U', 0.827, y), { str: 'nknown', x: 0.827 + 0.0064, y, w: 0.04 }, run('N/A', 0.905, y)])
    const out = groupAnswerRows(map, page, { answerEveryQuestion: true })
    expect(out.every((f) => f.group?.key === out[0]!.group?.key && f.group?.min === 1)).toBe(true)
  })

  it('makes "Seller [] is [] is not occupying the Property" one choice', () => {
    const map = [box(0.199, 0.4496), box(0.232, 0.4497)]
    const y = 0.4596
    const out = groupAnswerRows(map, onPage2([run('Seller (select one)', 0.088, y), run('is', 0.218, y), run('is not occupying the Property.', 0.251, y)]), { answerEveryQuestion: true })
    expect(out[0]!.group).toMatchObject({ min: 1, max: 1 })
    expect(out[1]!.group?.key).toBe(out[0]!.group?.key)
  })

  it('makes a row that says "select only one" at most one', () => {
    const xs = [0.406, 0.479, 0.644, 0.711, 0.822]
    const words = ['receiver', 'personal representative,', 'trustee,', 'conservator', 'guardian.']
    const y = 0.5475
    const out = groupAnswerRows(
      xs.map((x) => box(x, 0.5368, 1)),
      [[run('Seller is a court appointed (select only one)', 0.15, y), ...words.map((w, i) => run(w, xs[i]! + 0.019, y))]],
    )
    expect(out.every((f) => f.group?.key === out[0]!.group?.key)).toBe(true)
    expect(out[0]!.group).toMatchObject({ min: null, max: 1 })
  })

  it('leaves a list of options free ("subject to any of the following? [] First right of refusal [] Option ...")', () => {
    const xs = [0.119, 0.255, 0.318]
    const y = 0.6795
    const out = groupAnswerRows(xs.map((x) => box(x, 0.6693)), onPage2([run('First right of refusal', 0.138, y), run('Option', 0.274, y), run('Lease or rental agreement', 0.337, y)]))
    expect(out.every((f) => !f.group)).toBe(true)
  })

  it('groups only the answers on a line that also carries option boxes, and prompts with the whole question', () => {
    const y = 0.6232
    const map = [box(0.221, 0.6126), box(0.328, 0.6126), ...ANSWERS.map((x) => box(x, 0.6126))]
    const page = onPage2([
      run('(1) Are there any', 0.104, y),
      run('water rights or', 0.24, y),
      run('other irrigation rights for the Property? ......', 0.347, y),
      ...['Yes', 'No', 'Unknown'].map((w, i) => run(w, ANSWERS[i]! + 0.019, y)),
    ])
    const out = groupAnswerRows(map, page, { answerEveryQuestion: true })
    expect(out.slice(0, 2).every((f) => !f.group)).toBe(true)
    expect(out.slice(2).every((f) => f.group?.min === 1)).toBe(true)
    expect(out[2]!.prompt).toBe('(1) Are there any water rights or other irrigation rights for the Property?')
  })

  it('makes two questions side by side two groups', () => {
    const y = 0.51
    const xs = [0.3, 0.36, 0.7, 0.76]
    const page = onPage2([run('Pool?', 0.1, y), run('Yes', 0.319, y), run('No', 0.379, y), run('Spa?', 0.5, y), run('Yes', 0.719, y), run('No', 0.779, y)])
    const out = groupAnswerRows(xs.map((x) => box(x, 0.5)), page)
    expect(out[0]!.group?.key).toBe(out[1]!.group?.key)
    expect(out[2]!.group?.key).toBe(out[3]!.group?.key)
    expect(out[0]!.group?.key).not.toBe(out[2]!.group?.key)
    expect(out[2]!.prompt).toBe('Spa?')
  })

  it('prompts a question printed over two lines with both, and an item of its own with its own line', () => {
    const map = [...ANSWERS.map((x) => box(x, 0.7294)), ...ANSWERS.map((x) => box(x, 0.3897))]
    const page = onPage2([
      run('D. *Are there any encroachments, boundary agreements, boundary disputes or', 0.104, 0.7225),
      ...question('recent boundary changes?', 0.74),
      run('If yes, do you have a permit?', 0.14, 0.387),
      ...question('b. Is the water source located on the Property?', 0.4),
    ])
    const out = groupAnswerRows(map, page)
    expect(out[0]!.prompt).toBe('D. *Are there any encroachments, boundary agreements, boundary disputes or recent boundary changes?')
    expect(out[3]!.prompt).toBe('b. Is the water source located on the Property?')
  })
})
