import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { SellBendMarket } from '@/lib/data/market-truth/getSellBendMarket'
import { EMPTY_PUBLIC_PACE } from '@/lib/data/market-truth/public-pace'
import { sellPreviewAnswer } from './sell-preview-answer'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

const page = read('app/sell/page.tsx')
const form = read('app/sell/_v3/SellValueForm.tsx')
const capture = read('app/sell/_v3/SellCapture.tsx')

describe('SITE-111 sell catalog install', () => {
  it('imports every claimed catalog source from the route v3 files', () => {
    expect(form).toContain("from '@/components/motion/input'")
    expect(form).toContain("from '@/components/motion/button'")
    expect(form).toContain("from '@/components/motion/expanding-arrow-button'")
    expect(form).toContain("from '@/components/motion/transitions-panel'")
    expect(form).toContain("from '@/components/ui/field'")
    expect(form).toContain("from '@/components/ui/input'")
    expect(form).toContain("from '@/components/ui/input-group'")
    expect(capture).toContain("from '@/components/ui/sheet'")
    expect(existsSync(join(ROOT, 'components/motion/input.tsx'))).toBe(true)
    expect(existsSync(join(ROOT, 'components/motion/button.tsx'))).toBe(true)
    expect(existsSync(join(ROOT, 'components/motion/expanding-arrow-button.tsx'))).toBe(true)
    expect(existsSync(join(ROOT, 'components/motion/transitions-panel.tsx'))).toBe(true)
    expect(existsSync(join(ROOT, 'components/ui/field.tsx'))).toBe(true)
    expect(existsSync(join(ROOT, 'components/ui/input-group.tsx'))).toBe(true)
  })

  it('keeps Stage then sheet, and does not put MOS on the fold', () => {
    expect(page).toContain('placement="stage"')
    expect(capture).toContain('<Sheet open')
    expect(page).not.toContain('V3MosBars')
    expect(page).not.toContain('sell-hero-mos')
    expect(page).toContain('previewAnswer={previewAnswer}')
    expect(page).toContain("type: 'itemList'")
  })

  it('exposes open-state taste controls the shot runner can click', () => {
    expect(form).toContain('data-taste="error-open"')
    expect(form).toContain('data-taste="success-open"')
    expect(form).toContain('data-taste="answer-open"')
    expect(form).toContain('InputComponent={BeuiInput}')
    expect(form).toContain('<ExpandingArrowButton')
    expect(form).toContain('<TransitionsPanel')
  })

  it('preview answer is sourced Bend MOS with no dollar figure', () => {
    const preview = read('app/sell/_v3/sell-preview-answer.ts')
    expect(preview).not.toMatch(/formatPrice|ClosePrice|ListPrice/)
    const bend: SellBendMarket = {
      activeCount: 648,
      monthsOfSupply: 3.745,
      mosLabel: '3.7',
      verdictKind: 'sellers',
      verdictLabel: "seller's market",
      medianListPrice: 939900,
      computedAt: '2026-09-09T00:00:00.000Z',
      completeThrough: '2026-09-09',
    }
    const answer = sellPreviewAnswer(bend, {
      ...EMPTY_PUBLIC_PACE,
      daysToPending90d: 23,
      cashShare: 0.27,
    })
    expect(answer).not.toBeNull()
    expect(sellPreviewAnswer(null, null)).toBeNull()
    const blob = JSON.stringify(answer)
    expect(blob).not.toMatch(/\$/)
    expect(blob).toContain('3.7')
    expect(blob).toContain("seller's market")
  })
})
