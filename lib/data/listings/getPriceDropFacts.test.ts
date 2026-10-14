import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('getPriceDropFacts', () => {
  const src = readFileSync(resolve(process.cwd(), 'lib/data/listings/getPriceDropFacts.ts'), 'utf8')

  it('never selects, returns, or logs private remarks', () => {
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).toMatch(/listing_terms/)
    expect(code).not.toMatch(/private_remarks/)
    expect(code).not.toMatch(/console\.(log|info|debug|warn).*remarks/i)
    expect(code).toMatch(/if \(flags\.remarks\) columns\.push\('public_remarks'\)/)
    expect(code).toMatch(/if \(flags\.reo\) columns\.push\('special_conditions'\)/)
    expect(code).toMatch(/sellerCreditPhrase\(row\.public_remarks\)/)
  })
})
