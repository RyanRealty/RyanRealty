import { describe, expect, it } from 'vitest'
import { aboutFaceFromBroker } from '@/app/about/_v3/about-faces'

describe('aboutFaceFromBroker', () => {
  it('keeps a canonical transparent PNG and the team door', () => {
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
    })
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
})
