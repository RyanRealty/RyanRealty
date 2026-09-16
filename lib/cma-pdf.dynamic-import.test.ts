import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function staticRuntimeImports(rel: string): string[] {
  const src = readFileSync(resolve(__dirname, rel), 'utf8')
  return [...src.matchAll(/^import\s+(?!type\s)[^;]+from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])
}

describe('PDF renderers do not statically import chromium', () => {
  it.each(['./cma-pdf.ts', './pdf/html-to-pdf.ts'])('%s uses dynamic import()', (rel) => {
    const staticImports = staticRuntimeImports(rel)
    expect(staticImports).not.toContain('puppeteer-core')
    expect(staticImports).not.toContain('@sparticuz/chromium-min')
    const src = readFileSync(resolve(__dirname, rel), 'utf8')
    expect(src).toMatch(/import\('puppeteer-core'\)/)
    expect(src).toMatch(/import\('@sparticuz\/chromium-min'\)/)
  })
})
