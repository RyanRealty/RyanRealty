import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SchoolsBlock } from '@/components/site/listing-detail/SchoolsBlock'

describe('SchoolsBlock leftover ratings', () => {
  it('prints a GreatSchools rating only when the registry has one', () => {
    const html = renderToStaticMarkup(
      createElement(SchoolsBlock, {
        listing: {
          elementarySchool: 'William E Miller Elem',
          middleSchool: 'Pacific Crest Middle',
          highSchool: 'Summit High',
          schoolDistrict: 'Bend-La Pine Schools',
        },
      }),
    )
    expect(html).toMatch(/William E Miller Elem/)
    expect(html).toMatch(/8\/10/)
    expect(html).toMatch(/Pacific Crest Middle/)
    expect(html).toMatch(/6\/10/)
    expect(html).toMatch(/Summit High/)
    expect(html).toMatch(/10\/10/)
    expect(html).not.toMatch(/Amity Creek/)
  })
})
