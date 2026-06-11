import fs from 'node:fs/promises'

const WORK = '/Users/matthewryan/RyanRealty/tmp/huntington-rd-2026-05-28'
const docs = JSON.parse(await fs.readFile(`${WORK}/phase0/documents.json`, 'utf8')).value.documents
const sale = JSON.parse(await fs.readFile(`${WORK}/phase0/sale-detail.json`, 'utf8')).value.sale
const classify = JSON.parse(await fs.readFile(`${WORK}/phase2/classify.json`, 'utf8'))
const SALE_GUID = sale.saleGuid
const activities = sale.checklist.activities
const docToActs = new Map()
for (const a of activities) for (const d of a.checklistDocs||[]) {
  const id = (d.id||'').toLowerCase()
  if (!docToActs.has(id)) docToActs.set(id, [])
  docToActs.get(id).push({ id: a.activityId, name: a.activityName })
}
const actByName = (re) => activities.find((a) => re.test(a.activityName||''))

// Cycle classification per doc — based on filename prefix
function classifyCycle(filename) {
  const f = (filename||'').toLowerCase()
  if (/082124kw/.test(f) || /offer\s*3\b/.test(f)) return { cycle: 'Offer3-082124KW', failed: true }
  if (/081524kw/.test(f) || /offer\s*1\b/.test(f)) return { cycle: 'Offer1-081524KW', failed: true }
  if (/offer\s*2\b/.test(f)) return { cycle: 'Offer2', failed: true }
  if (/offer\s*4\b/.test(f)) return { cycle: 'Offer4', failed: true }
  if (/offer\s*5\b/.test(f)) return { cycle: 'Offer5', failed: true }
  if (/offer\s*6\b/.test(f)) return { cycle: 'Offer6-CLOSING', failed: false }
  if (/sciaraffoll/.test(f)) return { cycle: 'Sciaraffoll-CLOSING', failed: false }
  return { cycle: null, failed: null }
}

const planActions = { renames: [], unassigns: [], assigns: [], cross_links: [] }

// Image artifacts → ARCHIVE
for (const c of classify) {
  if (c.type === 'non-pdf' || /^image\d/i.test(c.filename) || /\.(jpg|jpeg|png|gif)$/i.test(c.filename)) {
    const ext = c.filename.match(/\.([a-z0-9]{2,4})$/i)?.[1] || 'jpg'
    const stem = c.filename.replace(/\.[a-z0-9]{2,4}$/i, '')
    planActions.renames.push({
      docId: c.docId, short8: c.short8, currentName: c.filename,
      newName: `ARCHIVE - ${stem} - outlook signature artifact.${ext}`,
      reason: 'Outlook signature image artifact', action: 'archive_rename'
    })
    for (const a of (docToActs.get(c.docId.toLowerCase())||[])) planActions.unassigns.push({
      docId: c.docId, short8: c.short8, currentName: c.filename,
      activityId: a.id, activityName: a.name, reason: 'image artifact'
    })
  }
}

// Failed-cycle docs → ARCHIVE
for (const c of classify) {
  if (c.type === 'non-pdf') continue
  const cyc = classifyCycle(c.filename)
  if (cyc.failed) {
    const orefLabel = c.constituent_forms?.[0]?.oref ? `_${c.constituent_forms[0].oref}` : ''
    const stem = c.filename.replace(/\.pdf$/i, '')
    planActions.renames.push({
      docId: c.docId, short8: c.short8, currentName: c.filename,
      newName: `ARCHIVE - ${stem} - failed cycle ${cyc.cycle}.pdf`,
      reason: `Failed-cycle doc from ${cyc.cycle}`, action: 'archive_rename', cycle: cyc.cycle
    })
    for (const a of (docToActs.get(c.docId.toLowerCase())||[])) planActions.unassigns.push({
      docId: c.docId, short8: c.short8, currentName: c.filename,
      activityId: a.id, activityName: a.name, reason: `failed cycle ${cyc.cycle}`
    })
  }
}

