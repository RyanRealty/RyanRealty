import { describe, expect, it } from 'vitest'
import { LINKEDIN_OAUTH_SCOPES } from './linkedin'

describe('LinkedIn OAuth scopes', () => {
  it('includes w_organization_social for the company page', () => {
    const scopes = LINKEDIN_OAUTH_SCOPES.split(' ')
    expect(scopes).toContain('w_member_social')
    expect(scopes).toContain('w_organization_social')
    expect(scopes).toContain('r_organization_social')
    expect(scopes).toContain('rw_organization_admin')
    expect(scopes).toContain('openid')
  })
})
