import { describe, expect, it } from 'vitest'
import {
  CYCLE_FIELD_SPECS,
  changedRawKeys,
  cycleFieldsFromDetail,
  cyclePlanIsEmpty,
  decideDealStage,
  decideField,
  deriveDealStage,
  detailIsUsable,
  documentStoragePath,
  matchDealForProperty,
  parseArchiveName,
  planCycleIntake,
  propertyFromDetail,
  propertyPriority,
  sameRaw,
  skySlopeDocumentsForIntake,
  skySlopeIntakeEnabled,
  stageFactsFromDetail,
  type CycleField,
  type CyclePlan,
  type StageCycleFacts,
  type VaultContactSnapshot,
  type VaultCycleSnapshot,
} from './skyslope-intake'
import { assertInboundRequest, folderPageIsPastEnd, SKYSLOPE_FILES_BASE } from './skyslope-inbound'

// ── fixtures shaped like the live SkySlope payloads (2026-09-24 probe) ──────

const SALE = '1a2f5e36-eefb-4695-9b6d-547a87aec6a7'
const MATT = '41c18058-6c25-4acb-affc-3afc4ea9ac52'
const DOC_RSA = 'e31b37ac-9a5a-f111-bb41-12f8d622e63f'
const DOC_COUNTER = '6b680d8a-9a2f-4a65-8052-3ab7c40c0f7a'
const DOC_HUD = '97574613-c7b7-4e35-bad0-32f3172ee981'

type Obj = Record<string, unknown>

function presigned(seed: number): string {
  return `https://skyslope-documents.s3.amazonaws.com/7e02ee6a${seed}?X-Amz-Expires=300&x-amz-security-token=tok${seed}&X-Amz-Signature=sig${seed}`
}

function saleDetail(over: Obj = {}, seed = 1): Obj {
  return {
    saleGuid: SALE,
    listingGuid: 'ae17cded-5593-40d2-84b9-2102422fca13',
    status: 'Pending',
    agentGuid: MATT,
    mlsNumber: '220199105',
    escrowNumber: '',
    salePrice: 519000,
    listingPrice: 539000,
    contractAcceptanceDate: '2026-05-14T00:00:00',
    escrowClosingDate: '2026-06-23T00:00:00',
    actualClosingDate: null,
    deadDate: null,
    createdOn: '2026-05-28T06:31:01.493',
    portalEmail: 'BeaumontDrive20702@skyslope.com',
    checklistType: 'Residential — Standard',
    sellers: [{ firstName: 'Mary', lastName: 'Bowman', contactGuid: 'seller-1' }],
    buyers: [{ firstName: 'Tyler', lastName: 'Nicoll', contactGuid: 'buyer-1' }],
    commission: { officeGrossCommissionOnSale: 15570, saleCommissionPercent: 2.5 },
    earnestMoneyDeposit: { depositAmount: 0 },
    escrowContact: null,
    titleContact: { firstName: 'Yvonne', lastName: 'Ward', company: 'Western Title', email: 'yvonne.ward@westerntitle.com', contactGuid: 'title-1' },
    transactionCoordinators: [{ firstName: 'Jeanette', lastName: 'Argyle', email: 'transactions@bridgetownfiles.com', contactGuid: 'tc-1' }],
    attorneyContact: [],
    property: { streetNumber: '20702', streetAddress: 'Beaumont Drive', direction: null, city: 'Bend', state: 'OR', zip: '97701' },
    checklist: {
      activities: [
        {
          activityId: 1070791269,
          activityName: 'Residential Sale Agreement ',
          typeName: 'Sales Documentation',
          status: 'Completed',
          order: 1,
          // SkySlope sends checklistDocs ids upper-case and a fresh pre-signed URL on every read
          checklistDocs: [{ id: DOC_RSA.toUpperCase(), url: presigned(seed) }],
        },
        { activityId: 1070791270, activityName: 'Counter Offers', typeName: 'Sales Documentation', status: 'Optional', order: 2, checklistDocs: [] },
      ],
    },
    ...over,
  }
}

function saleDocs(seed = 1): Obj[] {
  return [
    { id: DOC_RSA, fileName: 'Sale_Agreement.pdf', fileSize: 1024, pages: 12, uploadDate: '2026-05-28T06:39:42', url: presigned(seed) },
    // the /documents list repeats rows and carries fileSize -1 placeholders
    { id: DOC_RSA, fileName: 'Sale_Agreement.pdf', fileSize: 1024, pages: 12, uploadDate: '2026-05-28T06:39:42', url: presigned(seed) },
    { id: 'ec735d32-8dac-ea11-811c-eed541a21c59', name: 'Canceled Transaction', fileName: '2026_Admin', fileSize: -1 },
    { id: DOC_COUNTER, fileName: 'ARCHIVE - Counter 1 - superseded by counter 2.pdf', fileSize: 900, uploadDate: '2026-05-20T10:00:00', url: presigned(seed + 1) },
  ]
}

