import { describe, expect, it } from 'vitest'
import { isProspectDocClientReady, isProspectDocReady } from './doc-ready'

describe('isProspectDocClientReady', () => {
  it('rejects draft (never Audit ready / ready-to-send paint)', () => {
    expect(isProspectDocClientReady('draft')).toBe(false)
    expect(isProspectDocClientReady(null)).toBe(false)
    expect(isProspectDocClientReady(undefined)).toBe(false)
  })

  it('accepts finalized and delivered only', () => {
    expect(isProspectDocClientReady('finalized')).toBe(true)
    expect(isProspectDocClientReady('delivered')).toBe(true)
    expect(isProspectDocClientReady('published')).toBe(false)
  })
})

describe('isProspectDocReady', () => {
  it('draft + html is not ready', () => {
    expect(isProspectDocReady('draft', 'db:cmas.html_content:x')).toBe(false)
  })

  it('finalized + pending html is not ready', () => {
    expect(isProspectDocReady('finalized', 'pending:build')).toBe(false)
  })

  it('finalized + real html is ready', () => {
    expect(isProspectDocReady('finalized', 'db:cmas.html_content:x')).toBe(true)
  })
})
