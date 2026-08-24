import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('listing envelope walk wiring', () => {
  it('seeds signers from CRM people, sends our-side only, and ids new recipients', () => {
    const src = readFileSync(join(process.cwd(), 'app/actions/tc-envelopes.ts'), 'utf8')
    expect(src).toMatch(/partyNamesForEnvelopeSeed/)
    expect(src).toMatch(/rolesRequiredToSend/)
    expect(src).toMatch(/rowsForRecipientSave/)
    expect(src).toMatch(/mergePartyNamesIntoFacts/)
    expect(src).toMatch(/overlayListingPrice/)
    expect(src).toMatch(/assignUnassignedFieldsFromMaps/)
    expect(src).toMatch(/deriveSignerRole/)
    expect(src).toMatch(/getEnvelopeCycleKindAndDeal/)
    expect(src).toMatch(/getListPriceByMlsNumber/)
  })

  it('does not treat seeded checklist labels as documents on file', () => {
    const src = readFileSync(join(process.cwd(), 'app/actions/tc-required-docs.ts'), 'utf8')
    expect(src).toMatch(/presentNamesForAnticipate/)
    expect(src).toMatch(/checklistNames/)
  })

  it('seals a listing packet when the other principal is not on the file', () => {
    const src = readFileSync(join(process.cwd(), 'lib/tc/seal-envelope.ts'), 'utf8')
    expect(src).toMatch(/otherPrincipalOnFile/)
    expect(src).toMatch(/deal_id, buyers, sellers/)
  })

  it('lets the broker edit list price on the deal', () => {
    const src = readFileSync(join(process.cwd(), 'app/admin/(protected)/deals/[key]/page.tsx'), 'utf8')
    expect(src).toMatch(/DealPrices/)
    expect(src).toMatch(/listing_price/)
  })
})