/** What scripts/tc-migrate-from-skyslope.mjs left on a cycle: the mapping, minus the four columns master.json never carried. */
function migratedFields(detail: Obj): Partial<Record<CycleField, unknown>> {
  const f: Partial<Record<CycleField, unknown>> = { ...cycleFieldsFromDetail(detail) }
  for (const s of CYCLE_FIELD_SPECS) if (!s.migrationCarried) f[s.column] = null
  return f
}

/**
 * A cycle as the Vault holds it after an import of `detail` with every
 * document, item and assignment. `by: 'migration'` leaves the four columns
 * master.json never carried as null (what the 2026-06-10 migration wrote);
 * `by: 'intake'` is the state after an earlier intake run.
 */
function migratedSnapshot(
  detail: Obj,
  docs: Obj[],
  by: 'migration' | 'intake' = 'migration',
): { snapshot: VaultCycleSnapshot; contacts: VaultContactSnapshot[] } {
  const plan = planCycleIntake({ skyslopeKind: 'sales', guid: SALE, detail, documents: docs, vault: null, dealContacts: [] })
  const applied = simulateApply(
    { id: 'cycle-1', dealId: 'deal-1', fields: {}, raw: {}, documents: [], items: [], assignments: [] },
    [],
    plan,
    detail,
  )
  const fields = by === 'migration' ? migratedFields(detail) : applied.snapshot.fields
  return { snapshot: { ...applied.snapshot, fields }, contacts: applied.contacts }
}

/**
 * The writes lib/data/tc/skyslope-intake.ts makes for a plan, applied to an
 * in-memory Vault: new rows added, unedited fields updated, raw refreshed.
 */
function simulateApply(
  snapshot: VaultCycleSnapshot,
  contacts: VaultContactSnapshot[],
  plan: CyclePlan,
  detail: Obj,
): { snapshot: VaultCycleSnapshot; contacts: VaultContactSnapshot[] } {
  const fields = { ...(plan.insertFields ?? snapshot.fields) }
  for (const u of plan.fieldUpdates) fields[u.field] = u.to
  const documents = [...snapshot.documents, ...plan.documentsToAdd.map((d) => ({ id: `doc-${d.key}`, sourceDocId: d.docId, archived: d.archived }))]
  const statusTo = new Map(plan.itemStatusUpdates.map((u) => [u.itemId, u.to]))
  const items = [
    ...snapshot.items.map((i) => (statusTo.has(i.id) ? { ...i, status: statusTo.get(i.id)! } : i)),
    ...plan.itemsToAdd.map((a) => ({ id: `item-${a.activityId}`, sourceActivityId: a.activityId, status: a.status })),
  ]
  const itemId = new Map(items.map((i) => [i.sourceActivityId, i.id]))
  const docId = new Map(documents.map((d) => [(d.sourceDocId ?? '').toLowerCase(), d.id]))
  const assignments = [
    ...snapshot.assignments,
    ...plan.assignmentsToAdd.map((a) => ({ itemId: itemId.get(a.activityId)!, documentId: docId.get(a.docKey)! })),
  ]
  return {
    snapshot: { ...snapshot, fields, raw: detail, documents, items, assignments },
    contacts: [...contacts, ...plan.contactsToAdd.map((c) => ({ role: c.role, email: c.email, name: c.name, source_contact_guid: c.source_contact_guid }))],
  }
}

function plan(detail: Obj, docs: Obj[], vault: VaultCycleSnapshot | null, contacts: VaultContactSnapshot[] = []): CyclePlan {
  return planCycleIntake({ skyslopeKind: 'sales', guid: SALE, detail, documents: docs, vault, dealContacts: contacts })
}

// ── the switch ──────────────────────────────────────────────────────────────

describe('TC_SKYSLOPE_INTAKE_ENABLED (the cutover switch)', () => {
  it('is on by default and off only when set to a false word', () => {
    expect(skySlopeIntakeEnabled({})).toBe(true)
    expect(skySlopeIntakeEnabled({ TC_SKYSLOPE_INTAKE_ENABLED: 'true' })).toBe(true)
    for (const v of ['false', 'FALSE', '0', 'off', 'no', 'disabled']) {
      expect(skySlopeIntakeEnabled({ TC_SKYSLOPE_INTAKE_ENABLED: v })).toBe(false)
    }
  })
})

// ── mapping ─────────────────────────────────────────────────────────────────

