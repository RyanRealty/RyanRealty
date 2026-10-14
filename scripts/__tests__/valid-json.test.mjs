import { describe, expect, it } from 'vitest'
import { parseValidJson, retryUntilValidJson } from '../lib/valid-json.mjs'

describe('parseValidJson', () => {
  it('accepts a GitHub artifacts list', () => {
    const parsed = parseValidJson('{"artifacts":[{"name":"next-build","id":1}]}')
    expect(parsed.ok).toBe(true)
    expect(parsed.value.artifacts[0].name).toBe('next-build')
  })

  it('rejects empty and truncated replies that throw unexpected end of JSON input', () => {
    expect(parseValidJson('').ok).toBe(false)
    expect(parseValidJson('   ').reason).toBe('empty')
    const cut = parseValidJson('{"artifacts":')
    expect(cut.ok).toBe(false)
    expect(cut.reason).toMatch(/JSON|end of/i)
  })
})

describe('retryUntilValidJson', () => {
  it('retries until the reply is valid JSON, then stops', async () => {
    const replies = ['', '{"artifacts":', '{"artifacts":[{"name":"next-build","id":9}]}']
    const result = await retryUntilValidJson((i) => replies[i - 1], { tries: 5 })
    expect(result.ok).toBe(true)
    expect(result.tries).toBe(3)
    expect(result.value.artifacts[0].id).toBe(9)
  })

  it('stops after the bounded number of tries', async () => {
    const result = await retryUntilValidJson(() => '', { tries: 4 })
    expect(result.ok).toBe(false)
    expect(result.tries).toBe(4)
    expect(result.reason).toBe('empty')
  })
})
