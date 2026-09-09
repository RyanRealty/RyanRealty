import { describe, expect, it } from 'vitest'
import { CO_PARKS } from '@/data/co-parks'
import { CO_TRAILS } from '@/data/co-trails'
import { CO_EVENTS } from '@/data/co-events'
import { CO_VENUES } from '@/data/co-venues'
import { MAX_DESC, registryDescription, registryTitle, sentences } from './registry-metadata'
import { BRAND_SUFFIX, documentTitle } from './page-metadata'

type Row = { slug: string; name: string; blurb: string }

const FAMILIES: Array<[string, ReadonlyArray<Row>]> = [
  ['parks', CO_PARKS as unknown as ReadonlyArray<Row>],
  ['trails', CO_TRAILS as unknown as ReadonlyArray<Row>],
  ['events', CO_EVENTS as unknown as ReadonlyArray<Row>],
  ['venues', CO_VENUES as unknown as ReadonlyArray<Row>],
]

/** Occurrences of `needle` in `haystack`. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

/** The first eight words of a blurb — what the accept test checks for on the live page. */
function firstEightWords(text: string): string {
  return text.replace(/\s+/g, ' ').trim().split(' ').slice(0, 8).join(' ')
}

describe.each(FAMILIES)('%s registry descriptions', (label, rows) => {
  it('has rows to check', () => {
    expect(rows.length).toBeGreaterThan(0)
  })

  it('fits 155 characters with no trailing ellipsis', () => {
    for (const row of rows) {
      const desc = registryDescription(row.blurb)
      expect(desc.length, `${label}/${row.slug} (${desc.length}): ${desc}`).toBeLessThanOrEqual(MAX_DESC)
      expect(desc, `${label}/${row.slug}`).not.toContain('…')
      expect(desc, `${label}/${row.slug}`).not.toContain('...')
    }
  })

  it('is the entity’s own prose — never the retired boilerplate', () => {
    for (const row of rows) {
      const desc = registryDescription(row.blurb)
      expect(desc, `${label}/${row.slug}`).not.toContain('a local Central Oregon brokerage')
      expect(desc, `${label}/${row.slug}`).not.toContain('from Ryan Realty')
      expect(desc, `${label}/${row.slug}`).toContain(firstEightWords(row.blurb))
    }
  })

  it('is distinct from every sibling', () => {
    const seen = new Map<string, string>()
    for (const row of rows) {
      const desc = registryDescription(row.blurb)
      expect(seen.has(desc), `${label}: ${row.slug} duplicates ${seen.get(desc)}`).toBe(false)
      seen.set(desc, row.slug)
    }
  })

  it('ends as a sentence, not mid-clause', () => {
    for (const row of rows) {
      expect(registryDescription(row.blurb), `${label}/${row.slug}`).toMatch(/[.!?]$/)
    }
  })

  it('says nothing longer than the blurb it came from', () => {
    for (const row of rows) {
      const desc = registryDescription(row.blurb)
      const normalized = row.blurb.replace(/\s+/g, ' ').trim()
      // Every word of the description is a prefix of the blurb, modulo the
      // period a clause cut adds.
      expect(normalized.startsWith(desc.replace(/\.$/, '')), `${label}/${row.slug}: ${desc}`).toBe(true)
    }
  })
})

describe.each(FAMILIES)('%s registry titles', (label, rows) => {
  it('carries no category label and adds no region of its own', () => {
    for (const row of rows) {
      const title = registryTitle(row.name)
      expect(title, `${label}/${row.slug}`).toBe(row.name.trim())
      for (const retired of [
        'Central Oregon Parks',
        'Central Oregon Trails',
        'Central Oregon Events',
        'Central Oregon Live Music & Shows',
      ]) {
        expect(title, `${label}/${row.slug}`).not.toContain(retired)
      }
      // "Central Oregon Beer Week" is an event's own proper name; nothing may be
      // ADDED beyond it.
      expect(count(title, 'Central Oregon'), `${label}/${row.slug}`).toBe(
        count(row.name, 'Central Oregon'),
      )
    }
  })

  it('adds Central Oregon exactly once — the layout suffix, and nothing else', () => {
    for (const row of rows) {
      const doc = `${documentTitle(registryTitle(row.name))}${BRAND_SUFFIX}`
      // The suffix contributes the one region. A name that carries "Central
      // Oregon" as part of its own proper noun ("Central Oregon Beer Week")
      // adds its own; nothing else may.
      expect(count(doc, 'Central Oregon'), `${label}/${row.slug}: ${doc}`).toBe(
        1 + count(row.name, 'Central Oregon'),
      )
      expect(doc.match(/Ryan Realty/g), `${label}/${row.slug}: ${doc}`).toHaveLength(1)
    }
  })
})

describe('sentences', () => {
  it('does not break on an abbreviation', () => {
    expect(sentences('A theater at Old St. Francis School in Bend. It opened in 2004.')).toEqual([
      'A theater at Old St. Francis School in Bend.',
      'It opened in 2004.',
    ])
  })
})

describe('registryDescription', () => {
  it('takes whole sentences while they fit', () => {
    const blurb = 'One short line. A second short line. ' + 'X'.repeat(200) + '.'
    expect(registryDescription(blurb)).toBe('One short line. A second short line.')
  })

  it('cuts an over-long first sentence at a clause boundary, never with an ellipsis', () => {
    const blurb =
      'Smith Rock State Park rises above the Crooked River near Terrebonne and is widely regarded as the birthplace of American sport climbing, with several thousand routes on its tuff and basalt walls.'
    const out = registryDescription(blurb)
    expect(out.length).toBeLessThanOrEqual(MAX_DESC)
    expect(out).not.toContain('…')
    expect(out.endsWith('.')).toBe(true)
    expect(out).toContain('Smith Rock State Park rises above the Crooked River')
  })

  it('never ends on an orphaned conjunction', () => {
    for (const [, rows] of FAMILIES) {
      for (const row of rows) {
        expect(registryDescription(row.blurb), row.slug).not.toMatch(
          /\b(?:and|but|or|with|that|which|the|a|an|of|to|in|on|for|from|by)\.$/,
        )
      }
    }
  })
})
