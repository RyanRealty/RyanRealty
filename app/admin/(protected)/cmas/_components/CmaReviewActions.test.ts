import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'CmaReviewActions.tsx'), 'utf8')

describe('CmaReviewActions', () => {
  it('keeps Approve as the only primary and folds archive/delete under Remove', () => {
    expect(src).toContain('className="cma-send-dock')
    expect(src).toContain('EmailBodyEditor')
    expect(src).toContain('Outbound email')
    expect(src).toMatch(/<details>[\s\S]*Remove[\s\S]*Archive CMA[\s\S]*Delete CMA/)
    expect(src).not.toMatch(/borderTop: '1px solid var\(--a-border\)'/)
  })

  it('passes edited subject/body into approveAndDeliverCma', () => {
    expect(src).toContain('approveAndDeliverCma(')
    expect(src).toContain('edited ? { subject, bodyText }')
  })
})
