/**
 * Every site search goes through trackSiteSearch (components/search/track-site-search.ts),
 * so GA4 and the first-party store always hear the same searches. Before
 * 2026-10-14 four surfaces each called the senders themselves and drifted: two
 * sent GA4 only, one sent nothing, one sent everything twice.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const HELPER = 'components/search/track-site-search.ts'

describe('site search tracking has one sender', () => {
  it('no file but the helper sends a search event directly', () => {
    // git grep over tracked and untracked sources: a walk of app/components/lib
    // takes seconds, this takes milliseconds. Exit 1 is "no match".
    let out = ''
    try {
      out = execFileSync(
        'git',
        [
          'grep', '-l', '--untracked', '-E',
          `(trackEvent|fireFirstPartyEvent)\\(\\s*['"]search['"]`,
          '--', 'app', 'components', 'lib', ':(exclude)*.test.ts', ':(exclude)*.test.tsx',
        ],
        { encoding: 'utf8' },
      )
    } catch (e) {
      if ((e as { status?: number }).status !== 1) throw e
    }
    const offenders = out.split('\n').filter((f) => f && f !== HELPER)
    expect(offenders).toEqual([])
  })

  it('every search surface records through the helper', () => {
    for (const file of [
      'components/search/SearchFilters.tsx',
      'components/search/SentenceSearch.tsx',
      'components/site/v3/V3ChromeSearch.client.tsx',
      'app/_v3/HomeHeroSearch.client.tsx',
    ]) {
      expect(readFileSync(resolve(file), 'utf8'), file).toMatch(/trackSiteSearch\(/)
    }
  })

  it('the dock field opens on focus, not when suggestions exist (search-field-rows.ts)', () => {
    const src = readFileSync(resolve('components/search/SearchFilters.tsx'), 'utf8')
    const morph = src.slice(src.indexOf('<V3MorphSearch'), src.indexOf('</V3MorphSearch>'))
    expect(morph).toMatch(/open=\{locationOpen\}/)
    expect(morph).toMatch(/items=\{fieldItems\}/)
  })
})
