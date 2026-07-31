import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Source contract: archived documents stay out of the admin CMA queue.
 *
 * Found 2026-07-30 by walking the admin surface as a user, not by any test.
 * listCmasForAdmin had no archived filter, so seven "1 Test Way, Bend"
 * integration-test rows sat in the real CMA queue with five stamped delivered.
 * The KPI cards above the queue read Total 38 / Delivered 6 / Sent 7; the truth
 * was 25 / 1 / 2.
 *
 * Archiving sets the archived_at TIMESTAMP. `status` is a separate axis, and the
 * page's own "Archived" filter matches on status — which is exactly why filtering
 * on status alone looked correct and was not.
 */
const SRC = readFileSync(join(process.cwd(), 'lib/data/sync/syncWrites.ts'), 'utf8')

function bodyOf(fnName: string): string {
  const start = SRC.indexOf(`export async function ${fnName}`)
  expect(start, `${fnName} not found`).toBeGreaterThan(-1)
  // Far enough to cover the query, short enough not to bleed into the next fn.
  return SRC.slice(start, start + 1800)
}

describe('CMA admin queue and counts exclude archived documents', () => {
  it('listCmasForAdmin filters on archived_at', () => {
    expect(bodyOf('listCmasForAdmin')).toMatch(/\.is\(\s*'archived_at'\s*,\s*null\s*\)/)
  })

  it('countCmasInRange filters on archived_at — it feeds analytics', () => {
    expect(bodyOf('countCmasInRange')).toMatch(/\.is\(\s*'archived_at'\s*,\s*null\s*\)/)
  })
})
