import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Page-grade v2.4 class sell-three-asks. Source lock so chrome + Stage ghost +
 * form title cannot stack three Value asks on /sell again.
 */
const ROOT = process.cwd()
const page = readFileSync(join(ROOT, 'app/sell/page.tsx'), 'utf8')
const form = readFileSync(join(ROOT, 'app/sell/_v3/SellValueForm.tsx'), 'utf8')
const css = readFileSync(join(ROOT, 'app/sell/_v3/sell-stage.css'), 'utf8')

describe('/sell three asks became one', () => {
  it('keeps the capture contract', () => {
    expect(page).toContain('SellValueForm')
    expect(page).not.toMatch(/import SellerLPForm/)
    expect(page).toContain('pagePath={ROUTE_PATH}')
    expect(form).toContain('submitSellerLPForm')
    expect(form).not.toContain('saveSellerPartialLead')
    expect(form).toContain("formId = 'get-value'")
    expect(form).toContain("pagePath = '/sell'")
    expect(form).toContain("source: 'seller-lp'")
  })

  it('hides the Stage ghost so it is not a second Value tap', () => {
    expect(page).toContain('sell-stage-poster')
    expect(css).toContain('display: none')
    expect(css).toContain('.v3-btn')
  })

  it('address step is label + empty field + Value my home', () => {
    expect(form).toContain('Home address')
    expect(form).toContain('Value my home')
    expect(form).not.toContain('Enter your home address')
    expect(form).not.toContain("Get your home's value")
    expect(form).not.toContain('Get your home’s value')
    expect(form).not.toContain("Get my home's value")
    expect(form).not.toContain('Get my home’s value')
  })
})
