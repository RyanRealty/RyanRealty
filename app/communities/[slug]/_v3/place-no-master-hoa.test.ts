import { describe, expect, it } from 'vitest'
import type { PlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import { answersFaqItems, buildPlaceAnswers } from '@/lib/site/place-answers'
import { belongingFigures } from './community-opening'
import { dropsGeneratedHoaQuestion, isGeneratedHoaQuestion } from './community-authored-faqs'
import { measuredPlaceHoaInput } from './place-hoa-measured'
import { curatedNoMasterHoa, hoaCharacterFor, noMasterHoaFaq } from './place-no-master-hoa'

const character: PlaceCharacter = {
  subType: 'Single Family Residence',
  noun: 'detached homes',
  homeCount: 1259,
  yearBuilt: null,
  dues: { medianMonthly: 135, reported: 9, windowFrom: '2023-10-01' },
  hoaPresence: { yes: 12, reported: 203, windowFrom: '2023-10-01' },
}

describe('curated no-master-HOA places', () => {
  it('answers NorthWest Crossing with the curated copy, verbatim', () => {
    const [faq] = noMasterHoaFaq('northwest-crossing')
    expect(faq.question).toBe('Does NorthWest Crossing have an HOA?')
    expect(faq.answer).toBe(
      'No. NorthWest Crossing has no neighborhood-wide HOA or dues. A design committee enforces the recorded covenants and can fine for violations. Some townhome and condo groups inside the neighborhood have their own associations with monthly dues, so check the listing.',
    )
    expect(faq.answer).not.toMatch(/\$|\u2014/)
    expect(faq.source).toContain('2001-63854')
  })

  it('replaces the generated HOA question rather than adding a second one', () => {
    const authored = noMasterHoaFaq('northwest-crossing')
    expect(dropsGeneratedHoaQuestion(authored)).toBe(true)
    expect(isGeneratedHoaQuestion(authored[0].question)).toBe(true)
  })

  it('drops the measured dues figure from the glance for NorthWest Crossing only', () => {
    const nwx = hoaCharacterFor('northwest-crossing', character)
    expect(measuredPlaceHoaInput(nwx, 'NorthWest Crossing').measuredAnnual).toBeNull()
    expect(belongingFigures(null, nwx).some((f) => JSON.stringify(f).includes('1,620'))).toBe(false)
    expect(nwx?.hoaPresence).toEqual(character.hoaPresence)

    const other = hoaCharacterFor('tetherow', character)
    expect(other).toBe(character)
    expect(measuredPlaceHoaInput(other, 'Tetherow').measuredAnnual).toBe(1620)
  })

  it('is a no-op for places without a curated answer', () => {
    expect(curatedNoMasterHoa('tetherow')).toBeNull()
    expect(noMasterHoaFaq('awbrey-glen')).toEqual([])
    expect(hoaCharacterFor('northwest-crossing', null)).toBeNull()
  })

  it('FAQPage JSON-LD carries exactly the visible answer, with no generated dues row', () => {
    const generated = [
      { question: 'Does NorthWest Crossing have an HOA?', answer: 'Yes. Annual HOA dues run $1,620.' },
    ]
    const leading = noMasterHoaFaq('northwest-crossing')
    const extra = dropsGeneratedHoaQuestion(leading)
      ? generated.filter((item) => !isGeneratedHoaQuestion(item.question))
      : generated
    const { answers } = buildPlaceAnswers({
      placeName: 'NorthWest Crossing',
      cityName: 'Bend',
      figures: {},
      sourceTrace: 'market_metric neighborhood:bend-northwest-crossing',
      asOfLabel: 'Oct 8, 2026',
      valueAsk: { href: '#value', onPage: true },
      leading,
      extra,
    })
    const visible = answers.filter((a) => a.question === 'Does NorthWest Crossing have an HOA?')
    expect(visible).toHaveLength(1)
    const body = typeof visible[0].body === 'string' ? visible[0].body : visible[0].body.join(' ')
    expect(body).toBe(leading[0].answer)
    const schema = answersFaqItems(answers).filter((i) => i.question === 'Does NorthWest Crossing have an HOA?')
    expect(schema).toEqual([{ question: 'Does NorthWest Crossing have an HOA?', answer: leading[0].answer }])
    expect(JSON.stringify(answersFaqItems(answers))).not.toContain('1,620')
  })
})
