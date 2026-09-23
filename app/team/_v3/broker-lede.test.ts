import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { brokerLede } from './broker-lede'

// The opening of each live bio in public.brokers (read 2026-09-23), trimmed.
const MATT =
  'Matt Ryan is the owner and principal broker of Ryan Realty in Bend, Oregon. He has been licensed in Oregon since 2012, started Ryan Realty LLC in 2014, and opened the Bend office in June 2023.\n\nMatt learned the business from his mentor.'
const PAUL =
  'Paul Stevenson brings more than 19 years of service to his work, most of it with the La Pine Fire Department. He has lived in the Redmond area for years.'
const REBECCA =
  'Rebecca Ryser Peterson is a broker at Ryan Realty and a longtime Bend resident. She knows the neighborhoods, the schools, the trails.'

describe('brokerLede (VOICE-5 / AEO-5)', () => {
  it("returns each broker's own first sentence, verbatim", () => {
    expect(brokerLede(MATT)).toBe('Matt Ryan is the owner and principal broker of Ryan Realty in Bend, Oregon.')
    expect(brokerLede(PAUL)).toBe(
      'Paul Stevenson brings more than 19 years of service to his work, most of it with the La Pine Fire Department.',
    )
    expect(brokerLede(REBECCA)).toBe('Rebecca Ryser Peterson is a broker at Ryan Realty and a longtime Bend resident.')
  })

  it('does not stop at an abbreviation or an initial', () => {
    expect(brokerLede('She has sold homes near Mt. Bachelor for years. More here.')).toBe(
      'She has sold homes near Mt. Bachelor for years.',
    )
    expect(brokerLede('Trained by J. Smith in Bend. More.')).toBe('Trained by J. Smith in Bend.')
  })

  it('prints nothing without a bio, and the whole first paragraph when it has no sentence end', () => {
    expect(brokerLede(null)).toBeNull()
    expect(brokerLede('   ')).toBeNull()
    expect(brokerLede('A bio with no full stop')).toBe('A bio with no full stop')
  })

  it('is wired onto the /team index card only', () => {
    const team = readFileSync('app/team/page.tsx', 'utf8')
    expect(team).toMatch(/lede: brokerLede\(b\.bio\)/)
    const faces = readFileSync('app/about/_v3/AboutFaces.tsx', 'utf8')
    expect(faces).toMatch(/about-faces__lede/)
    const about = readFileSync('app/about/page.tsx', 'utf8')
    expect(about).not.toMatch(/brokerLede/)
  })
})
