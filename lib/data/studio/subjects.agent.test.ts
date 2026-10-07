import { describe, expect, it, vi } from 'vitest'

const resolveListingAgent = vi.fn()
vi.mock('@/lib/data/brokers/resolveListingAgent', () => ({ resolveListingAgent }))

const { studioListingAgent } = await import('./subjects')

const broker = (fullName: string, headshotPng: string | null) => ({ fullName, headshotPng })

describe('studioListingAgent', () => {
  it('reads the agent off the row it already has, email first and name as the fallback', async () => {
    resolveListingAgent.mockResolvedValueOnce(broker('Paul Stevenson', '/images/brokers/stevenson-paul.png'))
    const agent = await studioListingAgent({ list_agent_email: null, ListAgentName: 'Paul Stevenson' })
    expect(resolveListingAgent).toHaveBeenLastCalledWith({ listAgentEmail: null, listAgentName: 'Paul Stevenson' })
    expect(agent).toEqual({ name: 'Paul Stevenson', headshotPath: '/images/brokers/stevenson-paul.png' })
  })

  it("never borrows another broker's face: the roster's fallback portrait is refused", async () => {
    resolveListingAgent.mockResolvedValueOnce(broker('Paula Newbroker', '/images/brokers/ryan-matt.png'))
    const agent = await studioListingAgent({ list_agent_email: 'paula@ryan-realty.com' })
    expect(agent).toEqual({ name: 'Paula Newbroker', headshotPath: null })
  })

  it('refuses a remote or traversing path as a portrait', async () => {
    resolveListingAgent.mockResolvedValueOnce(broker('Matt Ryan', 'https://cdn.example/ryan.jpg'))
    expect((await studioListingAgent({ list_agent_email: 'matt@ryan-realty.com' }))?.headshotPath).toBeNull()
  })

  it("another office's listing, or a row with no agent at all, gets no card", async () => {
    resolveListingAgent.mockResolvedValueOnce(null)
    expect(await studioListingAgent({ list_agent_email: 'someone@otheroffice.com' })).toBeNull()
    expect(await studioListingAgent({})).toBeNull()
  })
})
