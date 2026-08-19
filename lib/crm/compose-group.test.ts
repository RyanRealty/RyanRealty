import { describe, expect, it } from 'vitest'
import {
  GROUP_THREAD_FAILED,
  composeRecipientPayload,
  decideGroupSmsFallback,
  emailsForCompose,
  isComposeGroup,
} from '@/lib/crm/compose-group'

describe('compose group (one thread, not silent fan-out)', () => {
  it('two people is a group and packs extras for sendGroupMms', () => {
    const people = [
      { id: 63285, name: 'Jane' },
      { id: 63287, name: 'Odessa' },
    ]
    expect(isComposeGroup(people)).toBe(true)
    expect(composeRecipientPayload(people)).toEqual({
      personId: 63285,
      extraIds: '63287',
      isGroup: true,
    })
  })

  it('one person is not a group', () => {
    expect(isComposeGroup([{ id: 1 }])).toBe(false)
    expect(composeRecipientPayload([{ id: 1 }]).extraIds).toBe('')
  })

  it('refuses silent fan-out when the compose surface asked for a group thread', () => {
    expect(
      decideGroupSmsFallback({ explicitGroupThread: true, groupFormed: false }),
    ).toEqual({ allowFanOut: false, error: GROUP_THREAD_FAILED })
  })

  it('does not fan out after a group thread actually formed', () => {
    expect(decideGroupSmsFallback({ explicitGroupThread: true, groupFormed: true })).toEqual({
      allowFanOut: false,
    })
  })

  it('legacy composers without groupThread may still broadcast', () => {
    expect(decideGroupSmsFallback({ explicitGroupThread: false, groupFormed: false })).toEqual({
      allowFanOut: true,
    })
  })

  it('email To: is one address list, not a per-person send list invention', () => {
    expect(
      emailsForCompose([
        { email: 'a@example.com' },
        { email: 'b@example.com' },
        { email: 'a@example.com' },
        { email: null },
      ]),
    ).toEqual(['a@example.com', 'b@example.com'])
  })
})