describe('cycleFieldsFromDetail (the migration mapping)', () => {
  it('maps a sale folder the way the 2026-06-10 migration did', () => {
    const f = cycleFieldsFromDetail(saleDetail({ escrowNumber: '0', salePrice: 0 }))
    expect(f).toMatchObject({
      status: 'Pending',
      mls_number: '220199105',
      escrow_number: null, // '' and '0' are "none"
      sellers: ['Mary Bowman'],
      buyers: ['Tyler Nicoll'],
      sale_price: null, // 0 is "none"
      listing_price: 539000,
      office_gross: 15570,
      commission_percent: 2.5,
      contract_acceptance_date: '2026-05-14',
      escrow_closing_date: '2026-06-23',
      actual_closing_date: null,
      source_created_on: '2026-05-28',
      portal_email: 'BeaumontDrive20702@skyslope.com',
      checklist_type: 'Residential — Standard',
      broker_name: 'Matt Ryan',
    })
    expect('earnest_money' in f).toBe(false)
  })

  it('refuses an error stub or another folder as the detail', () => {
    expect(detailIsUsable('sales', SALE, saleDetail())).toBe(true)
    expect(detailIsUsable('sales', SALE, { __error: 404 })).toBe(false)
    expect(detailIsUsable('sales', SALE, saleDetail({ saleGuid: 'someone-else' }))).toBe(false)
  })
})

describe('decideField (never overwrite Vault work)', () => {
  const status = CYCLE_FIELD_SPECS.find((s) => s.column === 'status')!
  const portal = CYCLE_FIELD_SPECS.find((s) => s.column === 'portal_email')!
  const price = CYCLE_FIELD_SPECS.find((s) => s.column === 'sale_price')!

  it('updates when the Vault still holds what the previous import wrote', () => {
    expect(decideField(status, { vault: 'Pending', before: 'Pending', now: 'Closed' })).toEqual({ kind: 'update', from: 'Pending', to: 'Closed' })
  })
  it('keeps a Vault edit and records drift when SkySlope also changed', () => {
    expect(decideField(price, { vault: 520000, before: 519000, now: 525000 })).toEqual({
      kind: 'drift',
      vault: 520000,
      skyslopeBefore: 519000,
      skyslopeNow: 525000,
    })
  })
  it('keeps a Vault edit silently when SkySlope did not change', () => {
    expect(decideField(price, { vault: 520000, before: 519000, now: 519000 })).toEqual({ kind: 'vault_edit' })
  })
  it('does nothing when the Vault already holds the SkySlope value', () => {
    expect(decideField(price, { vault: '519000', before: 1, now: 519000 })).toEqual({ kind: 'same' })
  })
  it('fills a column the migration never carried (it wrote null), but never over a Vault value', () => {
    expect(decideField(portal, { vault: null, before: 'a@skyslope.com', now: 'a@skyslope.com' })).toMatchObject({ kind: 'update' })
    expect(decideField(portal, { vault: 'broker@typed.it', before: 'a@skyslope.com', now: 'a@skyslope.com' })).toEqual({ kind: 'vault_edit' })
  })
})

// ── the four behaviors the intake is built on ──────────────────────────────

describe('planCycleIntake: a folder the Vault lacks is added', () => {
  it('adds the cycle with its documents, checklist items, assignments and contacts', () => {
    const p = plan(saleDetail(), saleDocs(), null)
    expect(p.mode).toBe('add')
    expect(p.kind).toBe('sale')
    expect(p.insertFields).toMatchObject({ status: 'Pending', sale_price: 519000 })
    // duplicate rows and the fileSize -1 placeholder are dropped, like the migration
    expect(p.documentsToAdd.map((d) => d.key)).toEqual([DOC_RSA, DOC_COUNTER])
    const counter = p.documentsToAdd.find((d) => d.key === DOC_COUNTER)!
    expect(counter.archived).toBe(true)
    expect(counter.archivedReason).toBe('Counter 1 - superseded by counter 2.pdf')
    expect(p.itemsToAdd.map((a) => [a.activityId, a.name, a.status])).toEqual([
      [1070791269, 'Residential Sale Agreement', 'completed'],
      [1070791270, 'Counter Offers', 'optional'],
    ])
    // upper-case checklistDocs id links to the lower-case document id
    expect(p.assignmentsToAdd).toEqual([{ activityId: 1070791269, docKey: DOC_RSA }])
    expect(p.contactsToAdd.map((c) => [c.role, c.name, c.source_contact_guid])).toEqual([
      ['title', 'Yvonne Ward', 'title-1'],
      ['transaction_coordinator', 'Jeanette Argyle', 'tc-1'],
    ])
    expect(p.fieldUpdates).toEqual([])
    expect(p.drift).toEqual([])
  })

  it('skips a contact already on the deal (same guid, or same role and email under another guid)', () => {
    const p = plan(saleDetail(), saleDocs(), null, [
      { role: 'title', email: 'YVONNE.WARD@westerntitle.com', name: 'Yvonne Ward', source_contact_guid: 'other-cycle-guid' },
      { role: 'transaction_coordinator', email: null, name: null, source_contact_guid: 'tc-1' },
    ])
    expect(p.contactsToAdd).toEqual([])
  })
})

