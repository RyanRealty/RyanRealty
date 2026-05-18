import { deriveFormName, extractOrefNumber, suggestStandardNameV2, CATEGORIES_WITHOUT_SALE_NUMBER, inferKindV2 } from './skyslope-forms-document-taxonomy-v2.mjs'
const inferKind = inferKindV2

const cases = [
  ['Listing Agreement - Exclusive - 015 OREF.pdf', '220199105', '015', 'Listing Agreement Exclusive', false],
  ['Listing Agreement - Exclusive - 015 OREF_2.pdf', '220199105', '015', 'Listing Agreement Exclusive', false],
  ['Residential_Real_Estate_Sale_Agreement_-_001_OREF _5_.pdf', '220205567', '001', 'Residential Real Estate Sale Agreement', true],
  ['Sale_Agreement.pdf', '220205567', '', 'Residential Real Estate Sale Agreement', true],
  ['Sale Agreement.pdf', '220205567', '', 'Residential Real Estate Sale Agreement', true],
  ['Initial Agency Disclosure Pamphlet - 042 OREF.pdf', '220215931', '042', 'Initial Agency Disclosure Pamphlet', true],
  ['Buyer Representation Agreement - Exclusive - 050 OREF.pdf', '220199105', '050', 'Buyer Representation Agreement Exclusive', false],
  ['Buyer Representation Agreement - Exclusive - 050 OREF_2.pdf', '220199105', '050', 'Buyer Representation Agreement Exclusive', false],
  ['9_4 Buyer Representation Agreement - OR.pdf', '220199105', '', 'Buyer Representation Agreement', false],
  ['Addendum to Sale Agreement 1 - 002 OREF.pdf', '220199105', '002', 'Addendum to Sale Agreement', true],
  ['Addendum_to_Sale_Agreement_1_-_002_OREF.pdf', '220199105', '002', 'Addendum to Sale Agreement', true],
  ['firpta-820.pdf', '220205649', '', '', true],
  ['Penhollow_Delivery_of_HOA_Docs_646.pdf', '220203839', '', 'Penhollow Delivery of HOA Docs', true],
  ['Penhollow_Closing_Date_Addendum_866.pdf', '220203839', '', 'Penhollow Closing Date Addendum', true],
  ['Advisory Regarding FIRPTA Tax - Buyer - 092 OREF.pdf', '220199105', '092', 'Advisory Regarding FIRPTA Tax', true],
  ['ORE Residential Input - ODS.pdf', '220221088', '', '', true],
  ['Counteroffer No. 1 - OREF-003.pdf', '220199105', '003', 'Counteroffer', true],
  ['1_1-Oregon-Residential-Real-Estate-Purchase-And-Sale-Agreement-OR_2.pdf', '220205649', '', 'Residential Real Estate Sale Agreement', true],
  ['1_Sellers_Property_Disclosure_Statement_-_020_OREF.pdf', '220199105', '020', 'Sellers Property Disclosure Statement', true],
]

let pass = 0
let fail = 0
for (const [fn, mls, expectedOref, expectedForm, expectedHasSale] of cases) {
  const oref = extractOrefNumber(fn)
  const cat = inferKind(fn, '')
  const form = deriveFormName(fn, oref, cat)
  const useSale = !CATEGORIES_WITHOUT_SALE_NUMBER.has(cat)
  const newName = suggestStandardNameV2({
    date: '2025-08-05', seq: 12, executed: false,
    saleNumber: useSale ? mls : '', orefNumber: oref, formName: form,
  })

  const orefOk = oref === expectedOref
  const formOk = expectedForm === '' ? true : form === expectedForm
  const saleOk = useSale === expectedHasSale

  const status = (orefOk && formOk && saleOk) ? 'PASS' : 'FAIL'
  if (status === 'PASS') pass++; else fail++
  console.log(`[${status}] ${fn}`)
  console.log(`       cat=${cat}, oref="${oref}" (want "${expectedOref}"), form="${form}" (want "${expectedForm}"), hasSale=${useSale} (want ${expectedHasSale})`)
  console.log(`       new: ${newName}`)
}
console.log(`\n${pass} pass, ${fail} fail`)
