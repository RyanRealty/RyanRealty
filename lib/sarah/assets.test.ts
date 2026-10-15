import { describe, expect, it } from 'vitest'
import { MATT_CHAT_PHOTO_SRC, SARAH_AVATAR_ALT, SARAH_AVATAR_SRC } from './assets'

describe('Sarah avatar asset', () => {
  it('is the approved avatar, used for the launcher and Sarah messages', () => {
    expect(SARAH_AVATAR_SRC).toBe('/images/sarah/avatar.jpg')
    expect(SARAH_AVATAR_ALT.toLowerCase()).toContain('sarah')
    expect(SARAH_AVATAR_ALT.toLowerCase()).toContain('ai')
  })

  it('keeps Matt photo on a separate path for takeover only', () => {
    expect(MATT_CHAT_PHOTO_SRC).toBe('/images/brokers/ryan-matt.png')
    expect(MATT_CHAT_PHOTO_SRC).not.toBe(SARAH_AVATAR_SRC)
  })
})
