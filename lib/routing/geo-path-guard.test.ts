import { describe, expect, it } from 'vitest'
import { resolveCityNeighborhoodPath, resolveHousingMarketPath } from './geo-path-guard'

describe('resolveHousingMarketPath', () => {
  it('passes a valid in-market city', () => {
    expect(resolveHousingMarketPath('/housing-market/bend')).toEqual({ kind: 'pass' })
    expect(resolveHousingMarketPath('/housing-market/redmond/')).toEqual({ kind: 'pass' })
    expect(resolveHousingMarketPath('/housing-market/madras')).toEqual({ kind: 'pass' })
  })

  it('passes a published community-grain report', () => {
    expect(resolveHousingMarketPath('/housing-market/sisters/black-butte-ranch')).toEqual({ kind: 'pass' })
    expect(resolveHousingMarketPath('/housing-market/redmond/eagle-crest')).toEqual({ kind: 'pass' })
  })

  it('404s an unknown plat under an in-market city', () => {
    expect(resolveHousingMarketPath('/housing-market/bend/sunrise-village')).toEqual({ kind: 'not-found' })
    expect(resolveHousingMarketPath('/housing-market/bend/not-a-place')).toEqual({ kind: 'not-found' })
  })

  it('308s an out-of-market town to /oregon/<town>', () => {
    expect(resolveHousingMarketPath('/housing-market/grants-pass')).toEqual({
      kind: 'redirect',
      destination: '/oregon/grants-pass',
      status: 308,
    })
    expect(resolveHousingMarketPath('/housing-market/medford/century-village')).toEqual({
      kind: 'redirect',
      destination: '/oregon/medford',
      status: 308,
    })
  })

  it('leaves reserved first segments to their own routes', () => {
    expect(resolveHousingMarketPath('/housing-market/reports')).toBeNull()
    expect(resolveHousingMarketPath('/housing-market/reports/monthly/2026-06')).toBeNull()
    expect(resolveHousingMarketPath('/housing-market/history')).toBeNull()
    expect(resolveHousingMarketPath('/housing-market/central-oregon')).toBeNull()
  })

  it('404s a third geo segment', () => {
    expect(resolveHousingMarketPath('/housing-market/bend/foo/bar')).toEqual({ kind: 'not-found' })
  })
})

describe('resolveCityNeighborhoodPath', () => {
  it('passes a Bend NA district', () => {
    expect(resolveCityNeighborhoodPath('/cities/bend/awbrey-butte')).toEqual({ kind: 'pass' })
    expect(resolveCityNeighborhoodPath('/cities/bend/river-west')).toEqual({ kind: 'pass' })
  })

  it('404s an unknown hood under an in-market city', () => {
    expect(resolveCityNeighborhoodPath('/cities/bend/undesignated')).toEqual({ kind: 'not-found' })
    expect(resolveCityNeighborhoodPath('/cities/redmond/river-west')).toEqual({ kind: 'not-found' })
  })

  it('308s an out-of-market town to /oregon/<town>', () => {
    expect(resolveCityNeighborhoodPath('/cities/medford/foo')).toEqual({
      kind: 'redirect',
      destination: '/oregon/medford',
      status: 308,
    })
  })

  it('ignores one-segment city paths', () => {
    expect(resolveCityNeighborhoodPath('/cities/bend')).toBeNull()
    expect(resolveCityNeighborhoodPath('/cities/grants-pass')).toBeNull()
  })
})
