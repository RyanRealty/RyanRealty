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
const ready = { file: 'a.md', category: 'scene', kind: 'code', status: 'ready', module: 'lib/studio/motion/chart.ts', test: 'lib/studio/motion/paper.test.ts' }

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
    const problems = registryProblems(base({ a: { file: 'a.md', category: 'hook', kind: 'code', status: 'planned' } }))
    expect(problems.join('\n')).toMatch(/planned with no "home"/)
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
