/**
 * The apply path of the SkySlope → Vault intake against an in-memory Vault and
 * a stubbed (read-only) SkySlope. Proves what the pure tests cannot: the write
 * order, that plan mode writes nothing, that a second run writes nothing, and
 * that a failed write holds the previous payload back so the next run retries.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

// ── in-memory Supabase (only the calls the intake makes) ───────────────────

const UNIQUE: Record<string, string[][]> = {
  tc_deals: [['property_key']],
  tc_cycles: [['source_guid']],
  tc_documents: [['cycle_id', 'source_doc_id']],
  tc_checklist_items: [['cycle_id', 'source_activity_id']],
  tc_checklist_assignments: [['item_id', 'document_id']],
  tc_deal_contacts: [['deal_id', 'role', 'source_contact_guid']],
}

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  sky: {
    sales: [] as Row[],
    listings: [] as Row[],
    details: new Map<string, Row>(),
    docs: new Map<string, Row[]>(),
    downloads: [] as string[],
  },
}))

class FakeDb {
  tables: Record<string, Row[]> = {}
  objects = new Map<string, Buffer>()
  seq = 0
  /** (table, op) → error message, to simulate a failed write. */
  failures = new Map<string, string>()
  writes = 0

  from(table: string) {
    this.tables[table] ??= []
    return new FakeQuery(this, table)
  }
  rpc() {
    return Promise.resolve({ data: true, error: null })
  }
  storage = {
    from: () => ({
      upload: async (path: string, buf: Buffer, opts: { upsert?: boolean }) => {
        if (this.objects.has(path) && !opts.upsert) return { data: null, error: { message: 'The resource already exists' } }
        this.objects.set(path, buf)
        this.writes++
        return { data: { path }, error: null }
      },
    }),
  }
  snapshot(): string {
    return JSON.stringify({ t: this.tables, o: [...this.objects.keys()].sort() })
  }
}

function same(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null
  return String(a) === String(b)
}

class FakeQuery implements PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> {
  private op: 'select' | 'insert' | 'update' | 'upsert' = 'select'
  private filters: Array<(r: Row) => boolean> = []
  private payload: Row[] | Row = []
  private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {}
  private from_ = 0
  private to_ = Number.MAX_SAFE_INTEGER
  private one = false
  constructor(
    private db: FakeDb,
    private table: string,
  ) {}
  select() {
    return this
  }
  insert(rows: Row | Row[]) {
    this.op = 'insert'
    this.payload = Array.isArray(rows) ? rows : [rows]
    return this
  }
  update(patch: Row) {
    this.op = 'update'
    this.payload = patch
    return this
  }
  upsert(rows: Row | Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.op = 'upsert'
    this.payload = Array.isArray(rows) ? rows : [rows]
    this.upsertOpts = opts
    return this
  }
  eq(c: string, v: unknown) {
    this.filters.push((r) => same(r[c], v))
    return this
  }
  is(c: string) {
    this.filters.push((r) => r[c] == null)
    return this
  }
  in(c: string, vs: unknown[]) {
    this.filters.push((r) => vs.some((v) => same(r[c], v)))
    return this
  }
  order() {
    return this
  }
  limit(n: number) {
    this.to_ = n - 1
    return this
  }
  range(a: number, b: number) {
    this.from_ = a
    this.to_ = b
    return this
  }
  single() {
    this.one = true
    return this
  }
  then<T1, T2>(ok?: ((v: { data: unknown; error: { message: string; code?: string } | null }) => T1 | PromiseLike<T1>) | null, bad?: ((e: unknown) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve(this.run()).then(ok, bad)
  }
  private conflict(row: Row): Row | undefined {
    for (const cols of UNIQUE[this.table] ?? []) {
      if (cols.some((c) => row[c] == null)) continue
      const hit = this.db.tables[this.table].find((r) => cols.every((c) => same(r[c], row[c])))
      if (hit) return hit
    }
    return undefined
  }
  private run(): { data: unknown; error: { message: string; code?: string } | null } {
    const t = this.db.tables[this.table]
    const fail = this.db.failures.get(`${this.table}:${this.op}`)
    if (fail && this.op !== 'select') return { data: null, error: { message: fail } }
    if (this.op === 'select') {
      const rows = t.filter((r) => this.filters.every((f) => f(r))).slice(this.from_, this.to_ + 1)
      return { data: this.one ? (rows[0] ?? null) : rows.map((r) => ({ ...r })), error: null }
    }
    if (this.op === 'update') {
      const hits = t.filter((r) => this.filters.every((f) => f(r)))
      for (const r of hits) Object.assign(r, structuredClone(this.payload as Row))
      if (hits.length) this.db.writes++
      return { data: hits.map((r) => ({ id: r.id })), error: null }
    }
    const inserted: Row[] = []
    for (const raw of this.payload as Row[]) {
      const row = structuredClone(raw)
      if (this.conflict(row)) {
        if (this.op === 'upsert' && this.upsertOpts.ignoreDuplicates) continue
        return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } }
      }
      if (this.table !== 'tc_checklist_assignments') row.id ??= this.table === 'tc_events' ? ++this.db.seq : `${this.table}-${++this.db.seq}`
      t.push(row)
      inserted.push(row)
    }
    if (inserted.length) this.db.writes++
    return { data: this.one ? (inserted[0] ?? null) : inserted.map((r) => ({ ...r })), error: null }
  }
}

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => h.db }))
vi.mock('@/lib/tc/skyslope-inbound', () => ({
  hasSkySlopeInboundCreds: () => true,
  loginSkySlopeInbound: async () => 'session',
  listSkySlopeFolders: async (_s: string, kind: 'sales' | 'listings') => structuredClone(h.sky[kind]),
  fetchSkySlopeFolderDetail: async (_s: string, _k: string, guid: string) => structuredClone(h.sky.details.get(guid)) ?? { __error: 404 },
  fetchSkySlopeFolderDocuments: async (_s: string, _k: string, guid: string) => structuredClone(h.sky.docs.get(guid) ?? []),
  fetchSkySlopeDocumentBinary: async (_s: string, _k: string, _g: string, docId: string) => {
    h.sky.downloads.push(docId)
    return { ok: true, status: 200, contentType: 'binary/octet-stream', buf: Buffer.from(`%PDF-1.7 ${docId}`) }
  },
}))