describe('planCycleIntake: an unedited cycle takes SkySlope changes', () => {
  it('updates status and dates when the Vault still matches the previous payload (Beaumont 2026-07-09 close)', () => {
    const { snapshot, contacts } = migratedSnapshot(saleDetail(), saleDocs())
    const closed = saleDetail({ status: 'Closed', escrowClosingDate: '2026-07-09T00:00:00', actualClosingDate: '2026-07-09T00:00:00' }, 2)
    const p = plan(closed, saleDocs(2), snapshot, contacts)
    expect(p.mode).toBe('existing')
    const byField = Object.fromEntries(p.fieldUpdates.map((u) => [u.field, [u.from, u.to]]))
    expect(byField.status).toEqual(['Pending', 'Closed'])
    expect(byField.escrow_closing_date).toEqual(['2026-06-23', '2026-07-09'])
    expect(byField.actual_closing_date).toEqual([null, '2026-07-09'])
    expect(p.drift).toEqual([])
    expect(p.rawChanged).toBe(true)
    expect(p.rawChangedKeys).toEqual(['actualClosingDate', 'escrowClosingDate', 'status'])
    expect(p.documentsToAdd).toEqual([])
  })
})

describe('planCycleIntake: a Vault edit is kept and the drift recorded', () => {
  it('keeps the Vault value when both sides changed, and says nothing when only the Vault did', () => {
    const { snapshot, contacts } = migratedSnapshot(saleDetail(), saleDocs())
    // A broker corrected price and escrow number in the Vault (settlement-verified values).
    const edited = { ...snapshot, fields: { ...snapshot.fields, sale_price: 520000, escrow_number: 'WT0286975' } }
    const p = plan(saleDetail({ salePrice: 525000 }, 3), saleDocs(3), edited, contacts)
    // only the two never-carried columns the migration left null are filled
    expect(p.fieldUpdates.map((u) => u.field)).toEqual(['portal_email', 'checklist_type'])
    expect(p.drift).toEqual([{ field: 'sale_price', vault: 520000, skyslopeBefore: 519000, skyslopeNow: 525000 }])
    expect(p.vaultEdits).toContain('escrow_number')
  })
})

describe('planCycleIntake: archived documents stay exactly as the Vault has them', () => {
  it('never re-adds, un-archives or re-assigns a document the Vault archived', () => {
    const { snapshot, contacts } = migratedSnapshot(saleDetail(), saleDocs())
    // The document reader archived the RSA copy and dropped its assignment.
    const vault: VaultCycleSnapshot = {
      ...snapshot,
      documents: snapshot.documents.map((d) => (d.sourceDocId === DOC_RSA ? { ...d, archived: true } : d)),
      assignments: [],
    }
    // SkySlope still lists the RSA live, assigns it to a second activity, and
    // renames the counter ARCHIVE… (the Vault already has it archived).
    const detail = saleDetail(
      {
        checklist: {
          activities: [
            { activityId: 1070791269, activityName: 'Residential Sale Agreement', status: 'Completed', order: 1, checklistDocs: [{ id: DOC_RSA.toUpperCase() }] },
            { activityId: 1070791270, activityName: 'Counter Offers', status: 'Optional', order: 2, checklistDocs: [{ id: DOC_RSA.toUpperCase() }] },
          ],
        },
      },
      4,
    )
    const p = plan(detail, saleDocs(4), vault, contacts)
    expect(p.documentsToAdd).toEqual([])
    expect(p.assignmentsToAdd).toEqual([])
    // the old assignment was removed in the Vault: not put back
    expect(p.assignmentsRemovedInVault).toBe(1)
    // the new one names a document the Vault archived: kept off, recorded
    expect(p.assignmentsOnVaultArchived).toEqual([{ activityId: 1070791270, docKey: DOC_RSA }])
  })

  it('leaves a live Vault document live when SkySlope renames it ARCHIVE…', () => {
    const { snapshot, contacts } = migratedSnapshot(saleDetail(), [saleDocs()[0]], 'intake')
    const docs = [{ ...saleDocs()[0], fileName: 'ARCHIVE - Sale_Agreement.pdf' }]
    const p = plan(saleDetail({}, 5), docs, snapshot, contacts)
    expect(p.documentsToAdd).toEqual([])
    expect(p.archivedInSkySlopeOnly).toEqual(['ARCHIVE - Sale_Agreement.pdf'])
    expect(cyclePlanIsEmpty(p)).toBe(true)
  })

  it('does not put back a checklist item or contact the Vault removed', () => {
    const { snapshot, contacts } = migratedSnapshot(saleDetail(), saleDocs())
    const vault = { ...snapshot, items: snapshot.items.filter((i) => i.sourceActivityId !== 1070791270) }
    const p = plan(saleDetail({}, 6), saleDocs(6), vault, contacts.filter((c) => c.role !== 'title'))
    expect(p.itemsToAdd).toEqual([])
    expect(p.itemsRemovedInVault).toBe(1)
    expect(p.contactsToAdd).toEqual([])
    expect(p.contactsRemovedInVault).toBe(1)
  })

  it('adds a document, item and contact that are new in SkySlope', () => {
    const { snapshot, contacts } = migratedSnapshot(saleDetail(), saleDocs())
    const detail = saleDetail(
      {
        lenderContact: { firstName: 'Lou', lastName: 'Lender', email: 'lou@bank.com', contactGuid: 'lender-1' },
        checklist: {
          activities: [
            ...((saleDetail().checklist as Obj).activities as Obj[]),
            { activityId: 1070791299, activityName: 'Final HUD', status: 'Required', order: 9, checklistDocs: [{ id: DOC_HUD.toUpperCase() }] },
          ],
        },
      },
      7,
    )
    const docs = [...saleDocs(7), { id: DOC_HUD, fileName: 'Final_HUD.pdf', fileSize: 5000, uploadDate: '2026-07-09T12:00:00', url: presigned(9) }]
    const p = plan(detail, docs, snapshot, contacts)
    expect(p.documentsToAdd.map((d) => d.key)).toEqual([DOC_HUD])
    expect(p.itemsToAdd.map((a) => a.activityId)).toEqual([1070791299])
    expect(p.assignmentsToAdd).toEqual([{ activityId: 1070791299, docKey: DOC_HUD }])
    expect(p.contactsToAdd.map((c) => c.role)).toEqual(['lender'])
  })
})

