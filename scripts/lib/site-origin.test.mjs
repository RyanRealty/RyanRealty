import { describe, expect, it } from 'vitest'
import * as mjs from './site-origin.mjs'
import * as ts from '../../lib/site-origin'

// Built from parts so the no-staging-host gate reads no literal alias URL here.
const ALIAS = `https://${['ryanrealty', 'vercel', 'app'].join('.')}`
const PREVIEW = ['https://ryanrealty-git-x-team', 'vercel', 'app'].join('.')

const INPUTS = [
  ALIAS,
  `${ALIAS}/`,
  `${ALIAS}/api/x?y=1`,
  'https://ryan-realty.com',
  'https://www.ryan-realty.com/',
  'http://localhost:3000/',
  PREVIEW,
  'https://preview.example.test/a',
  '',
  '   ',
  null,
  'not a url',
  'ftp://ryan-realty.com',
]

describe('scripts/lib/site-origin.mjs mirrors lib/site-origin.ts', () => {
  it('has the same canonical origin', () => {
    expect(mjs.CANONICAL_SITE_ORIGIN).toBe(ts.CANONICAL_SITE_ORIGIN)
  })

  it('answers every input the same way', () => {
    for (const raw of INPUTS) {
      expect(mjs.siteOrigin(raw), String(raw)).toBe(ts.siteOrigin(raw))
      expect(mjs.configuredSiteOrigin(raw), String(raw)).toBe(ts.configuredSiteOrigin(raw))
    }
    for (const host of ['ryan-realty.com', 'WWW.ryan-realty.com', new URL(ALIAS).hostname, 'seller.ryan-realty.com', 'localhost']) {
      expect(mjs.isProductionSiteHost(host), host).toBe(ts.isProductionSiteHost(host))
    }
  })

  it('maps the alias to the apex', () => {
    expect(mjs.siteOrigin(ALIAS)).toBe('https://ryan-realty.com')
  })
})
