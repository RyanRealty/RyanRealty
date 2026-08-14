import { describe, expect, it } from 'vitest'
import {
  RETIRED_PROSPECTING_SEND,
  retiredProspectingSendDataError,
  retiredProspectingSendError,
} from './retired-send'

describe('retired prospecting send', () => {
  it('refuses and points at the one send path', () => {
    expect(RETIRED_PROSPECTING_SEND).toContain('/admin/prospecting')
    expect(retiredProspectingSendError()).toEqual({
      ok: false,
      error: RETIRED_PROSPECTING_SEND,
    })
    expect(retiredProspectingSendDataError()).toEqual({
      data: null,
      error: RETIRED_PROSPECTING_SEND,
    })
  })
})
