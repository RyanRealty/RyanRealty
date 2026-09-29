import { afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { loadProject, clientPathsTo } from './client-import-graph.mjs'

/**
 * Break-tests for the client import graph behind ci:server-only-imports
 * (G43, transitive rule). Each case is a tiny synthetic tree; the founding
 * case is the real one: a client component reaches data/resort-communities.json
 * three hops down and no client file imports it.
 */

const roots = []
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), `client-graph-${process.pid}-`))
  roots.push(root)
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, body)
  }
  return root
}
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true })
})

const paths = (files, target = 'data/big.json') => clientPathsTo(loadProject(tree(files)), target)

describe('clientPathsTo', () => {
  it('finds a transitive path no client file imports directly (the founding case)', () => {
    const hits = paths({
      'data/big.json': '{"a":1}',
      'lib/areas.ts': "import big from '@/data/big.json'\nexport const n = big.a\n",
      'lib/filters.ts': "import { n } from './areas'\nexport const f = n\n",
      'components/Saver.tsx': "'use client'\nimport { f } from '@/lib/filters'\nexport const S = () => f\n",
    })
    expect(hits).toHaveLength(1)
    expect(hits[0].root).toBe('components/Saver.tsx')
    expect(hits[0].chain).toEqual(['components/Saver.tsx', 'lib/filters.ts', 'lib/areas.ts', 'data/big.json'])
  })

  it('ignores a path that only a server component takes', () => {
    expect(
      paths({
        'data/big.json': '{}',
        'lib/areas.ts': "import big from '@/data/big.json'\nexport const n = big\n",
        'app/page.tsx': "import { n } from '@/lib/areas'\nexport default function P() { return n }\n",
      }),
    ).toHaveLength(0)
  })

  it('ignores type-only imports (erased at compile time)', () => {
    expect(
      paths({
        'data/big.json': '{}',
        'lib/areas.ts': "import big from '@/data/big.json'\nexport type T = typeof big\nexport const x = 1\n",
        'components/A.tsx': "'use client'\nimport type { T } from '@/lib/areas'\nimport { type T as U } from '@/lib/areas'\nexport const A = 1\n",
      }),
    ).toHaveLength(0)
  })

  it("stops at a 'use server' file: a client import of a server action ships a stub", () => {
    expect(
      paths({
        'data/big.json': '{}',
        'app/actions/save.ts': "'use server'\nimport big from '@/data/big.json'\nexport async function save() { return big }\n",
        'components/A.tsx': "'use client'\nimport { save } from '@/app/actions/save'\nexport const A = () => save\n",
      }),
    ).toHaveLength(0)
  })

  it('follows a barrel by NAME: importing one export does not drag in the others', () => {
    const files = {
      'data/big.json': '{}',
      'components/v3/Heavy.tsx': "import big from '@/data/big.json'\nexport const Heavy = () => big\n",
      'components/v3/Light.tsx': 'export const Light = () => 1\n',
      'components/v3/index.ts': "export { Heavy } from './Heavy'\nexport { Light } from './Light'\nexport type { X } from './Light'\n",
    }
    expect(
      paths({
        ...files,
        'components/A.tsx': "'use client'\nimport { Light } from '@/components/v3'\nexport const A = Light\n",
      }),
    ).toHaveLength(0)
    const hits = paths({
      ...files,
      'components/B.tsx': "'use client'\nimport { Heavy } from '@/components/v3'\nexport const B = Heavy\n",
    })
    expect(hits).toHaveLength(1)
    expect(hits[0].chain).toEqual(['components/B.tsx', 'components/v3/index.ts', 'components/v3/Heavy.tsx', 'data/big.json'])
  })

  it('counts a dynamic import (it still lands in a client chunk) and a namespace import of a barrel', () => {
    const files = {
      'data/big.json': '{}',
      'components/v3/Heavy.tsx': "import big from '@/data/big.json'\nexport const Heavy = () => big\n",
      'components/v3/index.ts': "export { Heavy } from './Heavy'\n",
    }
    expect(
      paths({
        ...files,
        'components/A.tsx': "'use client'\nconst L = () => import('@/components/v3/Heavy')\nexport { L }\n",
      }),
    ).toHaveLength(1)
    expect(
      paths({
        ...files,
        'components/B.tsx': "'use client'\nimport * as V3 from '@/components/v3'\nexport const B = V3\n",
      }),
    ).toHaveLength(1)
  })

  it('does not treat a comment or string mentioning an import as one', () => {
    expect(
      paths({
        'data/big.json': '{}',
        'components/A.tsx':
          "'use client'\n// import big from '@/data/big.json'\n/* import big from '@/data/big.json' */\nexport const A = \"see https://x.test // not a comment\"\n",
      }),
    ).toHaveLength(0)
  })
})
