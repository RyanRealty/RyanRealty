import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { checkCategories, registryProblems } from '../check-studio-techniques.mjs'

const CATS = ['hook', 'scene', 'type', 'transition', 'cta', 'sound', 'footage', 'process']
const base = (techniques, extra = {}) => ({
  registry: { categories: Object.fromEntries(CATS.map((c) => [c, ''])), techniques },
  knownCategories: CATS,
  exists: (p) => p === 'lib/studio/motion/chart.ts' || p === 'lib/studio/motion/paper.test.ts',
  recipeFiles: Object.values(techniques).map((t) => t.file),
  readRecipe: () => '# recipe\n',
  ...extra,
})
const ready = { file: 'a.md', category: 'scene', kind: 'code', status: 'ready', tier: 'signature', module: 'lib/studio/motion/chart.ts', test: 'lib/studio/motion/paper.test.ts' }

describe('ci:studio-techniques', () => {
  it('passes the committed registry against the real code', () => {
    const r = spawnSync(process.execPath, ['scripts/check-studio-techniques.mjs'], { encoding: 'utf8' })
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
  })

  it('reads the categories video:check knows from its source', () => {
    expect(checkCategories("export const TECHNIQUE_CATEGORIES = ['hook', 'scene'] as const")).toEqual(['hook', 'scene'])
    expect(checkCategories('nothing here')).toBeNull()
  })

  it('accepts a ready code technique whose module and test exist', () => {
    expect(registryProblems(base({ a: ready }))).toEqual([])
  })

  it('refuses a ready code technique with no module or test on disk', () => {
    const problems = registryProblems(base({ a: { ...ready, module: 'lib/studio/missing.ts', test: undefined } }))
    expect(problems.join('\n')).toMatch(/module lib\/studio\/missing\.ts does not exist/)
    expect(problems.join('\n')).toMatch(/its test \(none\) does not exist/)
  })

  it('refuses a planned technique with no home', () => {
    const problems = registryProblems(base({ a: { file: 'a.md', category: 'hook', kind: 'code', status: 'planned', tier: 'base' } }))
    expect(problems.join('\n')).toMatch(/planned with no "home"/)
  })

  it('accepts an approved technique only with approved_by matt, an ISO approved_on and a reel', () => {
    const approved = { ...ready, status: 'approved', approved_by: 'matt', approved_on: '2026-10-20', reel: 'out/studio/reels/a.mp4' }
    expect(registryProblems(base({ a: approved }))).toEqual([])
    const out = registryProblems(base({ a: { ...approved, approved_by: 'claude', approved_on: 'last week', reel: ' ' } })).join('\n')
    expect(out).toMatch(/approved_by is "claude", not "matt"/)
    expect(out).toMatch(/no approved_on ISO date/)
    expect(out).toMatch(/no reel/)
    expect(registryProblems(base({ a: { ...ready, approved_by: 'matt' } })).join('\n')).toMatch(/carries approval fields but its status is "ready"/)
    expect(registryProblems(base({ a: { ...approved, module: 'lib/x.ts' } })).join('\n')).toMatch(/module lib\/x\.ts does not exist/)
  })

  it('approves nothing on an agent\'s word: the committed registry has no approved technique', async () => {
    const { readFileSync } = await import('node:fs')
    const reg = JSON.parse(readFileSync('.claude/skills/ryan-studio/techniques/registry.json', 'utf8')).techniques
    for (const [name, t] of Object.entries(reg)) if (t.status === 'approved') expect(t.approved_by, name).toBe('matt')
  })

  it('refuses a missing or unknown tier', () => {
    expect(registryProblems(base({ a: { ...ready, tier: undefined } })).join('\n')).toMatch(/technique "a": no tier \(one of signature, base\)/)
    expect(registryProblems(base({ a: { ...ready, tier: 'showpiece' } })).join('\n')).toMatch(/tier "showpiece" must be one of signature, base/)
  })

  it('carries the signature tier on the researched showpieces, and base on the rest', async () => {
    const { readFileSync } = await import('node:fs')
    const reg = JSON.parse(readFileSync('.claude/skills/ryan-studio/techniques/registry.json', 'utf8')).techniques
    const signature = Object.entries(reg).filter(([, t]) => t.tier === 'signature').map(([n]) => n).sort()
    expect(signature).toEqual(['bucket_drain', 'collision_notes', 'line_draw_riding_dot', 'map_pins_pop', 'milestone_timeline', 'one_dot_thread', 'outline_draw_zoom', 'paper_cutout_layers', 'words_become_structure'])
    for (const name of ['eased_number_reveal', 'meter_fill_verdict', 'tiktok_caption_burn', 'dollar_first_hook', 'loop_seam_edit', 'composed_score', 'imagine_official_prompt']) expect(reg[name].tier).toBe('base')
  })

  it('refuses a category video:check does not know', () => {
    const t = { a: { ...ready, category: 'vibes' } }
    const input = base(t)
    input.registry.categories.vibes = ''
    expect(registryProblems(input).join('\n')).toMatch(/category "vibes" is not one video:check knows/)
  })

  it('refuses an orphan recipe and a recipe that says to use Remotion', () => {
    const input = base({ a: ready }, {
      recipeFiles: ['a.md', 'orphan.md'],
      readRecipe: (f) => (f === 'a.md' ? 'Remotion: spring({fps:30})' : 'x'),
    })
    const out = registryProblems(input).join('\n')
    expect(out).toMatch(/recipe orphan\.md has no registry entry/)
    expect(out).toMatch(/tells a bot to use Remotion/)
  })

  it('lets a recipe say Remotion is gone', () => {
    const input = base({ a: ready }, { readRecipe: () => 'Remotion is gone; there is no spring() here.' })
    expect(registryProblems(input)).toEqual([])
  })
})
