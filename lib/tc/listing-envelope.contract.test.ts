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
    expect(src).toMatch(/mappedFieldTypeFromName/)
    expect(src).toMatch(/withFallbackSignatures/)
    const stack = readFileSync(join(process.cwd(), 'lib/tc/fallback-signing-stack.ts'), 'utf8')
    expect(stack).toMatch(/promoteLinedFormFields/)
    expect(stack).toMatch(/promoteInitialsBoxes/)
    expect(src).toMatch(/signerOwnsMappedField/)
    const sign = readFileSync(join(process.cwd(), 'app/actions/tc-sign.ts'), 'utf8')
    expect(sign).toMatch(/signerOwnsMappedField/)
    expect(sign).toMatch(/if \(!signerOwnsMappedField\(String\(f\.type/)
    expect(sign).toMatch(/type === 'text' && !!text.trim/)
    const adopt = readFileSync(join(process.cwd(), 'lib/tc/adopt-signature.ts'), 'utf8')
    expect(adopt).toMatch(/stampPreparedSignerFields/)
    expect(src).toMatch(/getEnvelopeCycleKindAndDeal/)
    expect(src).toMatch(/getListPriceByMlsNumber/)
  })

  it('anticipated docs take representation from people on the file', () => {
    const src = readFileSync(join(process.cwd(), 'app/actions/tc-required-docs.ts'), 'utf8')
    expect(src).toMatch(/ourRoleForEnvelope/)
    expect(src).toMatch(/getDealParties/)
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
