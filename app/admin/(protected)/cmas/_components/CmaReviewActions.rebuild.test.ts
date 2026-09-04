import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const review = readFileSync(resolve('app/admin/(protected)/cmas/_components/CmaReviewActions.tsx'), 'utf8')
const page = readFileSync(resolve('app/admin/(protected)/cmas/[slug]/page.tsx'), 'utf8')
const action = readFileSync(resolve('app/actions/cma-admin.ts'), 'utf8')

describe('CMA rebuild stamp + pending (Rim View)', () => {
  it('Save Working… is rebuildPending only, not shared isPending', () => {
    expect(review).toMatch(/const \[rebuildPending, setRebuildPending\] = useState\(false\)/)
    expect(review).toMatch(/\{rebuildPending \? 'Working…' : 'Save and rebuild'\}/)
    expect(review).not.toMatch(/\{isPending \? 'Working…' : 'Save and rebuild'\}/)
  })

  it('client fail-loud when error null but builtAt unchanged', () => {
    expect(review).toMatch(/const preBuiltAt = props\.builtAt/)
    expect(review).toMatch(/data\?\.builtAt/)
    expect(review).toMatch(/toast\.error\('Rebuild did not update built_at'\)/)
  })

  it('admin built label uses formatDateTime (LA clock), not day-only formatDate', () => {
    expect(page).toMatch(/formatDateTime/)
    expect(page).toMatch(/built \$\{formatDateTime/)
    expect(page).not.toMatch(/built \$\{formatDate\(/)
  })

  it('rebuildCmaAction stamps build_started_at before buildCma and returns builtAt', () => {
    const fnStart = action.indexOf('export async function rebuildCmaAction')
    expect(fnStart).toBeGreaterThan(-1)
    const body = action.slice(fnStart, action.indexOf('export async function approveCmaAction', fnStart))
    expect(body).toMatch(/build_started_at: startedAt/)
    expect(body).toMatch(/builtAt/)
    const startIdx = body.indexOf('build_started_at: startedAt')
    const buildIdx = body.indexOf('await buildCma(')
    expect(startIdx).toBeGreaterThan(-1)
    expect(buildIdx).toBeGreaterThan(startIdx)
  })
})
