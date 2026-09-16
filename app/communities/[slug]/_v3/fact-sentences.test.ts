import { describe, expect, it } from 'vitest'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import {
  FACT_SENTENCE_MAX_WORDS,
  buildFactSentences,
  splitSentences,
  wordCount,
} from './fact-sentences'

/**
 * The sentences below are copied VERBATIM from data/resort-community-tetherow.json
 * `about_prose` (2026-08-03 revision), because the module's whole contract is
 * that a sentence under a figure is the config's own words or nothing.
 */
const TETHEROW: ResortCommunityContent = {
  slug: 'tetherow',
  name: 'Tetherow',
  acres: 700,
  founded: 2008,
  architect: 'David McLay Kidd',
  aboutProse: [
    'Tetherow began in 2004 as a plan called Cascade Highlands. A year later, the developers renamed it Tetherow, after Solomon Tetherow, the wagon party captain who led a pioneer group through this stretch of Central Oregon in the mid-1800s. The golf course and clubhouse opened in 2008, and the resort built out in stages after that: the Tetherow Grill in 2009, a golf academy in 2012, The Row in 2013, the 50-room Tetherow Lodges hotel in 2014, an event pavilion and the first vacation rental homes in 2016, and Tetherow Sport in 2017. What exists today across the 700-acre master plan is roughly 400 custom homesites split into nine named sub-neighborhoods, from the golf-course estates in Heath and Crescent to the attached townhomes at The Rim and Triple Knot.',
    "The course is a David McLay Kidd design, and Kidd is not a name Tetherow borrows for marketing. He designed Bandon Dunes on the Oregon coast in 1999, the course that proved a Scottish-links layout could work on American ground, and he has lived in Bend ever since, running his design firm, DMK Golf Design, from here. It has since climbed 25 spots on Golf Digest's public-course rankings and held the top Pacific Northwest resort spot in Conde Nast Traveler's reader poll for eight straight years.",
    "West Bend runs out fast past Tetherow's gates. Mt. Bachelor is a 25-minute drive from Tetherow's gates and runs 11 lifts across 4,300 acres of terrain.",
    'The Tetherow Owners Association requires homes to read as Northwest in character, and buyers choose their own builder rather than working from a developer’s standard set.',
    'Ownership here carries layers of cost and rules that a buyer coming from a standard subdivision will not expect. A master association assessment covers common infrastructure across the whole 700 acres, and each of the nine sub-neighborhoods layers its own separate dues on top, set by its own manager and its own budget.',
  ],
  amenities: [],
  driveTimes: [],
  courseRankings: [
    {
      rank: '#57',
      publication: "Golf Digest America's 100 Greatest Public Courses",
      description: '2023-24 ranking · up 25 spots from prior list (largest jump on the list)',
    },
  ],
  courseSpecs: {
    summary:
      'Designed by David McLay Kidd. Opened 2008. Fescue blend (Chewings + Creeping Red) with Colonial Bentgrass.',
  },
  signatureHole: null,
  membershipTiers: [],
  builders: [],
  buildTimeline: [
    { year: 2004, label: 'Planning begins as "Cascade Highlands"' },
    { year: 2008, label: 'Golf course + clubhouse open' },
  ],
}

describe('splitSentences', () => {
  it('splits on terminal marks and keeps an abbreviation with its sentence', () => {
    const out = splitSentences(TETHEROW.aboutProse[2]!)
    expect(out).toEqual([
      "West Bend runs out fast past Tetherow's gates.",
      "Mt. Bachelor is a 25-minute drive from Tetherow's gates and runs 11 lifts across 4,300 acres of terrain.",
    ])
  })
})

describe('buildFactSentences (SITE-116 round 4)', () => {
  const said = buildFactSentences(TETHEROW, ['hoa', 'founded', 'acres', 'architect', 'ranked'])

  it('takes the config sentence that names the figure, the shortest one, never an invented line', () => {
    expect(said.get('acres')).toBe(
      'What exists today across the 700-acre master plan is roughly 400 custom homesites split into nine named sub-neighborhoods, from the golf-course estates in Heath and Crescent to the attached townhomes at The Rim and Triple Knot.',
    )
    expect(said.get('architect')).toBe(
      'The course is a David McLay Kidd design, and Kidd is not a name Tetherow borrows for marketing.',
    )
    expect(said.get('ranked')).toBe(
      "It has since climbed 25 spots on Golf Digest's public-course rankings and held the top Pacific Northwest resort spot in Conde Nast Traveler's reader poll for eight straight years.",
    )
    for (const sentence of said.values()) {
      expect(TETHEROW.aboutProse.join(' ').includes(sentence) || sentence.endsWith('.')).toBe(true)
      expect(wordCount(sentence)).toBeLessThanOrEqual(FACT_SENTENCE_MAX_WORDS)
    }
  })

  it('spends a sentence once: the HOA takes the dues sentence, so the acreage cannot reuse its "700 acres"', () => {
    expect(said.get('hoa')).toBe(
      'A master association assessment covers common infrastructure across the whole 700 acres, and each of the nine sub-neighborhoods layers its own separate dues on top, set by its own manager and its own budget.',
    )
    expect(said.get('hoa')).not.toBe(said.get('acres'))
  })

  it('does not read the design-review sentence as an HOA sentence', () => {
    expect(said.get('hoa')).not.toMatch(/Northwest in character/)
  })

  it('falls back to the build timeline when the only prose sentence naming the year is over the cap', () => {
    expect(said.get('founded')).toBe('Golf course + clubhouse open.')
  })

  it('falls back to the ranking description and the course summary when the prose has nothing', () => {
    const bare: ResortCommunityContent = { ...TETHEROW, aboutProse: [], buildTimeline: [] }
    const out = buildFactSentences(bare, ['founded', 'architect', 'ranked', 'acres', 'hoa'])
    expect(out.get('founded')).toBeUndefined()
    expect(out.get('architect')).toBe('Designed by David McLay Kidd.')
    expect(out.get('ranked')).toBe('2023-24 ranking · up 25 spots from prior list (largest jump on the list).')
    expect(out.get('acres')).toBeUndefined()
    expect(out.get('hoa')).toBeUndefined()
  })

  it('returns nothing for a community with no config', () => {
    expect(buildFactSentences(null, ['founded']).size).toBe(0)
  })
})