// ── checklist status (Matt reviews in SkySlope until the cutover) ───────────

/** saleDetail with one activity's SkySlope status word replaced. */
function withActivityStatus(activityId: number, status: string, seed = 1): Obj {
  const base = saleDetail({}, seed)
  const acts = ((base.checklist as Obj).activities as Obj[]).map((a) => (a.activityId === activityId ? { ...a, status } : a))
  return { ...base, checklist: { ...(base.checklist as Obj), activities: acts } }
}

describe('checklist status: the field rule on one column', () => {
  it('carries an approval made in SkySlope onto an item the Vault left alone', () => {
    const { snapshot, contacts } = migratedSnapshot(withActivityStatus(1070791270, 'In Review'), saleDocs(), 'intake')
    const p = plan(withActivityStatus(1070791270, 'Completed', 2), saleDocs(2), snapshot, contacts)
    expect(p.itemStatusUpdates).toEqual([
      { itemId: 'item-1070791270', activityId: 1070791270, name: 'Counter Offers', from: 'in_review', to: 'completed' },
    ])
    expect(p.itemStatusDrift).toEqual([])
    expect(cyclePlanIsEmpty(p)).toBe(false)
  })

  it('keeps a decision made in the Vault when SkySlope moved the other way, and records it', () => {
    const { snapshot, contacts } = migratedSnapshot(withActivityStatus(1070791270, 'In Review'), saleDocs(), 'intake')
    // Matt sent it back in the Vault (required); SkySlope later shows it completed.
    const vault = { ...snapshot, items: snapshot.items.map((i) => (i.sourceActivityId === 1070791270 ? { ...i, status: 'required' } : i)) }
    const p = plan(withActivityStatus(1070791270, 'Completed', 2), saleDocs(2), vault, contacts)
    expect(p.itemStatusUpdates).toEqual([])
    expect(p.itemStatusDrift).toEqual([
      { itemId: 'item-1070791270', activityId: 1070791270, name: 'Counter Offers', vault: 'required', skyslopeBefore: 'in_review', skyslopeNow: 'completed' },
    ])
  })

  it('does nothing when the Vault already agrees with SkySlope', () => {
    const { snapshot, contacts } = migratedSnapshot(withActivityStatus(1070791270, 'In Review'), saleDocs(), 'intake')
    const vault = { ...snapshot, items: snapshot.items.map((i) => (i.sourceActivityId === 1070791270 ? { ...i, status: 'completed' } : i)) }
    const p = plan(withActivityStatus(1070791270, 'Completed', 2), saleDocs(2), vault, contacts)
    expect(p.itemStatusUpdates).toEqual([])
    expect(p.itemStatusDrift).toEqual([])
  })

  it('never moves an item on a status word it does not know, or without the Vault status', () => {
    const { snapshot, contacts } = migratedSnapshot(withActivityStatus(1070791270, 'In Review'), saleDocs(), 'intake')
    expect(plan(withActivityStatus(1070791270, 'Waived By Broker', 2), saleDocs(2), snapshot, contacts).itemStatusUpdates).toEqual([])
    const blind = { ...snapshot, items: snapshot.items.map((i) => ({ id: i.id, sourceActivityId: i.sourceActivityId })) }
    expect(plan(withActivityStatus(1070791270, 'Completed', 2), saleDocs(2), blind, contacts).itemStatusUpdates).toEqual([])
  })

  it('is idempotent: once carried over, the next run changes nothing', () => {
    const { snapshot, contacts } = migratedSnapshot(withActivityStatus(1070791270, 'In Review'), saleDocs(), 'intake')
    const detail = withActivityStatus(1070791270, 'Completed', 2)
    const first = plan(detail, saleDocs(2), snapshot, contacts)
    const after = simulateApply(snapshot, contacts, first, detail)
    const second = plan(withActivityStatus(1070791270, 'Completed', 3), saleDocs(3), after.snapshot, after.contacts)
    expect(second.itemStatusUpdates).toEqual([])
    expect(cyclePlanIsEmpty(second)).toBe(true)
  })
})