const { runSkySlopeVaultIntake } = await import('./skyslope-intake')
const { cycleFieldsFromDetail, CYCLE_FIELD_SPECS } = await import('@/lib/tc/skyslope-intake')

// ── fixtures ────────────────────────────────────────────────────────────────

const MATT = '41c18058-6c25-4acb-affc-3afc4ea9ac52'
const BEAUMONT = '1a2f5e36-eefb-4695-9b6d-547a87aec6a7'
const DELAWARE = 'e97b88c7-3d4f-48b2-8153-44cad5009c40'
const TUMALO = '30155e9b-6c01-489c-b3d3-9a4b36d96752'
const RSA = 'e31b37ac-9a5a-f111-bb41-12f8d622e63f'
const HUD = '97574613-c7b7-4e35-bad0-32f3172ee981'
const EXPIRED_SA = '6f660a33-eca6-f111-bb43-12f8d622e63f'
const TUMALO_RSA = 'b314d3a5-04a9-456e-b782-9150acc188b3'
let urlSeed = 0
const url = () => `https://skyslope-documents.s3.amazonaws.com/k${++urlSeed}?X-Amz-Expires=300&X-Amz-Signature=s${urlSeed}`

function beaumont(over: Row = {}): Row {
  return {
    saleGuid: BEAUMONT,
    status: 'Pending',
    agentGuid: MATT,
    mlsNumber: '220199105',
    escrowNumber: '',
    salePrice: 519000,
    listingPrice: 539000,
    contractAcceptanceDate: '2026-05-14T00:00:00',
    escrowClosingDate: '2026-06-23T00:00:00',
    actualClosingDate: null,
    createdOn: '2026-05-28T06:31:01.493',
    portalEmail: 'BeaumontDrive20702@skyslope.com',
    checklistType: 'Residential — Standard',
    sellers: [{ firstName: 'Mary', lastName: 'Bowman' }],
    buyers: [{ firstName: 'Tyler', lastName: 'Nicoll' }],
    commission: { officeGrossCommissionOnSale: 15570, saleCommissionPercent: 2.5 },
    titleContact: { firstName: 'Yvonne', lastName: 'Ward', company: 'Western Title', email: 'yvonne.ward@westerntitle.com', contactGuid: 'title-1' },
    property: { streetNumber: '20702', streetAddress: 'Beaumont Drive', city: 'Bend', state: 'OR', zip: '97701' },
    checklist: {
      activities: [{ activityId: 11, activityName: 'Residential Sale Agreement', status: 'Completed', order: 1, checklistDocs: [{ id: RSA.toUpperCase(), url: url() }] }],
    },
    ...over,
  }
}

