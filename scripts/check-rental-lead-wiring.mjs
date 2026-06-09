#!/usr/bin/env node
/**
 * check-rental-lead-wiring.mjs — static gate: the rental-calculator lead path is
 * wired end to end (form -> action -> FUB canonical tagging).
 *
 * The lead capture writes a real person to Follow Up Boss, so it can't be
 * smoke-tested with a fake submission. This asserts the wiring statically so the
 * lead path can't silently break: the action exists and tags the lead, the form
 * calls it, and the calculator renders the form.
 *
 * Usage: node scripts/check-rental-lead-wiring.mjs
 */
import { readFileSync } from 'node:fs'

const read = (p) => {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

const checks = []
const check = (label, ok) => checks.push({ label, ok })

const action = read('app/actions/lead-capture.ts')
check('submitRentalLead action exists', /export async function submitRentalLead/.test(action))
check('rental lead sends a FUB event', /sendEvent\(/.test(action) && /submitRentalLead/.test(action))
check('rental lead applies canonical tags + rental-calculator tag', /canonicallyTagLead/.test(action) && /'rental-calculator'/.test(action))
check('rental lead fires Meta CAPI + GA4', /rental_calculator_lead/.test(action) && /fireLeadGenerated/.test(action))

const form = read('components/tools/RentalLeadForm.tsx')
check('RentalLeadForm calls submitRentalLead', /submitRentalLead/.test(form))

const calc = read('components/tools/RentalCalculator.tsx')
check('RentalCalculator renders RentalLeadForm', /import RentalLeadForm/.test(calc) && /<RentalLeadForm/.test(calc))

console.log('Rental-lead wiring gate')
console.log('=======================\n')
let failed = 0
for (const c of checks) {
  if (c.ok) console.log(`  OK    ${c.label}`)
  else {
    failed++
    console.log(`  FAIL  ${c.label}`)
  }
}
console.log()
if (failed) {
  console.log(`${failed}/${checks.length} rental-lead wiring checks FAILED.`)
  process.exit(1)
}
console.log(`All ${checks.length} rental-lead wiring checks pass.`)
process.exit(0)