// Misclassified docs by name (filename doesn't match activity name)
const misclassMap = [
  { test: /notice of final agreement/i, activity_re: /Sale Addendums/i, reason: 'OREF 028 Notice of Final Agreement belongs on Sale Addendums' },
  { test: /advisory regarding septic wells/i, activity_re: /^Sale Addendums$/i, reason: 'Septic wells advisory belongs on Sale Addendums' },
  { test: /advisory regarding manufactured home/i, activity_re: /Sale Addendums/i, reason: 'Manufactured Home advisory not VA/FHA Amendatory' },
  { test: /sellers property disclosure statement exemption/i, activity_re: /Sellers Property Disclosure/i, reason: 'SPD Exemption belongs with SPDs not LBP' },
  { test: /advisory regarding electronic funds/i, activity_re: /Electronic Funds Advisory/i, reason: 'EFA' },
  { test: /advisory regarding firpta/i, activity_re: /FIRPTA Advisory/i, reason: 'FIRPTA' },
  { test: /advisory regarding smoke/i, activity_re: /Smoke Alarms Advisory/i, reason: 'Smoke alarms' },
  { test: /buyer rep|buyer representation/i, activity_re: /Buyers Rep/i, reason: 'Buyer Rep' },
  { test: /initial agency disclosure pamphlet/i, activity_re: /Initial Agency Disclosure/i, reason: 'OREF 042' },
]
for (const c of classify) {
  if (c.type === 'non-pdf') continue
  const cyc = classifyCycle(c.filename)
  if (cyc.failed) continue  // already handled
  const currentActs = docToActs.get(c.docId.toLowerCase())||[]
  for (const hint of misclassMap) {
    if (hint.test.test(c.filename)) {
      const targetAct = activities.find((a) => hint.activity_re.test(a.activityName||''))
      if (targetAct) {
        const alreadyOnTarget = currentActs.some((x) => x.id === targetAct.activityId)
        if (!alreadyOnTarget) {
          // unassign from wrong + assign to right
          for (const a of currentActs) planActions.unassigns.push({
            docId: c.docId, short8: c.short8, currentName: c.filename,
            activityId: a.id, activityName: a.name, reason: `misclassified — should be on ${targetAct.activityName}`
          })
          planActions.assigns.push({
            docId: c.docId, short8: c.short8, targetActivityId: targetAct.activityId,
            targetActivityName: targetAct.activityName, currentActivities: currentActs,
            reason: hint.reason
          })
        }
        break
      }
    }
  }
}

// Output summary
const plan = {
  generated_at: new Date().toISOString(),
  saleGuid: SALE_GUID,
  property: '54474 Huntington Road, Bend OR 97707',
  summary: {
    renames_total: planActions.renames.length,
    archive_renames: planActions.renames.filter((r) => r.action === 'archive_rename').length,
    unassigns: planActions.unassigns.length,
    assigns: planActions.assigns.length,
    cross_links: 0,
    broker_notes_needed: true,
  },
  renames: planActions.renames,
  unassigns: planActions.unassigns,
  assigns: planActions.assigns,
  cross_links: [],
  flags_for_human: [
    { severity: 'data_drift', issue: 'SkySlope buyers field = "TBD Buyer"; doc-level data needed for actual buyer name', recommendation: 'Verify against final RSA + ALTA Settlement' },
  ],
  scope_notes: [
    'In-session mechanical cleanup. Pattern-based classification using filename + pdfjs OREF header. No vision sig validation, no orphan envelope detection, no internal-bundle detection (the v2 skill features that require vision OCR).',
    `${classify.filter((c) => c.is_bundle).length} bundles detected via OREF header scan but not cross-linked (would need vision).`,
    'Failed cycles archived by filename prefix matching.',
  ]
}

await fs.writeFile(`${WORK}/phase5-plan.json`, JSON.stringify(plan, null, 2))
console.log('Plan written.')
console.log('Renames:', plan.renames.length, '(archive:', plan.summary.archive_renames+')')
console.log('Unassigns:', plan.unassigns.length)
console.log('Assigns:', plan.assigns.length)