describe('idempotent: a second run changes nothing', () => {
  it('after adding a folder', () => {
    const first = plan(saleDetail(), saleDocs(), null)
    const after = simulateApply({ id: 'c', dealId: 'd', fields: {}, raw: {}, documents: [], items: [], assignments: [] }, [], first, saleDetail())
    // SkySlope mints new pre-signed URLs on every read: that is not a change
    const second = plan(saleDetail({}, 42), saleDocs(42), after.snapshot, after.contacts)
    expect(cyclePlanIsEmpty(second)).toBe(true)
  })

  it('after field updates, a kept drift and new documents', () => {
    const { snapshot, contacts } = migratedSnapshot(saleDetail(), saleDocs())
    const edited = { ...snapshot, fields: { ...snapshot.fields, sale_price: 520000 } }
    const detail = saleDetail({ status: 'Closed', actualClosingDate: '2026-07-09T00:00:00', salePrice: 525000 }, 8)
    const docs = [...saleDocs(8), { id: DOC_HUD, fileName: 'Final_HUD.pdf', fileSize: 5000, url: presigned(10) }]
    const first = plan(detail, docs, edited, contacts)
    expect(first.fieldUpdates.map((u) => u.field)).toEqual(expect.arrayContaining(['status', 'actual_closing_date', 'portal_email', 'checklist_type']))
    expect(first.drift.map((d) => d.field)).toEqual(['sale_price'])
    const after = simulateApply(edited, contacts, first, detail)
    const second = plan(saleDetail({ status: 'Closed', actualClosingDate: '2026-07-09T00:00:00', salePrice: 525000 }, 99), docs, after.snapshot, after.contacts)
    expect(cyclePlanIsEmpty(second)).toBe(true)
    expect(second.vaultEdits).toEqual(['sale_price'])
  })

  it('treats a jsonb round trip (keys reordered) as the same payload', () => {
    const d = saleDetail()
    const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(d).reverse())))
    expect(sameRaw(d, reordered)).toBe(true)
    expect(sameRaw(d, saleDetail({}, 77))).toBe(true)
    expect(changedRawKeys(d, saleDetail({ status: 'Closed' }))).toEqual(['status'])
  })
})

// ── which deal ──────────────────────────────────────────────────────────────

describe('matchDealForProperty', () => {
  const deals = [
    { id: 'deal-3480', propertyKey: '3480-45th', address: '3480 SW 45th Street, Redmond, OR, 97756', city: 'Redmond' },
    { id: 'deal-909', propertyKey: 'inhouse-909-nw-delaware-ave-bend-or-97703-1a2b3c4d', address: '909 NW Delaware Ave, Bend, OR 97703', city: 'Bend' },
    { id: 'deal-apollo', propertyKey: 'inhouse-60935-apollo-place-39ef5266', address: '60935 Apollo Place, Bend, OR 97702', city: 'Bend' },
  ]

  it('puts a new folder on the deal holding the property’s other SkySlope folders', () => {
    const p = propertyFromDetail({ property: { streetNumber: '3480', direction: 'SW', streetAddress: '45th Street', city: 'Redmond', state: 'OR', zip: '97756' } }, null, 'd2b4e1ea')
    expect(matchDealForProperty(p, deals, ['deal-3480'])).toEqual({ kind: 'matched', dealId: 'deal-3480', method: 'cycle' })
    expect(matchDealForProperty(p, deals)).toEqual({ kind: 'matched', dealId: 'deal-3480', method: 'property_key' })
  })

  it('attaches to an in-house file the mail sweep opened, never a duplicate deal', () => {
    const p = propertyFromDetail(
      { property: { streetNumber: '909', direction: 'NW', streetAddress: 'Delaware Avenue', city: 'Bend', state: 'OR', zip: '97703' } },
      null,
      'e97b88c7',
    )
    expect(p.propertyKey).toBe('909-delaware')
    expect(matchDealForProperty(p, deals)).toEqual({ kind: 'matched', dealId: 'deal-909', method: 'address' })
  })

  it('does not match the same street number and name in another city', () => {
    const p = { propertyKey: '909-delaware', address: '909 Delaware Avenue, Redmond, OR, 97756', city: 'Redmond' }
    expect(matchDealForProperty(p, deals)).toEqual({ kind: 'none' })
  })

  it('refuses to guess between two deals', () => {
    const twice = [...deals, { id: 'deal-909b', propertyKey: 'inhouse-909-delaware-9f9f9f9f', address: '909 Delaware Ave', city: null }]
    const p = { propertyKey: '909-delaware', address: '909 NW Delaware Avenue, Bend, OR, 97703', city: 'Bend' }
    expect(matchDealForProperty(p, twice)).toEqual({ kind: 'ambiguous', dealIds: ['deal-909', 'deal-909b'] })
  })

  it('creates nothing when no deal holds the property', () => {
    const p = { propertyKey: '19496-tumalo', address: '19496 Tumalo Reservoir Rd, Bend, OR, 97703', city: 'Bend' }
    expect(matchDealForProperty(p, deals)).toEqual({ kind: 'none' })
  })
})

