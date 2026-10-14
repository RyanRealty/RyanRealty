import { describe, expect, it } from 'vitest'
import { communityBrokerBlock } from './community-broker'

describe('communityBrokerBlock', () => {
  it('names Matt Ryan and links the team page, with no invented figure', () => {
    const block = communityBrokerBlock('Tetherow')
    expect(block.heading).toBe('Your local broker')
    expect(block.name).toBe('Matt Ryan')
    expect(block.href).toBe('/team/matthew-ryan')
    expect(block.body).toMatch(/Tetherow/)
    expect(block.body).not.toMatch(/\d/)
    expect(block.body).not.toMatch(/\$/)
  })
})
