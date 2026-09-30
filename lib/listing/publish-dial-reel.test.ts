import { describe, expect, it } from 'vitest'
import type { VideoEmbed } from '@/lib/data/types/video'
import { publishDialReel } from './publish-dial-reel'

const embed = (over: Partial<VideoEmbed>): VideoEmbed => ({
  source: 'mls-youtube',
  embedType: 'iframe',
  url: 'https://www.youtube.com/embed/abc123',
  professional: true,
  ...over,
})

describe('publishDialReel (SITE-194)', () => {
  it('a YouTube reel plays itself: autoplay, mute, no controls, looped', () => {
    const reel = publishDialReel(embed({}))
    expect(reel?.kind).toBe('iframe')
    const url = new URL(reel!.src)
    expect(url.searchParams.get('autoplay')).toBe('1')
    expect(url.searchParams.get('mute')).toBe('1')
    expect(url.searchParams.get('controls')).toBe('0')
    expect(url.searchParams.get('loop')).toBe('1')
    expect(url.searchParams.get('playlist')).toBe('abc123')
  })

  it('a direct mp4 mounts as a video element and keeps its poster', () => {
    const reel = publishDialReel(
      embed({ source: 'mls-direct-mp4', embedType: 'video-tag', url: 'https://cdn.example.com/walk.mp4', posterUrl: 'https://cdn.example.com/p.jpg' }),
    )
    expect(reel).toEqual({ kind: 'video', src: 'https://cdn.example.com/walk.mp4', posterUrl: 'https://cdn.example.com/p.jpg' })
  })

  it('a 3D tour is never the card reel', () => {
    expect(publishDialReel(embed({ source: 'mls-matterport', url: 'https://my.matterport.com/show/?m=x', isVirtualTour: true }))).toBeNull()
  })

  it('a host that cannot play without chrome keeps the photograph', () => {
    expect(publishDialReel(embed({ source: 'mls-aryeo', url: 'https://tours.aryeo.com/x' }))).toBeNull()
    expect(publishDialReel(embed({ embedType: 'link', url: 'https://www.dropbox.com/sh/folder' }))).toBeNull()
  })

  it('no video, no reel', () => {
    expect(publishDialReel(null)).toBeNull()
    expect(publishDialReel(undefined)).toBeNull()
  })
})