describe('propertyFromDetail', () => {
  it('writes the directional SkySlope sends as `direction`, once', () => {
    const a = propertyFromDetail({ property: { streetNumber: '3480', direction: 'SW', streetAddress: '45th Street', city: 'Redmond', state: 'OR', zip: '97756' } }, null, 'x')
    expect(a.address).toBe('3480 SW 45th Street, Redmond, OR, 97756')
    const b = propertyFromDetail({ property: { streetNumber: '3480', direction: 'SW', streetAddress: 'SW 45th Street', city: 'Redmond', state: 'OR', zip: '97756' } }, null, 'x')
    expect(b.address).toBe('3480 SW 45th Street, Redmond, OR, 97756')
    expect(a.propertyKey).toBe('3480-45th')
  })
  it('falls back to the folder list address, and a blank folder keys by guid', () => {
    expect(propertyFromDetail({}, '19496 Tumalo Reservoir Rd, Bend, OR 97703', 'x')).toMatchObject({ city: 'Bend', state: 'OR', zip: '97703', propertyKey: '19496-tumalo' })
    expect(propertyFromDetail({ property: { streetNumber: '', streetAddress: '' } }, ', , ', 'f261f38e-0000')).toMatchObject({ address: '(blank)', propertyKey: 'guid-f261f38e' })
  })
})

// ── deal stage ──────────────────────────────────────────────────────────────

function facts(kind: 'sales' | 'listings', guid: string, status: string, over: Partial<StageCycleFacts> = {}): StageCycleFacts {
  return { kind, guid, status, createdOn: null, escrowClosingDate: null, actualClosingDate: null, expirationDate: null, ...over }
}

describe('deal stage follows the newest cycle, only while the Vault stage is unedited', () => {
  it('3480 SW 45th: a second closed sale moves the stage to the newest close', () => {
    const old = facts('sales', '59152e77', 'Closed', { createdOn: '2025-06-20', actualClosingDate: '2025-08-14', escrowClosingDate: '2025-08-14' })
    const neu = facts('sales', 'd2b4e1ea', 'Closed', { createdOn: '2026-07-23T10:21:20', actualClosingDate: '2026-09-01', escrowClosingDate: '2026-09-01' })
    const listing = facts('listings', '8804dca1', 'Transaction', { createdOn: '2026-07-23T10:18:29', expirationDate: '2026-12-31' })
    const d = decideDealStage({ vaultStage: 'closed', vaultStageDetail: 'Closed 2025-08-14', before: [old], now: [old, neu, listing] })
    expect(d).toEqual({ kind: 'update', from: { stage: 'closed', stageDetail: 'Closed 2025-08-14' }, to: { stage: 'closed', stageDetail: 'Closed 2026-09-01' } })
  })

  it('20702 Beaumont: pending → closed', () => {
    const before = [facts('sales', '1a2f5e36', 'Pending', { escrowClosingDate: '2026-06-23' }), facts('sales', 'bb0ad8f9', 'Canceled/App')]
    const now = [facts('sales', '1a2f5e36', 'Closed', { escrowClosingDate: '2026-07-09', actualClosingDate: '2026-07-09' }), facts('sales', 'bb0ad8f9', 'Canceled/App')]
    const d = decideDealStage({ vaultStage: 'pending', vaultStageDetail: 'Under contract — closes 2026-06-23', before, now })
    expect(d).toMatchObject({ kind: 'update', to: { stage: 'closed', stageDetail: 'Closed 2026-07-09' } })
  })

  it('19496 Tumalo: an accepted offer moves the active listing to pending', () => {
    const before = [facts('listings', '5c2e5879', 'Active', { expirationDate: '2026-10-03' })]
    const now = [facts('listings', '5c2e5879', 'Transaction', { expirationDate: '2026-10-03' }), facts('sales', '30155e9b', 'Pending', { escrowClosingDate: '2026-11-30' })]
    const d = decideDealStage({ vaultStage: 'active_listing', vaultStageDetail: 'On market — listing expires 2026-10-03', before, now })
    expect(d).toMatchObject({ kind: 'update', to: { stage: 'pending', stageDetail: 'Under contract — closes 2026-11-30' } })
  })

  it('keeps a stage set in the Vault: drift once when SkySlope first arrives, then nothing', () => {
    const now = [facts('sales', 'e97b88c7', 'Expired')]
    const first = decideDealStage({ vaultStage: 'pre_contract', vaultStageDetail: 'Opened from email: confirm side and stage', before: [], now })
    expect(first).toMatchObject({ kind: 'drift', vault: { stage: 'pre_contract' }, skyslopeNow: { stage: 'dead' } })
    const second = decideDealStage({ vaultStage: 'pre_contract', vaultStageDetail: 'Opened from email: confirm side and stage', before: now, now })
    expect(second).toEqual({ kind: 'vault_edit' })
  })

  it('recognizes the stage the migration wrote when it listed the older closed sale first', () => {
    const a = facts('sales', 'aaaa', 'Closed', { createdOn: '2024-01-01', actualClosingDate: '2024-03-01' })
    const b = facts('sales', 'bbbb', 'Closed', { createdOn: '2025-01-01', actualClosingDate: '2025-03-01' })
    expect(deriveDealStage([a, b])).toEqual({ stage: 'closed', stageDetail: 'Closed 2025-03-01' })
    const d = decideDealStage({ vaultStage: 'closed', vaultStageDetail: 'Closed 2024-03-01', before: [a, b], now: [a, b] })
    expect(d).toMatchObject({ kind: 'update', to: { stageDetail: 'Closed 2025-03-01' } })
  })

  it('reads stage facts from a payload the way the migration did', () => {
    expect(stageFactsFromDetail('sales', SALE, saleDetail())).toMatchObject({ status: 'Pending', escrowClosingDate: '2026-06-23', actualClosingDate: null })
  })
})

