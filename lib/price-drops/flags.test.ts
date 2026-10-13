import { afterEach, describe, expect, it } from 'vitest'
import {
  PRICE_DROPS_REMARKS_FILTERS_ENV,
  PRICE_DROPS_REO_FILTER_ENV,
  priceDropFilterFlags,
  priceDropRemarksFiltersEnabled,
  priceDropReoFilterEnabled,
} from './flags'

describe('price-drop filter flags', () => {
  afterEach(() => {
    delete process.env[PRICE_DROPS_REMARKS_FILTERS_ENV]
    delete process.env[PRICE_DROPS_REO_FILTER_ENV]
  })

  it('defaults both filters off', () => {
    expect(priceDropRemarksFiltersEnabled()).toBe(false)
    expect(priceDropReoFilterEnabled()).toBe(false)
    expect(priceDropFilterFlags()).toEqual({ remarks: false, reo: false })
  })

  it('turns on only when the env is 1 or true', () => {
    process.env[PRICE_DROPS_REMARKS_FILTERS_ENV] = '1'
    process.env[PRICE_DROPS_REO_FILTER_ENV] = 'true'
    expect(priceDropFilterFlags()).toEqual({ remarks: true, reo: true })
  })

  it('ignores other truthy strings', () => {
    process.env[PRICE_DROPS_REMARKS_FILTERS_ENV] = 'yes'
    process.env[PRICE_DROPS_REO_FILTER_ENV] = 'on'
    expect(priceDropFilterFlags()).toEqual({ remarks: false, reo: false })
  })
})
