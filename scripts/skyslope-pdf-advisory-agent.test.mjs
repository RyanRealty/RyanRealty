import { describe, expect, it } from 'vitest'
import { extractFirstJsonObject } from './skyslope-pdf-advisory-agent.mjs'

describe('extractFirstJsonObject', () => {
  it('parses fenced json', () => {
    const raw = 'Here\n```json\n{"review_notes":"x","confidence":0.2}\n```'
    const j = extractFirstJsonObject(raw)
    expect(JSON.parse(j)).toMatchObject({ review_notes: 'x', confidence: 0.2 })
  })

  it('parses first balanced object', () => {
    const raw = 'prefix {"a":[1,2],"b":{"c":3}} tail'
    const j = extractFirstJsonObject(raw)
    expect(JSON.parse(j)).toEqual({ a: [1, 2], b: { c: 3 } })
  })
})