// ── small pieces ────────────────────────────────────────────────────────────

describe('documents', () => {
  it('uses the migration storage layout and ARCHIVE parsing', () => {
    expect(documentStoragePath('59152e77-3d51-4b97-a06c-e9810c71689a', DOC_HUD, 'Final HUD #2: signed?.pdf')).toBe(
      'tc/59152e77-3d51-4b97-a06c-e9810c71689a/97574613__Final HUD _2_ signed_.pdf',
    )
    expect(parseArchiveName('ARCHIVE - Offer 3 - failed cycle.pdf')).toEqual({ archived: true, reason: 'Offer 3 - failed cycle.pdf' })
    expect(parseArchiveName('Sale_Agreement.pdf')).toEqual({ archived: false, reason: null })
    expect(skySlopeDocumentsForIntake(saleDocs()).map((d) => d.isBrokerNotes)).toEqual([false, false])
  })
})

describe('propertyPriority', () => {
  it('visits properties with folders the Vault lacks first, then open files', () => {
    expect(propertyPriority([{ inVault: true, status: 'Closed' }, { inVault: false, status: 'Pending' }])).toBe(0)
    expect(propertyPriority([{ inVault: true, status: 'Active' }])).toBe(1)
    expect(propertyPriority([{ inVault: true, status: 'Closed' }])).toBe(2)
  })
})

describe('inbound client (read-only)', () => {
  it('treats a 422 after a full page as the end of the folder list (production 2026-09-23/24 at 40 sale folders)', () => {
    expect(folderPageIsPastEnd(422, 5, 10)).toBe(true)
    expect(folderPageIsPastEnd(422, 1, 0)).toBe(false)
    expect(folderPageIsPastEnd(422, 3, 7)).toBe(false)
    expect(folderPageIsPastEnd(500, 5, 10)).toBe(false)
  })

  it('allows only GETs for documents and their pre-signed binaries', () => {
    expect(() => assertInboundRequest('GET', `${SKYSLOPE_FILES_BASE}/api/files/sales/${SALE}/documents`)).not.toThrow()
    expect(() => assertInboundRequest('GET', `${SKYSLOPE_FILES_BASE}/api/files/listings/${SALE}/documents/${DOC_RSA}/binary`)).not.toThrow()
    expect(() => assertInboundRequest('GET', presigned(1))).not.toThrow()
    expect(() => assertInboundRequest('PUT', presigned(1))).toThrow(/refused/)
    expect(() => assertInboundRequest('PATCH', `${SKYSLOPE_FILES_BASE}/api/files/sales/${SALE}/documents/${DOC_RSA}`)).toThrow(/refused/)
    expect(() => assertInboundRequest('POST', `${SKYSLOPE_FILES_BASE}/api/files/sales/${SALE}/documents`)).toThrow(/refused/)
    expect(() => assertInboundRequest('GET', 'https://another-bucket.s3.amazonaws.com/x?X-Amz-Signature=1')).toThrow(/host/)
  })
})
