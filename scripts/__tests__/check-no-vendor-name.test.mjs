import { describe, it, expect } from 'vitest'
import {
  VENDOR_WORD,
  isThirdPartyDataPath,
  isPermittedApiToken,
  findLineViolations,
  findFileViolations,
} from '../check-no-vendor-name.mjs'

// Every fixture below builds the forbidden word from VENDOR_WORD (exported by
// the module under test) rather than spelling it, so this test file never
// carries the name either.
const capitalized = VENDOR_WORD[0].toUpperCase() + VENDOR_WORD.slice(1)
const apiToken = 'send' + capitalized

describe('isThirdPartyDataPath', () => {
  it('allows the two named third-party data paths', () => {
    expect(isThirdPartyDataPath('data/search-metadata/spark-metadata.snapshot.json')).toBe(true)
    expect(isThirdPartyDataPath('docs/research/cma-backtest-2026-08-05.json')).toBe(true)
  })

  it('does not allow other paths, including a nested docs/research file', () => {
    expect(isThirdPartyDataPath('docs/plans/whatever.md')).toBe(false)
    expect(isThirdPartyDataPath('docs/research/nested/whatever.json')).toBe(false)
    expect(isThirdPartyDataPath('data/search-metadata/other.json')).toBe(false)
  })
})

describe('isPermittedApiToken', () => {
  it('recognizes the sendBeacon token', () => {
    const line = `navigator.${apiToken}(url, body)`
    const index = line.indexOf(capitalized)
    expect(isPermittedApiToken(line, index)).toBe(true)
  })

  it('does not exempt a bare mention of the word', () => {
    const line = `the ${VENDOR_WORD} appraisal group`
    const index = line.indexOf(VENDOR_WORD)
    expect(isPermittedApiToken(line, index)).toBe(false)
  })
})

describe('findLineViolations', () => {
  it('flags a bare mention', () => {
    expect(findLineViolations(`${VENDOR_WORD} appraisal group`)).toEqual([1])
  })

  it('flags a bare mention case-insensitively', () => {
    expect(findLineViolations(`${capitalized} report`)).toEqual([1])
  })

  it('does not flag the sendBeacon API token', () => {
    expect(findLineViolations(`navigator.${apiToken}(url, body)`)).toEqual([])
    expect(findLineViolations(`if (navigator.${apiToken}) { ${apiToken}('/x', b) }`)).toEqual([])
  })

  it('still flags a bare mention on the same line as the API token', () => {
    const line = `uses ${apiToken} like a real ${VENDOR_WORD} would`
    expect(findLineViolations(line)).toHaveLength(1)
  })

  it('passes a clean line', () => {
    expect(findLineViolations('no vendor word here at all')).toEqual([])
  })
})

describe('findFileViolations', () => {
  it('skips third-party data files entirely, even with a bare mention', () => {
    const content = `{"name": "${capitalized} Heights Subdivision"}`
    expect(findFileViolations('data/search-metadata/spark-metadata.snapshot.json', content)).toEqual([])
    expect(findFileViolations('docs/research/anything.json', content)).toEqual([])
  })

  it('reports file/line/col for a normal tracked file', () => {
    const content = `line one\nsome ${VENDOR_WORD} mention\nline three`
    const hits = findFileViolations('docs/example.md', content)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ file: 'docs/example.md', line: 2 })
  })

  it('does not report the permitted sendBeacon usage', () => {
    const content = `navigator.${apiToken}('/api/x', body)`
    expect(findFileViolations('components/Example.tsx', content)).toEqual([])
  })
})
