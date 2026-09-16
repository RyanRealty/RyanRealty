import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Keeps /admin/analytics/action-required off the CRM god-file and the admin
 * v2 barrel. A single static import of either is enough for NFT to copy
 * googleapis / chromium / AChart into this route's serverless function
 * (Vercel failed deploy at ~805.9 MB uncompressed).
 */

const ROOT = process.cwd()

const IMPORT_FROM = /from\s+['"]([^'"]+)['"]/g

function importSources(rel: string): string[] {
  const src = readFileSync(resolve(ROOT, rel), 'utf8')
  return [...src.matchAll(IMPORT_FROM)].map((m) => m[1])
}

describe('action-required serverless graph stays lean', () => {
  it('the page does not import the CRM god-file or the admin v2 barrel', () => {
    const sources = importSources('app/admin/(protected)/analytics/action-required/page.tsx')
    expect(sources).not.toContain('@/app/actions/crm')
    expect(sources).not.toContain('@/components/admin/v2')
    expect(sources).not.toContain('@/lib/data')
    expect(sources).not.toContain('../_components/v2/DataGrid')
    expect(sources).toContain('@/components/admin/v2/QueueRow')
    expect(sources).toContain('../_components/v2/DataStates')
  })

  it('admin chrome does not statically import app/actions/crm', () => {
    const files = [
      'app/admin/(protected)/layout.tsx',
      'lib/admin/require-admin.ts',
      'app/actions/console.ts',
      'components/console/ConsoleQuickAction.tsx',
      'components/console/ConsoleCommandPalette.tsx',
      'components/console/ConsoleShell.tsx',
    ]
    for (const file of files) {
      const sources = importSources(file)
      expect(sources, file).not.toContain('@/app/actions/crm')
    }
  })

  it('console lead search uses the slim DAL, not listCrmPeople', () => {
    const sources = importSources('app/actions/console.ts')
    expect(sources).toContain('@/lib/data/crm/searchCrmPeople')
    expect(sources).toContain('@/lib/data/crm/getCrmAccess')
    expect(sources).not.toContain('@/app/actions/crm')
  })

  it('quick-action next-rec is its own server-action module', () => {
    const sources = importSources('components/console/ConsoleQuickAction.tsx')
    expect(sources).toContain('@/app/actions/crm-next-rec')
  })
})
