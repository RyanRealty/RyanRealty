import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * ci:listing-remarks-rendered — the fixtures are the real shapes.
 *
 * The gate reads four files by path, so a fixture is a throwaway tree with those
 * four paths in it and the gate run with that tree as cwd. The passing fixture is
 * what ships; each failing fixture is a defect this repo has actually produced or
 * would not notice.
 */

const GATE = join(process.cwd(), 'scripts/check-listing-remarks-rendered.mjs')

const DAL = 'lib/data/listings/getListingDetail.ts'
const PAGE = 'app/listing/[listingKey]/page.tsx'
const RENDERER = 'components/site/listing-detail/DescriptionBlock.tsx'
const JOINER = 'lib/listing/publish-listing-remarks.ts'

const DAL_READS = `export async function getListingDetail() {
  return { publicRemarks: row.public_remarks }
}`
const PAGE_RENDERS = `export default function Page() {
  return <DescriptionBlock publicRemarks={listing.publicRemarks} />
}`
const RENDERER_OK = `import { publishListingRemarks } from '@/lib/listing/publish-listing-remarks'
export function DescriptionBlock({ publicRemarks }) {
  const paragraphs = publishListingRemarks(publicRemarks)
  return paragraphs.map((p, i) => <p key={i}>{p}</p>)
}`

function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), 'remarks-gate-'))
  for (const [path, body] of Object.entries(files)) {
    if (body == null) continue
    const full = join(dir, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, body)
  }
  cpSync(GATE, join(dir, 'gate.mjs'))
  return dir
}

function run(files) {
  const dir = tree(files)
  try {
    execFileSync('node', [join(dir, 'gate.mjs')], { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
    return { ok: true, out: '' }
  } catch (err) {
    return { ok: false, out: String(err.stdout ?? '') + String(err.stderr ?? '') }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const SHIPPING = { [DAL]: DAL_READS, [PAGE]: PAGE_RENDERS, [RENDERER]: RENDERER_OK, [JOINER]: 'export function publishListingRemarks() {}' }

describe('ci:listing-remarks-rendered', () => {
  it('passes on the shape that ships', () => {
    expect(run(SHIPPING).ok).toBe(true)
  })

  it('FAILS on the 2026-09-09 defect: the DAL reads the remarks, the page renders none', () => {
    const r = run({ ...SHIPPING, [PAGE]: 'export default function Page() { return <PropertySpecs /> }' })
    expect(r.ok).toBe(false)
    expect(r.out).toMatch(/never passes it to a component/)
  })

  it('FAILS when the renderer is deleted while the read stays', () => {
    const r = run({ ...SHIPPING, [RENDERER]: null })
    expect(r.ok).toBe(false)
    expect(r.out).toMatch(/no renderer/)
  })

  it('FAILS when the renderer skips the paragraph joiner', () => {
    const r = run({
      ...SHIPPING,
      [RENDERER]: 'export function DescriptionBlock({ publicRemarks }) { return <p>{publicRemarks}</p> }',
    })
    expect(r.ok).toBe(false)
    expect(r.out).toMatch(/publishListingRemarks/)
  })

  it('FAILS when the joiner is missing', () => {
    const r = run({ ...SHIPPING, [JOINER]: null })
    expect(r.ok).toBe(false)
    expect(r.out).toMatch(/paragraph joiner/)
  })

  it('FAILS on a hard truncation of the remarks', () => {
    const r = run({
      ...SHIPPING,
      [RENDERER]: RENDERER_OK.replace('publishListingRemarks(publicRemarks)', 'publishListingRemarks(publicRemarks).slice(0, 1)'),
    })
    expect(r.ok).toBe(false)
    expect(r.out).toMatch(/shown as written/)
  })

  it('FAILS on an ellipsis literal in the renderer', () => {
    const r = run({ ...SHIPPING, [RENDERER]: RENDERER_OK.replace('<p key={i}>{p}</p>', "<p key={i}>{p}{'…'}</p>") })
    expect(r.ok).toBe(false)
    expect(r.out).toMatch(/shown as written/)
  })

  it('stays quiet when the DAL stops reading remarks at all (a different decision, not this gate)', () => {
    const r = run({ ...SHIPPING, [DAL]: 'export async function getListingDetail() { return {} }', [PAGE]: 'export default function Page() { return null }', [RENDERER]: null, [JOINER]: null })
    expect(r.ok).toBe(true)
  })
})
