import { describe, expect, it } from 'vitest'
import {
  ruralSplitsSentence,
  outbuildingsClass,
  outbuildingsCompatible,
  terrainClass,
  terrainCompatible,
  zoningClass,
  zoningClassCompatible,
} from './rural'

describe('zoningClass — the county and MLS strings rural sales carry', () => {
  it('reads farm and forest', () => {
    for (const z of ['EFU', 'EFUTRB', 'EFU-C', 'EFUAL', 'EF; EXCLUSIVE FARM', 'F1', 'F2', 'FC; FOREST COMM', 'WR; WOODLOT RESOURCE', 'SM']) {
      expect(zoningClass(z)).toBe('farm_forest')
    }
  })
  it('reads rural residential', () => {
    for (const z of ['RR10', 'RR-5', 'RR5; RURAL RES 5 AC', 'MUA10', 'MAU10', 'UAR10', 'RR2.5', 'RR10, WA', 'RR10WA', 'CRRR', 'R5; RURAL RESIDENTIAL', 'SR-2 5', 'RRM5; RECREATIONAL RESIDE']) {
      expect(zoningClass(z)).toBe('rural_res')
    }
  })
  it('reads urban and treats the MLS sentinel as unknown', () => {
    expect(zoningClass('RS')).toBe('urban')
    expect(zoningClass('RM')).toBe('urban')
    expect(zoningClass('********')).toBe('unknown')
    expect(zoningClass('')).toBe('unknown')
    expect(zoningClass(null)).toBe('unknown')
  })
  it('splits farm from rural residential, keeps within a class, keeps unknowns', () => {
    expect(zoningClassCompatible('EFUTRB', 'RR10')).toBe(false)
    expect(zoningClassCompatible('RR10', 'MUA10')).toBe(true)
    expect(zoningClassCompatible('EFU', '********')).toBe(true)
    expect(zoningClassCompatible(null, 'RR10')).toBe(true)
  })
})

describe('outbuildings and terrain from the remarks', () => {
  it('names a shop or barn, and fails open on silence', () => {
    expect(outbuildingsClass('Custom home with a 40x60 shop and RV garage.')).toBe('infrastructure')
    expect(outbuildingsClass('Charming single level on 5 acres with views.')).toBe('none')
    expect(outbuildingsClass('')).toBe('unknown')
    expect(outbuildingsCompatible('shop and barn', 'quiet setting, views')).toBe(false)
    expect(outbuildingsCompatible('shop and barn', '')).toBe(true)
    expect(outbuildingsCompatible('barn', 'pole barn and arena')).toBe(true)
  })
  it('reads lava rock against level pasture, and keeps a mixed or silent side', () => {
    expect(terrainClass('Ten acres of lava rock and juniper, steep at the back.')).toBe('unusable')
    expect(terrainClass('Level, fully fenced and cross-fenced pasture with 8 acres of water.')).toBe('usable')
    expect(terrainClass('Level building site above a rocky terrain draw.')).toBe('unknown')
    expect(terrainCompatible('lava rock', 'level pasture')).toBe(false)
    expect(terrainCompatible('lava rock', 'views for days')).toBe(true)
  })
})

describe('ruralSplitsSentence — the story names which split set sales aside', () => {
  it("Concorde: farm land, 61 rural-residential sales, 70 irrigation/horse, 34 outbuildings", () => {
    const t = ruralSplitsSentence({
      subjectZone: 'EFUTRB',
      counts: { zoning_class: 61, acreage_infrastructure: 70, outbuildings: 34, terrain: 0 },
    })
    expect(t).toBe(
      'This home sits on farm or forest land (zoned EFUTRB), and the search read the land as part of the home. Before any price was taken, 61 sales on rural residential land, 70 sales with a different irrigation or horse setup, and 34 sales with different outbuildings were set aside.',
    )
  })
  it('says nothing when nothing was set aside, and names ground when it was', () => {
    expect(ruralSplitsSentence({ subjectZone: 'RR10', counts: { zoning_class: 0 } })).toBeNull()
    expect(ruralSplitsSentence({ subjectZone: null, counts: { terrain: 1 } })).toBe(
      'On acreage the search reads the land as part of the home. Before any price was taken, 1 sale on different ground was set aside.',
    )
    expect(ruralSplitsSentence({ subjectZone: 'RR10', counts: { zoning_class: 3 } })).toContain('3 sales on farm or forest land were set aside')
  })
})
