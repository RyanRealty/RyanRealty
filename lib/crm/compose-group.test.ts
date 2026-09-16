import { describe, expect, it } from 'vitest'
import {
  GROUP_THREAD_FALLBACK_NOTICE,
  composeRecipientPayload,
  decideGroupSmsFallback,
  groupFallbackNotice,
  emailsForCompose,
  isComposeGroup,
} from '@/lib/crm/compose-group'

describe('compose group (one thread, honest fan-out if group fails)', () => {
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

  it('allows honest per-person fan-out when the compose surface asked for a group thread', () => {
    expect(
      decideGroupSmsFallback({ explicitGroupThread: true, groupFormed: false }),
    ).toEqual({ allowFanOut: true, notice: GROUP_THREAD_FALLBACK_NOTICE })
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

describe('groupFallbackNotice', () => {
  it('carries the reason the group did not form, in parentheses', () => {
    expect(
      groupFallbackNotice('Group MMS with given participant list already exists as Conversation CHaf1f40233b2944ec944df877e7c57ce9'),
    ).toBe(
      'Could not start one group thread — texted each person separately. (Group MMS with given participant list already exists as Conversation CHaf1f40233b2944ec944df877e7c57ce9)',
    )
  })
  it('is the bare notice when there is no reason to give', () => {
    expect(groupFallbackNotice()).toBe('Could not start one group thread — texted each person separately.')
    expect(groupFallbackNotice('  ')).toBe('Could not start one group thread — texted each person separately.')
  })
})
