import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BROKERS } from '@/lib/brand/contact'
import { aboutDisplayName, aboutFaceFromBroker, aboutPhoneE164 } from '@/app/about/_v3/about-faces'
import { ABOUT_BROKER_ROSTER, ABOUT_FAQ_ITEMS } from '@/app/about/_v3/about-constants'

describe('about faces fold', () => {
  it('names the photo door so pa11y does not see an empty link', () => {
    const src = readFileSync('app/about/_v3/AboutFaces.tsx', 'utf8')
    expect(src).toContain('alt={person.name}')
    expect(src).not.toMatch(/alt=""/)
  })

  it('reserves the 2:3 cutout box before the png decodes', () => {
    const css = readFileSync('app/about/_v3/about-faces.css', 'utf8')
    expect(css).toMatch(/\.about-faces__photo-link\s*\{[\s\S]*?aspect-ratio:\s*2\s*\/\s*3/)
    expect(css).toMatch(/--v3-card-photo-h|--v3-card-photo-w/)
    expect(css).not.toMatch(/70vh|64vh/)
    expect(css).not.toMatch(/\.about-faces__photo\s*\{[\s\S]*?height:\s*auto/)
  })
})

describe('about page copy', () => {
  it('keeps the D11 mission out of How it started', () => {
    const src = readFileSync('app/about/page.tsx', 'utf8')
    const origin = src.slice(src.indexOf('originItems'), src.indexOf('licenseFigures'))
    expect(origin).not.toContain('ABOUT_MISSION')
    expect(origin).not.toMatch(/boutique|authentic|exceptional/)
  })
})

/**
 * /about shipped two names for one broker until 2026-09-02: the faces row and
 * the FAQ prose read BROKERS.rebecca.nameShort while the FAQ answer and the
 * broker doors read the legal name, so the page read as four brokers. The
 * display name is nameShort everywhere; the legal name is a fact about the
 * license and is allowed exactly one appearance, attached to that license.
 */
describe('one name per broker on /about', () => {
  const rebecca = BROKERS.rebecca

  it('states the licensed name once, on the license', () => {
    expect(ABOUT_BROKER_ROSTER).toContain(
      `${rebecca.nameShort}, ${rebecca.titleShort}, OR #${rebecca.license}, licensed as ${rebecca.name}`,
    )
    expect(ABOUT_BROKER_ROSTER.split(rebecca.name)).toHaveLength(2)
  })

  it('names every broker by the display name the faces use', () => {
    for (const key of ['matt', 'paul', 'rebecca'] as const) {
      expect(ABOUT_BROKER_ROSTER).toContain(`${BROKERS[key].nameShort}, ${BROKERS[key].titleShort}`)
    }
  })

  it('answers "Who are the brokers?" from that one roster', () => {
    const answer = ABOUT_FAQ_ITEMS.find((i) => i.question === 'Who are the brokers?')?.answer
    expect(answer).toBe(ABOUT_BROKER_ROSTER)
  })

  it('resolves the door label and the face to the same name', () => {
    // brokers.display_name carries the legal name; both call sites go through here.
    expect(aboutDisplayName(rebecca.slug, rebecca.name)).toBe(rebecca.nameShort)
  })

  it('hand-types no broker name in page.tsx or the constants', () => {
    const page = readFileSync('app/about/page.tsx', 'utf8')
    const constants = readFileSync('app/about/_v3/about-constants.ts', 'utf8')
    for (const src of [page, constants]) {
      expect(src).not.toContain(rebecca.name)
      expect(src).not.toContain(rebecca.nameShort)
      expect(src).not.toContain(BROKERS.paul.nameShort)
    }
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
