import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'CmaReviewActions.tsx'), 'utf8')

describe('CmaReviewActions', () => {
  it('keeps EmailBodyEditor as the shared compose chokepoint', () => {
    expect(src).toContain('className="cma-send-dock')
    expect(src).toContain('EmailBodyEditor')
    expect(src).toContain('Outbound email')
    expect(src).toMatch(/<details>[\s\S]*Remove[\s\S]*Archive CMA[\s\S]*Delete CMA/)
  })

  it('Schedule vs Send now via approveAndDeliverCma delivery override', () => {
    expect(src).toContain("approveAndDeliverCma(props.slug, ov, { delivery })")
    expect(src).toContain("deliver('drip')")
    expect(src).toContain("deliver('now')")
    expect(src).toContain("'Schedule'")
    expect(src).toContain("'Send now'")
  })

  it('R1 drip card: ETA + Send now / Hold / Remove from drip', () => {
    expect(src).toContain('cma-drip-card')
    expect(src).toContain('In drip')
    expect(src).toContain('holdCmaInDripAction')
    expect(src).toContain('removeCmaFromDripAction')
    expect(src).toContain('Remove from drip')
    expect(src).toContain('Hold')
  })

  it('R2 chrome: To / From / CMA PDF chip + signature preview', () => {
    expect(src).toContain('label="To"')
    expect(src).toContain('From ·')
    expect(src).toContain('CMA PDF')
    expect(src).toContain('attaches on send')
    expect(src).toContain('signatureHtml={props.signatureHtml}')
  })

  it('R3: no People compose hop as primary', () => {
    expect(src).not.toContain('Open in CRM compose')
    expect(src).not.toContain('Write a custom email')
    expect(src).not.toContain('composeCma=')
    expect(src).not.toContain('cmaCrmComposeHref')
  })

  it('saves email for drip on the Review path', () => {
    expect(src).toContain('Save email for drip')
    expect(src).toContain('saveCmaFirstContactOverrideAction')
  })
})
