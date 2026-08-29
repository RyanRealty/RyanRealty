import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BROKERS } from '@/lib/brand/contact'
import { aboutFaceFromBroker, aboutPhoneE164 } from '@/app/about/_v3/about-faces'

describe('about faces fold', () => {
  it('names the photo door so pa11y does not see an empty link', () => {
    const src = readFileSync('app/about/_v3/AboutFaces.tsx', 'utf8')
    expect(src).toContain('alt={person.name}')
    expect(src).not.toMatch(/alt=""/)
  })

  it('reserves the 2:3 cutout box before the png decodes', () => {
    const css = readFileSync('app/about/_v3/about-faces.css', 'utf8')
    expect(css).toMatch(/\.about-faces__photo-link\s*\{[\s\S]*?aspect-ratio:\s*2\s*\/\s*3/)
    expect(css).toContain('width: min(100%, calc(70vh * 2 / 3))')
    expect(css).not.toMatch(/\.about-faces__photo\s*\{[\s\S]*?height:\s*auto/)
  })
})

describe('about page copy', () => {
  it('keeps the boutique sentence and city ledger off About', () => {
    const src = readFileSync('app/about/page.tsx', 'utf8')
    const origin = src.slice(src.indexOf('originItems'), src.indexOf('recordItems'))
    expect(origin).not.toContain('ABOUT_MISSION')
    expect(origin).not.toMatch(/boutique|authentic|exceptional/)
    expect(src).not.toContain('V3Instrument')
    expect(src).not.toContain('V3Ledger')
    expect(src).toContain('How it started')
    expect(src).toContain('trio')
  })
})

describe('about faces trio fold', () => {
  it('shows all three faces on 390 and reserves cookie tap space', () => {
    const css = readFileSync('app/about/_v3/about-faces.css', 'utf8')
    expect(css).toMatch(/\.about-faces--trio \.about-faces__grid\s*\{[\s\S]*?repeat\(3/)
    expect(css).toContain('padding-bottom: calc(var(--v3-tap) + var(--v3-space-xl))')
    expect(css).toMatch(
      /\.about-faces--trio \.about-faces__grid > li:not\(:first-child\) \.about-faces__photo-link\s*\{[\s\S]*?display:\s*flex/,
    )
  })
})

describe('aboutPhoneE164', () => {
  it('derives E.164 from a dotted broker phone', () => {
    expect(aboutPhoneE164(BROKERS.matt.phone)).toBe(`+1${BROKERS.matt.phone.replace(/\D/g, '')}`)
  })

  it('returns null when the value cannot parse', () => {
    expect(aboutPhoneE164('')).toBeNull()
    expect(aboutPhoneE164(null)).toBeNull()
    expect(aboutPhoneE164('office')).toBeNull()
  })
})

describe('aboutFaceFromBroker', () => {
  it('keeps a canonical transparent PNG, the team door, and call/text hrefs', () => {
    expect(
      aboutFaceFromBroker({
        slug: 'matthew-ryan',
        fullName: 'Matt Ryan',
        title: 'Principal Broker',
        headshotPng: '/images/brokers/ryan-matt.png',
        phoneDirect: BROKERS.matt.phone,
      }),
    ).toEqual({
      href: '/team/matthew-ryan',
      src: '/images/brokers/ryan-matt.png',
      name: BROKERS.matt.nameShort,
      title: 'Principal Broker',
      tel: aboutPhoneE164(BROKERS.matt.phone),
    })
  })

  it('uses the short display name for Rebecca', () => {
    const face = aboutFaceFromBroker({
      slug: BROKERS.rebecca.slug,
      fullName: BROKERS.rebecca.name,
      title: BROKERS.rebecca.title,
      headshotPng: '/images/brokers/peterson-rebecca.png',
      phoneDirect: BROKERS.rebecca.phone,
    })
    expect(face?.name).toBe(BROKERS.rebecca.nameShort)
    expect(face?.tel).toBe(aboutPhoneE164(BROKERS.rebecca.phone))
  })

  it('refuses a JPG so a white box cannot stand in for a cutout', () => {
    expect(
      aboutFaceFromBroker({
        slug: 'matthew-ryan',
        fullName: 'Matt Ryan',
        headshotPng: '/images/brokers/ryan-matt.jpg',
      }),
    ).toBeNull()
  })

  it('refuses a remote photo_url', () => {
    expect(
      aboutFaceFromBroker({
        slug: 'matthew-ryan',
        fullName: 'Matt Ryan',
        headshotPng: 'https://cdn.example.com/matt.png',
      }),
    ).toBeNull()
  })

  it('keeps the face when the phone is missing', () => {
    expect(
      aboutFaceFromBroker({
        slug: 'matthew-ryan',
        fullName: 'Matt Ryan',
        title: 'Principal Broker',
        headshotPng: '/images/brokers/ryan-matt.png',
      }),
    ).toEqual({
      href: '/team/matthew-ryan',
      src: '/images/brokers/ryan-matt.png',
      name: 'Matt Ryan',
      title: 'Principal Broker',
      tel: null,
    })
  })
})
