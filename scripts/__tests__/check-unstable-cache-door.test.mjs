import { describe, it, expect, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DOOR, audit, checkDoor, inScope, scanSource } from '../check-unstable-cache-door.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const DOOR_SOURCE = `
import { unstable_cache as nextUnstableCache } from 'next/cache'
export const unstable_cache: typeof nextUnstableCache = (cb, keyParts, options) => {
  const cached = nextUnstableCache(cb, keyParts, options)
  return (async (...args) => {
    const value = await cached(...args)
    return value !== undefined ? value : cb(...args)
  }) as typeof cb
}
`

const sandboxes = []
function sandbox(files) {
  const root = mkdtempSync(join(tmpdir(), 'unstable-cache-door-'))
  sandboxes.push(root)
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, body, 'utf8')
  }
  return { root, files: Object.keys(files) }
}
afterAll(() => {
  for (const root of sandboxes) rmSync(root, { recursive: true, force: true })
})

describe('R1: no runtime import of unstable_cache from next/cache', () => {
  it('FIRES on the named import every DAL file used before the door', () => {
    const v = scanSource('lib/data/x.ts', "import { unstable_cache } from 'next/cache'\nexport const getX = unstable_cache(async () => 1, ['x'])\n")
    expect(v).toEqual(["lib/data/x.ts:1 imports unstable_cache from 'next/cache'"])
  })

  it('FIRES on an aliased import beside another next/cache name', () => {
    const v = scanSource('app/actions/a.ts', 'import {\n  revalidatePath,\n  unstable_cache as cacheIt,\n} from "next/cache"\n')
    expect(v).toEqual(["app/actions/a.ts:3 imports unstable_cache from 'next/cache'"])
  })

  it('FIRES on a namespace import read as ns.unstable_cache', () => {
    const v = scanSource('lib/y.ts', "import * as nc from 'next/cache'\nexport const r = nc.unstable_cache(async () => 1, ['y'])\n")
    expect(v).toEqual(["lib/y.ts:2 reads nc.unstable_cache off a 'next/cache' namespace import"])
  })

  it('FIRES on a named re-export and on export *', () => {
    expect(scanSource('lib/z.ts', "export { unstable_cache } from 'next/cache'\n")).toEqual([
      "lib/z.ts:1 re-exports unstable_cache from 'next/cache'",
    ])
    expect(scanSource('lib/z.ts', "export * from 'next/cache'\n")).toEqual([
      "lib/z.ts:1 re-exports everything from 'next/cache', unstable_cache included",
    ])
  })

  it('FIRES on require and dynamic import of next/cache that read unstable_cache', () => {
    expect(scanSource('lib/r.js', "const { unstable_cache } = require('next/cache')\n")).toEqual([
      "lib/r.js loads 'next/cache' at runtime and reads unstable_cache from it",
    ])
    expect(scanSource('lib/d.ts', "export async function f() { const m = await import('next/cache'); return m.unstable_cache }\n")).toEqual([
      "lib/d.ts loads 'next/cache' at runtime and reads unstable_cache from it",
    ])
  })

  it('stays GREEN on the door import, other next/cache names, comments and strings', () => {
    expect(scanSource('lib/a.ts', "import { unstable_cache } from '@/lib/data/cache/next-cache'\n")).toEqual([])
    expect(scanSource('lib/b.ts', "import { revalidateTag, revalidatePath } from 'next/cache'\n")).toEqual([])
    expect(
      scanSource('lib/c.ts', "// import { unstable_cache } from 'next/cache'\nexport const doc = \"import { unstable_cache } from 'next/cache'\"\n"),
    ).toEqual([])
    expect(scanSource('lib/e.ts', "import * as nc from 'next/cache'\nexport const t = nc.revalidateTag\n")).toEqual([])
  })

  it('scopes to runtime source: scripts, tests, test helpers and the door are out', () => {
    expect(inScope('lib/data/listings/getListingTiles.ts')).toBe(true)
    expect(inScope('app/cities/[slug]/page.tsx')).toBe(true)
    expect(inScope(DOOR)).toBe(false)
    expect(inScope('lib/data/cache/next-cache.test.ts')).toBe(false)
    expect(inScope('scripts/perf-search-measure.mts')).toBe(false)
    expect(inScope('scripts/check-x.mjs')).toBe(false)
    expect(inScope('test/next-cache-cli-stub.ts')).toBe(false)
    expect(inScope('components/site/__tests__/x.ts')).toBe(false)
    expect(inScope('docs/DATA_ACCESS_LAYER.md')).toBe(false)
  })
})

describe('R2: the door is in place', () => {
  it('FIRES when the door is missing, stops importing Next, or stops exporting', () => {
    expect(checkDoor(null)).toEqual([`${DOOR} is missing: it is the one module allowed to wrap Next's unstable_cache`])
    expect(checkDoor('export const unstable_cache = (cb) => cb\n')).toEqual([`${DOOR} no longer imports Next's unstable_cache`])
    expect(checkDoor("import { unstable_cache as n } from 'next/cache'\nexport const other = n\n")).toEqual([
      `${DOOR} no longer exports unstable_cache`,
    ])
  })

  it('stays GREEN on the real door shape', () => {
    expect(checkDoor(DOOR_SOURCE)).toEqual([])
  })
})

describe('audit over a tree', () => {
  it('names the one bad file and lets the door, a test and a script keep the raw import', () => {
    const { root, files } = sandbox({
      [DOOR]: DOOR_SOURCE,
      'lib/data/cache/next-cache.test.ts': "import { unstable_cache } from 'next/cache'\n",
      'scripts/tool.mts': "import { unstable_cache } from 'next/cache'\n",
      'lib/data/good.ts': "import { unstable_cache } from '@/lib/data/cache/next-cache'\n",
      'lib/data/bad.ts': "import { unstable_cache } from 'next/cache'\n",
    })
    expect(audit(root, files)).toEqual(["lib/data/bad.ts:1 imports unstable_cache from 'next/cache'"])
  })

  it('fails a tree whose door was deleted', () => {
    const { root, files } = sandbox({ 'lib/data/good.ts': "import { unstable_cache } from '@/lib/data/cache/next-cache'\n" })
    expect(audit(root, files)).toEqual([`${DOOR} is missing: it is the one module allowed to wrap Next's unstable_cache`])
  })
})

describe('the live tree', () => {
  it('is green: every cached read in this repo comes through the door', () => {
    const run = spawnSync(process.execPath, ['scripts/check-unstable-cache-door.mjs'], { cwd: REPO, encoding: 'utf8' })
    expect(run.stderr).toBe('')
    expect(run.status).toBe(0)
  })
})
