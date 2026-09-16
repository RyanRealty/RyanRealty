import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * SITE-100. Tip Ready requireRouteImport: the hub `_v3` set must import the
 * installed catalog specifiers. A re-export of RegionInsight without those
 * import lines is a house wrapper and --ship refuses it.
 */
function src(rel: string): string {
  return readFileSync(resolve(rel), 'utf8')
}

describe('SITE-100 hub catalog install', () => {
  it('imports the installed InsightCards and beUI number from this route set', () => {
    const hub = src('app/housing-market/_v3/HubInsight.client.tsx')
    expect(hub).toMatch(/from '@\/components\/motion\/insight-cards'/)
    expect(hub).toMatch(/from '@\/components\/motion\/number'/)
    expect(hub).toMatch(/HubInsight/)
  })

  it('the hub page mounts HubInsight and V3MosBars in the opening drawing', () => {
    const page = src('app/housing-market/page.tsx')
    expect(page).toMatch(/import \{ HubInsight \} from '\.\/_v3\/HubInsight\.client'/)
    expect(page).toMatch(/<HubInsight board=\{insightBoard\}/)
    expect(page).toMatch(/<V3MosBars/)
    expect(page).toMatch(/settleFigures/)
  })
})
