import { describe, expect, it, vi } from 'vitest'
import { runTextCmaReviewLinkToMe } from '@/lib/crm/cma-broker-self-action'

vi.mock('@/lib/crm/broker-self-sms', () => ({
  clientPhonesFromCmaRow: (row: Record<string, unknown>) => [row.client_phone],
  sendCmaReviewLinkToBroker: vi.fn(async (args: { clientPhones: unknown[]; broker: string }) => {
    const phones = args.clientPhones.map(String)
    if (phones.includes('+15417030001') && args.broker === 'client') {
      return { error: 'would have texted the client' }
    }
    return { error: null }
  }),
}))

describe('runTextCmaReviewLinkToMe auth + client isolation', () => {
  const row = {
    subject_address: '648 SE Douglas Ave, Bend',
    client_phone: '+15417030001',
  }

  it('refuses an unauthenticated caller and does not send', async () => {
    const loadRow = vi.fn(async () => row)
    const res = await runTextCmaReviewLinkToMe({
      authorized: false,
      broker: 'matt',
      slug: '648-se-douglas-bend-97702',
      loadRow,
    })
    expect(res).toEqual({ error: 'Unauthorized' })
    expect(loadRow).not.toHaveBeenCalled()
  })

  it('loads the CMA and sends as the acting broker, keeping the client phone off the destination path', async () => {
    const { sendCmaReviewLinkToBroker } = await import('@/lib/crm/broker-self-sms')
    const res = await runTextCmaReviewLinkToMe({
      authorized: true,
      broker: 'matt',
      slug: '648-SE-Douglas-Bend-97702',
      loadRow: async () => row,
    })
    expect(res).toEqual({ error: null })
    expect(sendCmaReviewLinkToBroker).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: '648-se-douglas-bend-97702',
        broker: 'matt',
        clientPhones: ['+15417030001'],
      }),
    )
  })
})
