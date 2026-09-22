import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ATLAS_PIN_MIN_USD } from '@/lib/atlas/pin-price'
import {
  NEW_CON_ATLAS_CLUSTER_CELL_PX,
  NEW_CON_ATLAS_CLUSTER_STAGE,
  NEW_CON_ATLAS_CLUSTER_STAGE_PHONE,
} from './load-overview-map'

const PAGE = readFileSync(resolve('app/new-construction/page.tsx'), 'utf8')
const CSS = readFileSync(resolve('app/new-construction/_v3/new-con-page.css'), 'utf8')
const MAP = readFileSync(resolve('app/new-construction/_v3/load-overview-map.ts'), 'utf8')

describe('SITE-142 /new-construction 375 craft', () => {
  it('clusters Atlas pins on a first-paint stage and keeps 0K+ off the loader', () => {
    expect(PAGE).toMatch(/clusterPins/)
    expect(PAGE).toMatch(/clusterCellPx=\{NEW_CON_ATLAS_CLUSTER_CELL_PX\}/)
    expect(PAGE).toMatch(/clusterStageHintPhone=\{NEW_CON_ATLAS_CLUSTER_STAGE_PHONE\}/)
    expect(MAP).toContain('ATLAS_PIN_MIN_USD')
    expect(NEW_CON_ATLAS_CLUSTER_CELL_PX).toBeGreaterThanOrEqual(64)
    expect(NEW_CON_ATLAS_CLUSTER_STAGE.w).toBeGreaterThan(0)
    expect(NEW_CON_ATLAS_CLUSTER_STAGE_PHONE.w).toBeGreaterThan(0)
    expect(ATLAS_PIN_MIN_USD).toBe(10_000)
  })

  it('keeps the crumb in flow and stats/CTA off mid-word clip at 375', () => {
    expect(PAGE).toMatch(/newcon-hero__crumb/)
    expect(PAGE).not.toMatch(/newcon-hero__crumb absolute/)
    expect(PAGE).toMatch(/live Active homes/)
    expect(PAGE).toMatch(/named subdivisions/)
    expect(PAGE).toMatch(/list-price span/)
    expect(CSS).toMatch(/padding-right:\s*calc\(var\(--v3-gutter\) \+ 4\.25rem/)
    expect(CSS).toMatch(/\.newcon-hero \.v3-stage-strip__value/)
    expect(CSS).toMatch(/white-space:\s*nowrap/)
    expect(CSS).toMatch(/\.newcon-page \.v3-atlas__frame/)
    expect(CSS).toMatch(/overflow:\s*visible/)
  })

  it('does not use hover as the only ledger affordance, and names builder programs in #tour', () => {
    expect(PAGE).not.toMatch(/Hover a row/)
    expect(PAGE).not.toMatch(/Open a row/)
    expect(PAGE).not.toMatch(/reveal:\s*\{/)
    expect(PAGE).toMatch(/The live band and published concession sit on the row/)
    expect(PAGE).toMatch(/id="tour"/)
    expect(PAGE).toMatch(/Builder program/)
    expect(PAGE).toMatch(/Golden Key/)
    expect(PAGE).toMatch(/Stevens Ranch flyer/)
    expect(PAGE).toMatch(/id="builders"/)
    expect(PAGE).toMatch(/Fall Super Sale/)
    expect(PAGE).toMatch(/CONTACT\.phoneDirect/)
  })
})