function seedVault(db: FakeDb) {
  const migrated = cycleFieldsFromDetail(beaumont()) as Row
  for (const s of CYCLE_FIELD_SPECS) if (!s.migrationCarried) migrated[s.column] = null
  db.tables.tc_deals = [
    { id: 'deal-beaumont', property_key: '20702-beaumont', address: '20702 Beaumont Drive, Bend, OR, 97701', city: 'Bend', stage: 'pending', stage_detail: 'Under contract — closes 2026-06-23' },
    // opened by the mail sweep from closing emails
    { id: 'deal-delaware', property_key: 'inhouse-909-nw-delaware-ave-bend-or-97703-5d1c2a9b', address: '909 NW Delaware Ave, Bend, OR 97703', city: 'Bend', stage: 'pre_contract', stage_detail: 'Opened from email: confirm side and stage' },
  ]
  db.tables.tc_cycles = [
    { id: 'cycle-beaumont', deal_id: 'deal-beaumont', kind: 'sale', source: 'skyslope', source_guid: BEAUMONT, raw: beaumont(), ...migrated, escrow_number: 'WT0286975' },
    { id: 'cycle-delaware-inhouse', deal_id: 'deal-delaware', kind: 'sale', source: 'inhouse', source_guid: 'inhouse:cycle-delaware-inhouse', status: 'Pre-Contract', raw: {} },
  ]
  db.tables.tc_documents = [{ id: 'doc-rsa', cycle_id: 'cycle-beaumont', source_doc_id: RSA, name: 'Sale_Agreement.pdf', archived: false, storage_path: `tc/${BEAUMONT}/e31b37ac__Sale_Agreement.pdf` }]
  db.tables.tc_checklist_items = [{ id: 'item-11', cycle_id: 'cycle-beaumont', source_activity_id: 11, name: 'Residential Sale Agreement', status: 'completed' }]
  db.tables.tc_checklist_assignments = [{ item_id: 'item-11', document_id: 'doc-rsa' }]
  db.tables.tc_deal_contacts = [{ id: 'contact-1', deal_id: 'deal-beaumont', role: 'title', name: 'Yvonne Ward', email: 'yvonne.ward@westerntitle.com', source_contact_guid: 'title-1' }]
  db.tables.tc_events = []
}

function seedSkySlope() {
  h.sky.downloads = []
  h.sky.sales = [
    { saleGuid: BEAUMONT, propertyAddress: '20702 Beaumont Drive, Bend, OR 97701', status: 'Closed' },
    { saleGuid: DELAWARE, propertyAddress: '909 NW Delaware Avenue, Bend, OR 97703', status: 'Expired' },
    { saleGuid: TUMALO, propertyAddress: '19496 Tumalo Reservoir Rd, Bend, OR 97703', status: 'Pending' },
  ]
  h.sky.listings = []
  h.sky.details = new Map<string, Row>([
    [
      BEAUMONT,
      beaumont({
        status: 'Closed',
        escrowClosingDate: '2026-07-09T00:00:00',
        actualClosingDate: '2026-07-09T00:00:00',
        checklist: {
          activities: [
            { activityId: 11, activityName: 'Residential Sale Agreement', status: 'Completed', order: 1, checklistDocs: [{ id: RSA.toUpperCase(), url: url() }] },
            { activityId: 12, activityName: 'Final Settlement Statement', status: 'In Review', order: 2, checklistDocs: [{ id: HUD.toUpperCase(), url: url() }] },
          ],
        },
      }),
    ],
    [
      DELAWARE,
      {
        saleGuid: DELAWARE,
        status: 'Expired',
        agentGuid: MATT,
        escrowNumber: '0',
        salePrice: 950000,
        contractAcceptanceDate: '2026-09-01T00:00:00',
        escrowClosingDate: '2026-09-18T00:00:00',
        createdOn: '2026-09-02T09:33:59.543',
        escrowContact: { company: 'First American Title Company', firstName: 'Ann', lastName: 'Escrow', email: 'ann@firstam.com', contactGuid: 'escrow-9' },
        property: { streetNumber: '909', direction: 'NW', streetAddress: 'Delaware Avenue', city: 'Bend', state: 'OR', zip: '97703' },
        checklist: { activities: [{ activityId: 21, activityName: 'Sale Agreement', status: 'Completed', order: 1, checklistDocs: [{ id: EXPIRED_SA.toUpperCase() }] }] },
      },
    ],
    [
      TUMALO,
      {
        saleGuid: TUMALO,
        status: 'Pending',
        agentGuid: MATT,
        salePrice: 1005000,
        escrowClosingDate: '2026-11-30T00:00:00',
        createdOn: '2026-09-22T02:55:07.113',
        property: { streetNumber: '19496', streetAddress: 'Tumalo Reservoir Rd', city: 'Bend', state: 'OR', zip: '97703' },
        titleContact: { firstName: 'Ty', lastName: 'Title', company: 'Western Title', email: 'ty@westerntitle.com', contactGuid: 'title-t' },
        checklist: { activities: [{ activityId: 31, activityName: 'Sale Agreement', status: 'Required', order: 1, checklistDocs: [{ id: TUMALO_RSA.toUpperCase() }] }] },
      },
    ],
  ])
  h.sky.docs = new Map<string, Row[]>([
    [
      BEAUMONT,
      [
        { id: RSA, fileName: 'Sale_Agreement.pdf', fileSize: 1000, url: url() },
        { id: HUD, fileName: 'Final_HUD.pdf', fileSize: 2000, uploadDate: '2026-07-09T12:00:00', url: url() },
        { id: HUD, fileName: 'Final_HUD.pdf', fileSize: 2000, url: url() },
      ],
    ],
    [DELAWARE, [{ id: EXPIRED_SA, fileName: 'Sales_Agreement.pdf', fileSize: null, uploadDate: '2026-09-02T09:34:47.54', url: url() }]],
    [TUMALO, [{ id: TUMALO_RSA, fileName: 'Initial Agency Disclosure Pamphlet.pdf', fileSize: 0, url: url() }]],
  ])
}

