import { describe, it, expect } from 'vitest'
import { countLoc, countExports } from '../check-file-size-budget.mjs'

describe('countLoc', () => {
  it('counts lines', () => {
    expect(countLoc('a\nb\nc')).toBe(3)
    expect(countLoc('one line')).toBe(1)
  })
})

describe('countExports', () => {
  it('counts export statements at line starts', () => {
    const src = `
import x from 'y'
export { a, b } from './a'
export * from './b'
export type { T } from './t'
  export const c = 1
const notExported = 2
`
    expect(countExports(src)).toBe(4)
  })

  it('does not count the word export mid-line', () => {
    expect(countExports(`const s = 'export this'`)).toBe(0)
  })
})
