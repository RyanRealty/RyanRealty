import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  MATT_CHAT_PHOTO_SRC,
  SARAH_AVATAR_ALT,
  SARAH_AVATAR_SRC,
  SARAH_AVATAR_SRCSET,
  SARAH_HEADSHOT_SRC,
  SARAH_HEADSHOT_SRC_2X,
  SARAH_HEADSHOT_SRC_3X,
} from './assets'

describe('Sarah avatar asset', () => {
  it('is the approved headshot with 2x/3x srcset', () => {
    expect(SARAH_AVATAR_SRC).toBe('/images/sarah/sarah-headshot.jpg')
    expect(SARAH_HEADSHOT_SRC).toBe('/images/sarah/sarah-headshot.jpg')
    expect(SARAH_HEADSHOT_SRC_2X).toBe('/images/sarah/sarah-headshot@2x.jpg')
    expect(SARAH_HEADSHOT_SRC_3X).toBe('/images/sarah/sarah-headshot@3x.jpg')
    expect(SARAH_AVATAR_SRCSET).toBe(
      `${SARAH_HEADSHOT_SRC} 1x, ${SARAH_HEADSHOT_SRC_2X} 2x, ${SARAH_HEADSHOT_SRC_3X} 3x`,
    )
    expect(SARAH_AVATAR_ALT.toLowerCase()).toContain('sarah')
    expect(SARAH_AVATAR_ALT.toLowerCase()).toContain('ai')
    expect(existsSync(resolve('public/images/sarah/sarah-headshot.jpg'))).toBe(true)
    expect(existsSync(resolve('public/images/sarah/sarah-headshot@2x.jpg'))).toBe(true)
    expect(existsSync(resolve('public/images/sarah/sarah-headshot@3x.jpg'))).toBe(true)
  })

  it('keeps Matt photo on a separate path for takeover only', () => {
    expect(MATT_CHAT_PHOTO_SRC).toBe('/images/brokers/ryan-matt.png')
    expect(MATT_CHAT_PHOTO_SRC).not.toBe(SARAH_AVATAR_SRC)
  })
})