const run = (apply: boolean) => runSkySlopeVaultIntake({ apply, paceMs: 0 })

beforeEach(() => {
  h.db = new FakeDb()
  seedVault(h.db)
  seedSkySlope()
})

// ── tests ───────────────────────────────────────────────────────────────────

describe('runSkySlopeVaultIntake', () => {
  it('plan mode reads everything and writes nothing', async () => {
    const before = h.db.snapshot()
    const res = await run(false)
    expect(res.ok).toBe(true)
    expect(res.mode).toBe('plan')
    expect(h.db.snapshot()).toBe(before)
    expect(h.db.writes).toBe(0)
    expect(h.sky.downloads).toEqual([])
    expect(res.properties.map((p) => p.deal?.kind).sort()).toEqual(['create', 'existing', 'existing'])
  })

  it('apply adds only, keeps Vault edits, and records every write', async () => {
    const res = await run(true)
    expect(res.ok).toBe(true)
    expect(res.complete).toBe(true)
    const t = h.db.tables

    // Beaumont: closed in SkySlope, the Vault still held the imported values
    const beaumontCycle = t.tc_cycles.find((c) => c.source_guid === BEAUMONT)!
    expect(beaumontCycle).toMatchObject({ status: 'Closed', escrow_closing_date: '2026-07-09', actual_closing_date: '2026-07-09' })
    expect(beaumontCycle.escrow_number).toBe('WT0286975') // Vault edit kept (SkySlope still blank)
    expect((beaumontCycle.raw as Row).status).toBe('Closed')
    expect(t.tc_deals.find((d) => d.id === 'deal-beaumont')).toMatchObject({ stage: 'closed', stage_detail: 'Closed 2026-07-09' })
    const hud = t.tc_documents.find((d) => d.source_doc_id === HUD)!
    expect(hud).toMatchObject({ cycle_id: 'cycle-beaumont', name: 'Final_HUD.pdf', content_type: 'application/pdf', storage_path: `tc/${BEAUMONT}/97574613__Final_HUD.pdf` })
    expect(h.db.objects.has(`tc/${BEAUMONT}/97574613__Final_HUD.pdf`)).toBe(true)
    expect(t.tc_documents.filter((d) => d.source_doc_id === RSA)).toHaveLength(1) // never re-added
    const item12 = t.tc_checklist_items.find((i) => i.source_activity_id === 12)!
    expect(t.tc_checklist_assignments).toContainEqual({ item_id: item12.id, document_id: hud.id })

    // 909 Delaware: attached to the in-house file the mail sweep opened, no duplicate deal
    expect(t.tc_deals.filter((d) => String(d.address).includes('909'))).toHaveLength(1)
    const delaware = t.tc_cycles.find((c) => c.source_guid === DELAWARE)!
    expect(delaware.deal_id).toBe('deal-delaware')
    expect(t.tc_deals.find((d) => d.id === 'deal-delaware')!.stage).toBe('pre_contract') // Vault stage kept
    expect(t.tc_events.some((e) => e.deal_id === 'deal-delaware' && e.action === 'skyslope_drift_kept')).toBe(true)

    // Tumalo: no deal held the property, so one is created
    const tumaloDeal = t.tc_deals.find((d) => d.property_key === '19496-tumalo')!
    expect(tumaloDeal).toMatchObject({ address: '19496 Tumalo Reservoir Rd, Bend, OR, 97703', stage: 'pending', stage_detail: 'Under contract — closes 2026-11-30', broker_name: 'Matt Ryan' })
    expect(t.tc_deal_contacts.some((c) => c.deal_id === tumaloDeal.id && c.role === 'title')).toBe(true)

    // the audit trail
    expect(t.tc_events.every((e) => e.actor === 'skyslope-intake')).toBe(true)
    const actions = new Set(t.tc_events.map((e) => e.action))
    for (const a of [
      'skyslope_deal_added',
      'skyslope_cycle_added',
      'skyslope_field_updated',
      'skyslope_stage_updated',
      'skyslope_document_added',
      'skyslope_checklist_items_added',
      'skyslope_checklist_assignments_added',
      'skyslope_contacts_added',
      'skyslope_raw_refreshed',
      'skyslope_drift_kept',
    ]) {
      expect(actions, a).toContain(a)
    }
    expect(res.totals.events).toBe(t.tc_events.length)
  })

  it('a second run changes nothing', async () => {
    await run(true)
    const after = h.db.snapshot()
    const writes = h.db.writes
    h.sky.downloads = []
    // SkySlope mints new pre-signed URLs on every read, in the document list and in the detail
    for (const docs of h.sky.docs.values()) for (const d of docs) d.url = url()
    for (const detail of h.sky.details.values()) {
      for (const a of ((detail.checklist as Row).activities as Row[]) ?? []) for (const cd of (a.checklistDocs as Row[]) ?? []) cd.url = url()
    }
    const res = await run(true)
    expect(res.ok).toBe(true)
    expect(h.db.writes).toBe(writes)
    expect(h.db.snapshot()).toBe(after)
    expect(h.sky.downloads).toEqual([])
    expect(res.properties).toEqual([])
  })

  it('a failed write holds the previous payload back so the next run retries it', async () => {
    h.db.failures.set('tc_deal_contacts:upsert', 'boom')
    const first = await run(true)
    expect(first.properties.flatMap((p) => p.errors).some((e) => e.includes('contacts: boom'))).toBe(true)
    const tumalo = h.db.tables.tc_cycles.find((c) => c.source_guid === TUMALO)!
    expect(tumalo.raw).toEqual({}) // not advanced: the contact is still "new"
    expect(h.db.tables.tc_deal_contacts.some((c) => c.source_contact_guid === 'title-t')).toBe(false)

    h.db.failures.clear()
    await run(true)
    expect(h.db.tables.tc_deal_contacts.filter((c) => c.source_contact_guid === 'title-t')).toHaveLength(1)
    expect((h.db.tables.tc_cycles.find((c) => c.source_guid === TUMALO)!.raw as Row).saleGuid).toBe(TUMALO)

    const settled = h.db.snapshot()
    await run(true)
    expect(h.db.snapshot()).toBe(settled)
  })

  it('stops at the deadline without writing', async () => {
    const before = h.db.snapshot()
    const res = await runSkySlopeVaultIntake({ apply: true, paceMs: 0, deadline: Date.now() - 1 })
    expect(res.complete).toBe(false)
    expect(h.db.snapshot()).toBe(before)
  })

  it('the cutover switch stops apply', async () => {
    const prev = process.env.TC_SKYSLOPE_INTAKE_ENABLED
    process.env.TC_SKYSLOPE_INTAKE_ENABLED = 'false'
    try {
      const before = h.db.snapshot()
      const res = await run(true)
      expect(res.enabled).toBe(false)
      expect(res.blocker).toMatch(/TC_SKYSLOPE_INTAKE_ENABLED/)
      expect(h.db.snapshot()).toBe(before)
    } finally {
      if (prev === undefined) delete process.env.TC_SKYSLOPE_INTAKE_ENABLED
      else process.env.TC_SKYSLOPE_INTAKE_ENABLED = prev
    }
  })
})
