import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

/**
 * Break-tests for ci:content-metadata (scripts/check-content-metadata.mjs).
 *
 * The bound the gate enforces is the DOCUMENT title, suffix included: a registry
 * detail page titles itself with the entity `name`, and app/layout.tsx then
 * appends " | Ryan Realty" (14 chars; 30 before 2026-10-04). The old bound was 48 on
 * the name alone and never counted those 31, so a "bounded" 48-char name still
 * composed a 79-char title (SITE-25). Parks were not checked at all.
 *
 * Each case materializes a disposable fixture tree and runs the REAL gate
 * against it via --root.
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(REPO, 'scripts/check-content-metadata.mjs')

// This suite can run inside a git hook, and git exports GIT_INDEX_FILE /
// GIT_DIR-family vars that redirect child tooling at the REAL repo. Strip every
// GIT_* before spawning (reference_git_fixture_env_leak.md).
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')))

const SANDBOX = join(tmpdir(), `rr-content-metadata-${process.pid}-${Math.random().toString(16).slice(2)}`)

const PAGES = [
  'app/parks/[slug]/page.tsx',
  'app/central-oregon/events/[slug]/page.tsx',
  'app/central-oregon/venues/[slug]/page.tsx',
  'app/central-oregon/golf/[slug]/page.tsx',
  'app/central-oregon/trails/[slug]/page.tsx',
]

function write(relPath, contents) {
  const dest = join(SANDBOX, relPath)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, contents)
}

/** A registry file in the shape the gate parses: a slug line, then a name line. */
function registry(rows) {
  const body = rows
    .map((r) => `  {\n    slug: '${r.slug}',\n    name: '${r.name}',\n${r.city ? `    city: '${r.city}',\n` : ''}  },`)
    .join('\n')
  return `export const ROWS = [\n${body}\n]\n`
}

function reset(overrides = {}) {
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(SANDBOX, { recursive: true })
  const defaults = {
    'data/co-parks.ts': registry([{ slug: 'sawyer-park', name: 'Sawyer Park' }]),
    'data/co-events.ts': registry([{ slug: 'munch-and-music', name: 'Munch & Music' }]),
    'data/co-venues.ts': registry([{ slug: 'tower-theatre', name: 'Tower Theatre' }]),
    'data/co-trails.ts': registry([{ slug: 'pilot-butte', name: 'Pilot Butte Summit' }]),
  }
  for (const [rel, contents] of Object.entries({ ...defaults, ...overrides })) write(rel, contents)
  for (const page of PAGES) write(page, 'export default function Page() {\n  return <h1>One</h1>\n}\n')
  // No baseline file: nothing is grandfathered in the fixture tree.
}

function run() {
  const res = spawnSync('node', [GATE, '--root', SANDBOX], { encoding: 'utf8', env: cleanEnv })
  return { status: res.status, out: `${res.stdout}${res.stderr}` }
}

beforeEach(() => reset())
afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

describe('ci:content-metadata', () => {
  it('passes on short, unique names across all four registries', () => {
    const { status, out } = run()
    expect(out).toContain('name budget 46 chars')
    expect(status).toBe(0)
  })

  it('FAILS on a name that only overflows once its town and the brand suffix are counted', () => {
    // 41 chars: under the 46-char budget alone, over it as "Name, Bend"
    // (registryTitle adds the town, Matt 2026-10-04): 47 + 14 = 61.
    const name = 'Pilot Butte State Scenic Viewpoint Summit'
    expect(name.length).toBeLessThanOrEqual(46)
    reset({ 'data/co-parks.ts': registry([{ slug: 'pilot-butte', name, city: 'Bend' }]) })
    const { status, out } = run()
    expect(out).toContain('park/pilot-butte')
    expect(out).toContain('the document title is 61 chars')
    expect(status).toBe(1)
  })

  it('does not add a town the name already carries', () => {
    const name = 'Bend Whitewater Park at McKay Park Bend Oregon'
    expect(name.length).toBe(46)
    reset({ 'data/co-parks.ts': registry([{ slug: 'bend-whitewater', name, city: 'Bend' }]) })
    const { status } = run()
    expect(status).toBe(0)
  })

  it('covers parks, which the old gate never read', () => {
    reset({
      'data/co-parks.ts': registry([
        { slug: 'cline-falls', name: 'Cline Falls State Scenic Viewpoint North', city: 'Terrebonne' },
      ]),
    })
    const { out, status } = run()
    expect(out).toContain('park/cline-falls')
    expect(status).toBe(1)
  })

  it('FAILS on a duplicate name inside a family', () => {
    reset({
      'data/co-venues.ts': registry([
        { slug: 'tower-theatre', name: 'Tower Theatre' },
        { slug: 'tower-theater', name: 'Tower Theatre' },
      ]),
    })
    const { out, status } = run()
    expect(out).toContain('duplicate name')
    expect(status).toBe(1)
  })

  it('FAILS on a detail page with no page H1', () => {
    write('app/parks/[slug]/page.tsx', 'export default function Page() {\n  return <div />\n}\n')
    const { out, status } = run()
    expect(out).toContain('has 0 page H1s')
    expect(status).toBe(1)
  })

  it('lets a baselined name through, and nothing else', () => {
    reset({
      'data/co-parks.ts': registry([
        { slug: 'pilot-butte', name: 'Pilot Butte State Scenic Viewpoint North', city: 'Terrebonne' },
        { slug: 'cline-falls', name: 'Cline Falls State Scenic Viewpoint North', city: 'Terrebonne' },
      ]),
    })
    write(
      'scripts/content-metadata-baseline.json',
      JSON.stringify({ names: ['park/pilot-butte'] }, null, 2) + '\n',
    )
    const { out, status } = run()
    expect(out).not.toContain('park/pilot-butte:')
    expect(out).toContain('park/cline-falls')
    expect(status).toBe(1)
  })

  it('FAILS on a stale baseline entry so the ledger can only shrink', () => {
    write('scripts/content-metadata-baseline.json', JSON.stringify({ names: ['park/gone'] }, null, 2) + '\n')
    const { out, status } = run()
    expect(out).toContain('no longer overflows')
    expect(status).toBe(1)
  })
})
