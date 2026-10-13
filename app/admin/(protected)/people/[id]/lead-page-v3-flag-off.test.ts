import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8')
const workspace = readFileSync(resolve(__dirname, 'PersonWorkspace.tsx'), 'utf8')
const emailComposer = readFileSync(
  resolve(__dirname, '../../../../../components/admin/crm/EmailComposer.tsx'),
  'utf8',
)

describe('lead page flag-off contract', () => {
  it('keeps the six current header send controls in the flag-off JSX', () => {
    expect(page).toContain('>Text</Button>')
    expect(page).toContain('>Message</Button>')
    expect(page).toMatch(/>\s*Call\s*</)
    expect(page).toContain('replyChannel=email#comms')
    expect(page).toContain('>Build a CMA</Button>')
    expect(page).toContain('>All tools</Button>')
    expect(page).toContain("href={`/admin/messages/new?c=${card.personId}`}")
    expect(page).toContain("href={`/admin/people/${card.personId}/tools`}")
  })

  it('keeps CommsSection and SendSection on the v2 workspace path', () => {
    expect(workspace).toContain('<CommsSection')
    expect(workspace).toContain('<SendSection')
    expect(workspace).toContain("layout === 'v3'")
    expect(workspace).toContain('<PersonWorkspaceV3')
  })

  it('gates the redesign behind isLeadPageV3Enabled defaulting off', () => {
    expect(page).toContain('isLeadPageV3Enabled')
    expect(page).toContain("layout={v3 ? 'v3' : 'v2'}")
    expect(page).toContain('if (v3)')
  })

  it('disables empty email send in the existing composer', () => {
    expect(emailComposer).toContain('emailSendBlocked')
    expect(emailComposer).toContain('disabled={emailBlocked}')
  })
})
