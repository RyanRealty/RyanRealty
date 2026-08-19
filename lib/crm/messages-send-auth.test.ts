import { describe, expect, it } from 'vitest'
import { refuseMessagesSend } from '@/lib/crm/messages-send-auth'

describe('messages compose auth', () => {
  it('refuses unauthenticated send', () => {
    expect(
      refuseMessagesSend({ ok: false, error: 'Admin sign-in required.', code: 'unauthenticated' }),
    ).toEqual({ ok: false, error: 'Admin sign-in required.' })
  })

  it('refuses a caller without inbox.send', () => {
    expect(
      refuseMessagesSend({ ok: false, error: 'You do not have access to this action.', code: 'forbidden' }),
    ).toEqual({ ok: false, error: 'You do not have access to this action.' })
  })

  it('lets an authorized broker through', () => {
    expect(refuseMessagesSend({ ok: true })).toBeNull()
  })
})
