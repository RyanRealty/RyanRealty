import { describe, it, expect } from 'vitest'
import { isSystemNote, isHumanNote, partitionNotes } from './note-classify'

describe('note-classify', () => {
  it('classifies a broker-authored note as human regardless of body', () => {
    // The 147 'smart-followup' rows carry a broker + drafted outreach copy.
    const note = { broker: 'matt', body: 'Hi Ernie, Matt here. Hope you and Deb are settling in.' }
    expect(isHumanNote(note)).toBe(true)
    expect(isSystemNote(note)).toBe(false)
  })

  it('classifies the outreach-packet note as system (the #18187 firehose)', () => {
    const note = {
      broker: null,
      body: 'Automated outreach packet generated. Reason: expired listing. Suggested SMS: ...',
    }
    expect(isSystemNote(note)).toBe(true)
    expect(isHumanNote(note)).toBe(false)
  })

  it('classifies system-event prefixes as system when broker-null', () => {
    const cases = [
      'EXPIRED LISTING. Canceled on 2026-06-11.\n\nProperty: 14850 Stagecoach',
      'LEAD ORIGIN\nSource: Contact form (General Inquiry)',
      'Viewed property: 3211 SW Salmon Avenue, Redmond, OR',
      'Matt alert: matt@ryan-realty.com is back on the website',
      'Let our product team know what you thought of this action plan https://followupboss1.type',
    ]
    for (const body of cases) {
      expect(isSystemNote({ broker: null, body })).toBe(true)
    }
  })

  it('defaults an ambiguous broker-null free-text note to human (better to show than bury)', () => {
    // A real hand-written note imported from FUB that lost its broker attribution.
    const note = { broker: null, body: 'Talked to seller, wants to list in spring. Prefers text.' }
    expect(isHumanNote(note)).toBe(true)
  })

  it('does not misclassify a broker note that quotes a template phrase mid-body', () => {
    const note = { broker: 'matt', body: 'FYI the automated outreach packet generated last week was wrong.' }
    expect(isHumanNote(note)).toBe(true)
  })

  it('handles null/empty bodies without throwing (defaults to human)', () => {
    expect(isHumanNote({ broker: null, body: null })).toBe(true)
    expect(isHumanNote({ broker: null, body: '' })).toBe(true)
  })

  it('checks the title field too (some notes carry the marker in the title)', () => {
    const note = { broker: null, title: 'Automated outreach packet generated', body: null }
    expect(isSystemNote(note)).toBe(true)
  })

  it('partitions preserving input (reverse-chron) order within each group', () => {
    const notes = [
      { id: 1, broker: null, body: 'Automated outreach packet generated. A' },
      { id: 2, broker: 'matt', body: 'Called owner, left VM' },
      { id: 3, broker: null, body: 'EXPIRED LISTING. Withdrawn' },
      { id: 4, broker: null, body: 'Owner prefers email' }, // ambiguous → human
    ]
    const { human, system } = partitionNotes(notes)
    expect(human.map((n) => n.id)).toEqual([2, 4])
    expect(system.map((n) => n.id)).toEqual([1, 3])
  })
})
