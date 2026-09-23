/**
 * Break-tests for ci:ai-query-battery (AEO-2, visibility audit 2026-09-22).
 *
 * The gate used to read only next.config.ts for permanent redirects, so two F1
 * pillars that middleware 301s through data/legacy-redirects.json (SITE-171:
 * /homes-for-sale/bend/northwest-crossing -> /communities/northwest-crossing)
 * stayed on /llms.txt while the gate passed. These cases prove it now fails on
 * a legacy-map pillar, a legacy-map citable path, and a pillar listed twice.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const MAP = 'lib/seo/ai-query-map.json'
const BASE_FILES = [
  'scripts/check-ai-query-battery.mjs',
  'scripts/lib/ci-probe-ua.mjs',
  MAP,
  'app/llms.txt/route.ts',
  'next.config.ts',
  'data/resort-communities.json',
  'data/legacy-redirects.json',
]

const made = []
afterEach(() => {
  while (made.length) rmSync(made.pop(), { recursive: true, force: true })
})

function tree(mutateMap) {
  const dir = mkdtempSync(join(tmpdir(), 'ai-query-battery-'))
  made.push(dir)
  const map = JSON.parse(readFileSync(join(ROOT, MAP), 'utf8'))
  const jsonLdFiles = (map.queries ?? []).flatMap((q) => (q.jsonLd ?? []).map((c) => c.file))
  for (const rel of [...BASE_FILES, ...jsonLdFiles]) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    cpSync(join(ROOT, rel), join(dir, rel))
  }
  if (mutateMap) {
    mutateMap(map)
    writeFileSync(join(dir, MAP), JSON.stringify(map, null, 2))
  }
  return dir
}

function run(dir) {
  return spawnSync(process.execPath, [join(dir, 'scripts/check-ai-query-battery.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, AI_QUERY_BATTERY_OFFLINE: '1' },
  })
}

describe('ci:ai-query-battery', () => {
  it('passes on the tree as shipped', () => {
    const res = run(tree())
    expect(res.status, res.stderr || res.stdout).toBe(0)
    expect(res.stdout).toMatch(/AI-query-battery passed/)
  })

  it('fails a pillar that data/legacy-redirects.json 301s (the SITE-171 northwest-crossing case)', () => {
    const res = run(
      tree((map) => {
        map.pillars.push({
          section: 'listings',
          label: '3-bedroom, 2-bath homes in Northwest Crossing, Bend',
          path: '/homes-for-sale/bend/northwest-crossing?beds=3&baths=2',
        })
      }),
    )
    expect(res.status).toBe(1)
    expect(res.stderr).toMatch(/pillar \/homes-for-sale\/bend\/northwest-crossing\?beds=3&baths=2 is a key in data\/legacy-redirects\.json/)
  })

  it('fails a citable path that data/legacy-redirects.json 301s', () => {
    const res = run(
      tree((map) => {
        map.queries.find((q) => q.id === 'nwx-3bed-2bath').citablePaths.push('/homes-for-sale/bend/northwest-crossing')
      }),
    )
    expect(res.status).toBe(1)
    expect(res.stderr).toMatch(/nwx-3bed-2bath: citable path \/homes-for-sale\/bend\/northwest-crossing is a key in data\/legacy-redirects\.json/)
  })

  it('fails a pillar path listed twice', () => {
    const res = run(
      tree((map) => {
        map.pillars.push({ section: 'tools', label: 'Value my home', path: '/sell' })
      }),
    )
    expect(res.status).toBe(1)
    expect(res.stderr).toMatch(/pillar \/sell is listed twice/)
  })
})
