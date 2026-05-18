/**
 * Map a SkySlope document (its category, OREF#, source filename) to the
 * ordered list of checklist activityName candidates it could belong to.
 *
 * The actual activity used is the FIRST candidate that exists in the
 * target folder's checklist (since SkySlope folders sometimes have
 * different activity sets — e.g. "Residential Sale Agreement" vs
 * "Residential Purchase Agreement").
 */

/**
 * Match input keywords against a filename. Case-insensitive substring.
 */
function fnMatch(fileName, ...keywords) {
  const fn = String(fileName || '').toLowerCase()
  return keywords.some((k) => fn.includes(String(k).toLowerCase()))
}

/**
 * Build the ordered candidate list of activityName strings for a doc.
 *
 * @param {object} doc      { category, orefNumber, fileName }
 * @param {'listing'|'sale'} folderKind
 * @returns {string[]}      activityName candidates, most-specific first
 */
export function classifyToActivityCandidates(doc, folderKind) {
  const fn = String(doc.fileName || '')
  const oref = String(doc.orefNumber || '').padStart(3, '0')
  const cat = String(doc.category || '')
  const candidates = []

  function push(...names) {
    for (const n of names) if (n && !candidates.includes(n)) candidates.push(n)
  }

  // --- Hard maps by OREF# (most specific) ---
  if (oref === '042') push('Initial Agency Disclosure (042 | 10.4)')
  if (oref === '015') push('Listing Agreement and SA (015 | 9.3)')
  if (oref === '001') push('Residential Sale Agreement', 'Residential Purchase Agreement')
  if (oref === '002') push('Sale Addendums')
  if (oref === '003') push('Counter Offers')
  if (oref === '020' || oref === '022') push('Sellers Property Disclosures')
  if (oref === '040' || oref === '041' || oref === '050') push('Buyers Rep Agreement')
  if (oref === '043' || oref === '044') push('Electronic Funds Advisory')
  if (oref === '047' || oref === '048') push('Real Estate Compensation Advisory')
  if (oref === '080') push('Smoke Alarms Advisory')
  if (oref === '092') push('FIRPTA Advisory')
  if (oref === '108') push('Real Estate Forms Advisory')
  if (oref === '103') push('Real Estate Forms Advisory')

  // --- By filename keywords (specific signals only — no broad fallbacks) ---
  if (fnMatch(fn, 'lead based paint', 'lead-based paint')) {
    if (fnMatch(fn, 'advisory')) push('Lead Based Paint Advisory')
    else push('Lead Based Paint Disclosure')
  }
  if (fnMatch(fn, 'Disclosed Limited Agency', 'DLA ')) push('Disclosed Limited Agency')
  if (fnMatch(fn, 'Owner Association') && fnMatch(fn, 'Addendum')) push('Owner Association Addendum')
  if (fnMatch(fn, 'Solar') && fnMatch(fn, 'Addendum')) push('Solar Panel Addendum')
  if (fnMatch(fn, 'Wood Stove', 'Fireplace Insert')) push('Wood Stove Fireplace Insert Addendum')
  if (fnMatch(fn, 'Professional Inspection') || (fnMatch(fn, 'Inspection') && fnMatch(fn, 'Addendum'))) {
    push('Professional Inspection Addendum')
  }
  if (fnMatch(fn, 'Repair Addendum', 'Repair-Addendum')) push('Repair Addendums')
  if (fnMatch(fn, 'Repair Receipt', 'Documentation of Repairs')) push('Documentation of Repairs or Maintenance')
  if (fnMatch(fn, 'Delivery Addendum')) push('Delivery Addendum')
  if (fnMatch(fn, 'Contingency Removal', 'Contingency-Removal')) push('Contingency Removal Addendum')
  if (fnMatch(fn, 'Contingent Right', 'Contingent-Right')) push('Contingent Right To Purchase')
  if (fnMatch(fn, 'Agreement to Occupy', 'occupancy agreement')) push('Agreement to Occupy')
  if (fnMatch(fn, 'Bill of Sale')) push('Bill Of Sale')
  // VA/FHA Ammendatory: filename must literally say "Amendatory" or
  // "Ammendatory". Don't fire on every doc that mentions VA or FHA.
  if (fnMatch(fn, 'Amendatory Clause', 'Ammendatory Clause')) push('VA/FHA Ammendatory Clause')
  if (fnMatch(fn, 'Earnest Money Receipt', 'EM_Receipt', 'EM Receipt')) push('Earnest Money Receipt')
  if (fnMatch(fn, 'Pre-Approval', 'PreApproval', 'Pre Approval', 'Proof of Funds')) {
    push('Pre Approval Letter or Proof of Funds', 'Pre Approval Letter or Proof of Funds ')
  }
  if (fnMatch(fn, 'Preliminary Title', 'Title Report')) push('Preliminary Title Report')
  if (fnMatch(fn, 'HUD', 'Closing Statement', 'Final Closing', 'Closing Disclosure')) push('Final HUD')
  if (fnMatch(fn, 'Commission Demand', 'Commission From Title')) push('Broker Commission Demand from Title')
  if (fnMatch(fn, 'CMA ', 'Comparables', 'Comparative Market')) push('CMA or Comparables')
  if (fnMatch(fn, 'Net Sheet', 'Estimated Net')) push('Sellers Estimated Net Sheet')
  if (fnMatch(fn, 'Change Form', 'Status Date Price', 'Status_ Date_ Price', 'Listing Change')) push('Listing Change Forms')
  if (fnMatch(fn, 'Residential Input', 'MLS Input', 'ODS Input', 'ORE Residential Input')) push('MLS Residential Input Form (ODS)')
  if (fnMatch(fn, 'Cancellation', 'Expired MLS')) push('Cancellation Listing/Expired MLS Page')
  if (fnMatch(fn, 'Appraisal')) push('Appraisal')
  if (fnMatch(fn, 'Home Inspection') && !fnMatch(fn, 'Addendum')) push('Home Inspection')
  if (fnMatch(fn, 'HOA Docs', 'CCRs', 'CC&R', 'Covenants Conditions')) push('CCRs', 'Association Documents')
  if (fnMatch(fn, 'Association Documents', 'HOA Delivery')) push('Association Documents')
  if (fnMatch(fn, 'Association Advisory')) push('Association Advisory')
  if (fnMatch(fn, 'Termination of Contract', 'Termination Of Contract')) push('Termination of Contract')
  if (fnMatch(fn, 'Notice to Buyer', 'Notice to Seller', 'Notice to Perform')) push('Notice to Buyer | Seller')
  if (fnMatch(fn, 'Receipt for Documents')) push('Receipt for Documents')
  if (fnMatch(fn, 'Extension of Time', 'Time Addendum')) push('Extension of Time Addendum')
  if (fnMatch(fn, 'Broker Notes', 'Note from Broker')) push('Broker Notes')
  if (fnMatch(fn, 'Transaction Timeline')) push('Transaction Timeline')
  if (fnMatch(fn, 'Record of Properties', 'Showing Record')) push('Record of Properties Shown')
  if (fnMatch(fn, 'FIRPTA')) push('FIRPTA Advisory')
  if (fnMatch(fn, 'Smoke Alarm', 'Carbon Monoxide')) push('Smoke Alarms Advisory')
  if (fnMatch(fn, 'Electronic Funds', 'Wire Fraud')) push('Electronic Funds Advisory')
  if (fnMatch(fn, 'Real Estate Compensation', 'Compensation Advisory')) push('Real Estate Compensation Advisory')
  if (fnMatch(fn, 'Real Estate Forms Advisory', 'Forms Advisory')) push('Real Estate Forms Advisory')

  // --- By category (precise fallbacks, no broad catch-alls) ---
  if (cat === 'listing_agreement') push('Listing Agreement and SA (015 | 9.3)')
  if (cat === 'buyer_representation_agreement') push('Buyers Rep Agreement')
  if (cat === 'agency_disclosure_pamphlet') push('Initial Agency Disclosure (042 | 10.4)')
  if (cat === 'sale_agreement_or_rsa') push('Residential Sale Agreement', 'Residential Purchase Agreement')
  if (cat === 'buyer_offer_or_package') push('Residential Sale Agreement', 'Residential Purchase Agreement')
  if (cat === 'counter_or_counteroffer' || cat === 'numbered_counter') {
    push('Counter Offers', 'Counter Offers ')
  }
  if (cat === 'addendum') push('Sale Addendums', 'Sale Addendums ')
  if (cat === 'seller_property_disclosure') push('Sellers Property Disclosures')
  if (cat === 'inspection_or_repair') push('Home Inspection', 'Documentation of Repairs or Maintenance')
  if (cat === 'lender_financing') push('Pre Approval Letter or Proof of Funds', 'Pre Approval Letter or Proof of Funds ')
  if (cat === 'earnest_or_wire') push('Earnest Money Receipt')
  if (cat === 'title_or_hoa') push('Preliminary Title Report', 'Association Documents', 'CCRs')
  if (cat === 'termination_or_release') push('Termination of Contract', 'Termination of Contract ')
  if (cat === 'amendment_or_notice') push('Notice to Buyer | Seller')
  if (cat === 'closing_adjacent') push('Final HUD', 'Broker Commission Demand from Title')

  // --- Last-resort catch-all ONLY for sale folders (Misc activity exists)
  // For listing folders, leave unmatched docs as `no_activity_match` so they
  // can be reviewed instead of dumped into a generic bucket.
  if (folderKind === 'sale' && candidates.length === 0) {
    push('Miscellaneous Documentation', 'Miscellaneous Documentation ')
  }

  return candidates
}

/**
 * Look up the first candidate activity that exists in the folder's
 * checklist. Returns { activity, candidate } or null when no candidate
 * matches the folder's activities.
 *
 * @param {object[]} activities  folder.checklist.activities array
 * @param {string[]} candidates
 */
export function pickActivity(activities, candidates) {
  if (!Array.isArray(activities) || activities.length === 0) return null
  // Build a lookup: normalized activityName → activity object.
  const byName = new Map()
  for (const a of activities) {
    const n = String(a.activityName || '').trim()
    if (n) byName.set(n.toLowerCase(), a)
  }
  for (const cand of candidates) {
    const a = byName.get(String(cand).trim().toLowerCase())
    if (a) return { activity: a, candidate: cand }
  }
  // Loose match: trim trailing spaces, special chars.
  for (const cand of candidates) {
    const candStr = String(cand).trim().toLowerCase()
    for (const a of activities) {
      const an = String(a.activityName || '').trim().toLowerCase()
      if (an === candStr) return { activity: a, candidate: cand }
      if (an.replace(/\s+/g, ' ') === candStr.replace(/\s+/g, ' ')) {
        return { activity: a, candidate: cand }
      }
    }
  }
  return null
}
