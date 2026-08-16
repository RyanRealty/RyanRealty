import { describe, expect, it } from 'vitest'
import { publishFactValue } from './publish-fact-value'

describe('publishFactValue', () => {
  it('withholds em-dashes and blanks (Tetherow founding)', () => {
    expect(publishFactValue('—')).toBeNull()
    expect(publishFactValue('–')).toBeNull()
    expect(publishFactValue('-')).toBeNull()
    expect(publishFactValue('   ')).toBeNull()
    expect(publishFactValue(null)).toBeNull()
    expect(publishFactValue(undefined)).toBeNull()
  })

  it('publishes a real figure', () => {
    expect(publishFactValue('Yes')).toBe('Yes')
    expect(publishFactValue('Included')).toBe('Included')
    expect(publishFactValue('$1,464/yr')).toBe('$1,464/yr')
  })
})
