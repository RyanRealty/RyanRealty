import fs from 'node:fs/promises'

const WORK = '/Users/matthewryan/RyanRealty/tmp/crowson-rd-2026-05-28'
const docs = JSON.parse(await fs.readFile(`${WORK}/phase0/documents.json`, 'utf8')).value.documents
const sale = JSON.parse(await fs.readFile(`${WORK}/phase0/sale-detail.json`, 'utf8')).value.sale
const activities = sale.checklist.activities
const docToActs = new Map()
for (const a of activities) for (const d of a.checklistDocs||[]) {
  const id = (d.id||'').toLowerCase()
  if (!docToActs.has(id)) docToActs.set(id, [])
  docToActs.get(id).push({ id: a.activityId, name: a.activityName })
}

const renames = []
const unassigns = []
const assigns = []

// 1. Archive "Offer 2" failed-cycle docs
for (const d of docs) {
  if (/^offer\s*2\b/i.test(d.fileName||'')) {
    const stem = d.fileName.replace(/\.pdf$/i,'')
    renames.push({ docId: d.id, short8: d.id.substring(0,8), currentName: d.fileName, newName: `ARCHIVE - ${stem} - failed Offer 2 cycle.pdf`, reason: 'Offer 2 failed cycle', action: 'archive_rename' })
    for (const a of (docToActs.get(d.id.toLowerCase())||[])) unassigns.push({ docId: d.id, short8: d.id.substring(0,8), currentName: d.fileName, activityId: a.id, activityName: a.name, reason: 'Offer 2 failed cycle' })
  }
}

// 2. Archive image files / non-PDFs
for (const d of docs) {
  if (/\.(jpg|jpeg|png|gif)$/i.test(d.fileName||'') || /noname/i.test(d.fileName||'')) {
    const ext = d.fileName.match(/\.([a-z0-9]{2,4})$/i)?.[1]
    const stem = d.fileName.replace(/\.[a-z0-9]{2,4}$/i,'')
    renames.push({ docId: d.id, short8: d.id.substring(0,8), currentName: d.fileName, newName: ext ? `ARCHIVE - ${stem} - artifact.${ext}` : `ARCHIVE - ${stem || 'artifact'}.bin`, reason: 'Outlook signature or image artifact', action: 'archive_rename' })
    for (const a of (docToActs.get(d.id.toLowerCase())||[])) unassigns.push({ docId: d.id, short8: d.id.substring(0,8), currentName: d.fileName, activityId: a.id, activityName: a.name, reason: 'image artifact' })
  }
}

// 3. Fix misclassifications
const map = [
  { test: /wire fraud advisory/i, activity_re: /Sale Addendums/i, reason: 'Wire Fraud Advisory belongs on Sale Addendums, not Earnest Money Receipt' },
  { test: /advisory regarding septic wells/i, activity_re: /Sale Addendums/i, reason: 'Septic Wells Advisory belongs on Sale Addendums' },
]
for (const d of docs) {
  // Skip docs we're already archiving
  if (renames.some((r) => r.docId === d.id)) continue
  const currentActs = docToActs.get(d.id.toLowerCase())||[]
  for (const hint of map) {
    if (hint.test.test(d.fileName||'')) {
      const target = activities.find((a) => hint.activity_re.test(a.activityName||''))
      if (target) {
        const alreadyOn = currentActs.some((x) => x.id === target.activityId)
        if (!alreadyOn) {
          for (const a of currentActs) unassigns.push({ docId: d.id, short8: d.id.substring(0,8), currentName: d.fileName, activityId: a.id, activityName: a.name, reason: `misclassified - should be on ${target.activityName}` })
          assigns.push({ docId: d.id, short8: d.id.substring(0,8), targetActivityId: target.activityId, targetActivityName: target.activityName, currentActivities: currentActs, reason: hint.reason })
        }
        break
      }
    }
  }
}

const plan = {
  generated_at: new Date().toISOString(),
  saleGuid: sale.saleGuid,
  property: '534 Crowson Rd, Ashland OR 97520',
  summary: { renames_total: renames.length, archive_renames: renames.length, unassigns: unassigns.length, assigns: assigns.length, cross_links: 0, broker_notes_needed: true },
  renames, unassigns, assigns, cross_links: [],
  flags_for_human: [
    { severity: 'data_drift', issue: 'SkySlope buyers="TBD Buyer", sellers="TBD Seller". Doc-level data not extracted in this pass.', recommendation: 'Verify against final RSA' },
    { severity: 'scope_note', issue: 'Ashland sale uses Oregon REALTORS forms (Final Agency Acknowledgement) NOT the OREF library. v2 skill OREF-based classification does not apply.', recommendation: 'Different validation approach needed for Ashland (southern OR) folders.' },
  ],
}

await fs.writeFile(`${WORK}/phase5-plan.json`, JSON.stringify(plan, null, 2))
console.log('renames:', renames.length, 'unassigns:', unassigns.length, 'assigns:', assigns.length)
