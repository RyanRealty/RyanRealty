import { describe, expect, it } from 'vitest'
import { normalizeAvatarUrl } from './avatar'

const GOOGLE_PIC = 'https://lh3.googleusercontent.com/a/google-pic=s96-c'
const FACE_PIC = 'https://platform-lookaside.fbsbx.com/face.jpg'

describe('normalizeAvatarUrl', () => {
  it('prefers user_metadata.avatar_url', () => {
    expect(
      normalizeAvatarUrl({
        user_metadata: { avatar_url: GOOGLE_PIC, picture: FACE_PIC },
        identities: [{ provider: 'google', identity_data: { picture: FACE_PIC } }],
      }),
    ).toBe(GOOGLE_PIC)
  })

  it('falls back to user_metadata.picture', () => {
    expect(
      normalizeAvatarUrl({
        user_metadata: { picture: GOOGLE_PIC },
      }),
    ).toBe(GOOGLE_PIC)
  })

  it('walks every identity and prefers Google over identities[0] email', () => {
    expect(
      normalizeAvatarUrl({
        user_metadata: {},
        identities: [
          { provider: 'email', identity_data: { email: 'matt@ryan-realty.com' } },
          { provider: 'google', identity_data: { picture: GOOGLE_PIC } },
        ],
      }),
    ).toBe(GOOGLE_PIC)
  })

  it('reads a later non-Google identity when Google has no picture', () => {
    expect(
      normalizeAvatarUrl({
        identities: [
          { provider: 'email', identity_data: {} },
          { provider: 'facebook', identity_data: { picture: FACE_PIC } },
        ],
      }),
    ).toBe(FACE_PIC)
  })

  it('rejects empty, relative, and non-http values', () => {
    expect(
      normalizeAvatarUrl({
        user_metadata: { avatar_url: ' ', picture: '/images/me.png' },
        identities: [{ provider: 'google', identity_data: { picture: '' } }],
      }),
    ).toBeNull()
  })
})
