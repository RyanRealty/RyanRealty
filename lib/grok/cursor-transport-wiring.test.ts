import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const TEXT = readFileSync(new URL('./text.ts', import.meta.url), 'utf8')
const CLIENT = readFileSync(new URL('./client.ts', import.meta.url), 'utf8')
const CURSOR = readFileSync(new URL('./cursor-cli.ts', import.meta.url), 'utf8')

/** Strip block + line comments so header docs may name api.x.ai as the thing we avoid. */
function withoutComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

describe('Cursor transport wiring (no api.x.ai when active)', () => {
  it('generateGrokStructured routes to cursor-cli when transport is cursor', () => {
    expect(TEXT).toMatch(/resolveGrokTransport\(\) === 'cursor'/)
    expect(TEXT).toMatch(/generateGrokStructuredViaCursorCli/)
  })

  it('xaiFetch refuses to call api.x.ai under Cursor transport', () => {
    expect(CLIENT).toMatch(/Cursor transport active \(no api\.x\.ai/)
  })

  it('cursor-cli spawn strips XAI_API_KEY', () => {
    expect(CURSOR).toMatch(/delete env\.XAI_API_KEY/)
    expect(CURSOR).toMatch(/cursor-agent/)
    // Executable body must not call api.x.ai; file header may document the avoidance.
    expect(withoutComments(CURSOR)).not.toMatch(/api\.x\.ai/)
  })
})
