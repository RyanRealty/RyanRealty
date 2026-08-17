import { describe, expect, it } from 'vitest'
import {
  communityIndexNameKey,
  publishCommunityIndexCount,
} from './publish-community-index-count'

describe('publishCommunityIndexCount', () => {
  it('prefers the snapshot so featured and A-Z share Tetherow 19', () => {
    expect(publishCommunityIndexCount({ snapshotCount: 19, indexCount: 12 })).toBe(19)
    expect(publishCommunityIndexCount({ snapshotCount: 19, indexCount: 0 })).toBe(19)
  })

  it('falls back to the index tile count when there is no snapshot', () => {
    expect(publishCommunityIndexCount({ snapshotCount: null, indexCount: 4 })).toBe(4)
  })

  it('returns 0 when neither source answered', () => {
    expect(publishCommunityIndexCount({})).toBe(0)
    expect(publishCommunityIndexCount({ snapshotCount: null, indexCount: null })).toBe(0)
  })
})

describe('communityIndexNameKey', () => {
  it('matches featured label to A-Z subdivision name', () => {
    expect(communityIndexNameKey('Tetherow')).toBe(communityIndexNameKey('  tetherow '))
  })
})
