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
  })

  it('does not treat seeded checklist labels as documents on file', () => {
    const src = readFileSync(join(process.cwd(), 'app/actions/tc-required-docs.ts'), 'utf8')
    expect(src).toMatch(/presentNamesForAnticipate/)
    expect(src).toMatch(/checklistNames/)
  })
})
