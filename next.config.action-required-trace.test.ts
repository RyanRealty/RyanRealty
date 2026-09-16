import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve(__dirname, 'next.config.ts'), 'utf8')

describe('action-required file-tracing excludes', () => {
  it('excludes chromium / ffmpeg / googleapis / public CMA assets from this route', () => {
    expect(SRC).toMatch(/outputFileTracingExcludes/)
    expect(SRC).toMatch(/app\/admin\/\(protected\)\/analytics\/action-required\/page/)
    expect(SRC).toMatch(/@sparticuz/)
    expect(SRC).toMatch(/puppeteer-core/)
    expect(SRC).toMatch(/@ffmpeg-installer/)
    expect(SRC).toMatch(/googleapis/)
    expect(SRC).toMatch(/pdfjs-dist/)
    expect(SRC).toMatch(/public\/cmas/)
    expect(SRC).toMatch(/public\/v5_library/)
  })

  it('documents VERCEL_ANALYZE_BUILD_OUTPUT for the next size report', () => {
    expect(SRC).toMatch(/VERCEL_ANALYZE_BUILD_OUTPUT/)
    expect(SRC).not.toMatch(/VERCEL_SUPPORT_LARGE_FUNCTIONS\s*=\s*1/)
  })
})
