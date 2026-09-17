/**
 * P0 2026-09-17: /admin/people/[id] 500ed because CmaComposeAttach →
 * cma-compose statically imported lib/cma-pdf → puppeteer-core, while
 * outputFileTracingExcludes strips puppeteer from every lambda.
 * Keep the compose action on a dynamic import forever.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('admin people composer must not statically import puppeteer PDF stack', () => {
  it('cma-compose.ts uses dynamic import for lib/cma-pdf', () => {
    const src = readFileSync('app/actions/cma-compose.ts', 'utf8')
    expect(src).not.toMatch(/import\s*\{[^}]*renderCmaPdfBuffer[^}]*\}\s*from\s*['"]@\/lib\/cma-pdf['"]/)
    expect(src).toMatch(/await import\(['"]@\/lib\/cma-pdf['"]\)/)
  })

  it('cma/send.ts and cma-deliver.ts use dynamic import for lib/cma-pdf', () => {
    for (const file of ['lib/cma/send.ts', 'lib/cma-deliver.ts']) {
      const src = readFileSync(file, 'utf8')
      expect(src, file).not.toMatch(/^import\s*\{[^}]*renderCmaPdfBuffer[^}]*\}\s*from\s*['"]@\/lib\/cma-pdf['"]/m)
      expect(src, file).toMatch(/await import\(['"]@\/lib\/cma-pdf['"]\)/)
    }
  })

  it('bpo/send.ts uses dynamic import for html-to-pdf', () => {
    const src = readFileSync('lib/bpo/send.ts', 'utf8')
    expect(src).not.toMatch(/import\s*\{[^}]*htmlToPdfBuffer[^}]*\}\s*from\s*['"]@\/lib\/pdf\/html-to-pdf['"]/)
    expect(src).toMatch(/await import\(['"]@\/lib\/pdf\/html-to-pdf['"]\)/)
  })
})
