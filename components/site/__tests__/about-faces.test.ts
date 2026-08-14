import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BROKERS } from '@/lib/brand/contact'
import { aboutFaceFromBroker, aboutPhoneE164 } from '@/app/about/_v3/about-faces'

describe('about page copy', () => {
  it('keeps the D11 mission out of How it started', () => {
    const src = readFileSync('app/about/page.tsx', 'utf8')
    const origin = src.slice(src.indexOf('originItems'), src.indexOf('licenseFigures'))
    expect(origin).not.toContain('ABOUT_MISSION')
    expect(origin).not.toMatch(/boutique|authentic|exceptional/)
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
