/**
 * The apply path of the MLS close rule against an in-memory Vault: the repair
 * log is written before anything changes, then the deal stage, then the cycle;
 * plan mode writes nothing; a second run writes nothing; a row that changed
 * mid-run is left for the next run; the fell-through-then-closed shape writes
 * nothing. Placeholder data only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb }))

class FakeDb {
  tables: Record<string, Row[]> = {}
  seq = 0
  /** Every write in order: `${table}:${op}`. */
  journal: string[] = []
  failures = new Map<string, string>()
  /** Runs once, right after the named write lands (to simulate a concurrent edit). */
  after = new Map<string, () => void>()
  from(table: string) {
    this.tables[table] ??= []
    return new FakeQuery(this, table)
  }
  rpc() {
    return Promise.resolve({ data: true, error: null })
  }
  snapshot(): string {
    return JSON.stringify(this.tables)
  }
}

function same(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null
  return String(a) === String(b)
}

class FakeQuery implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private op: 'select' | 'insert' | 'update' = 'select'
  private filters: Array<(r: Row) => boolean> = []
  private payload: Row[] | Row = []
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
  range(a: number, b: number) {
    this.from_ = a
    this.to_ = b
    return this
  }
  single() {
    this.one = true
    return this
  }
  then<T1, T2>(ok?: ((v: { data: unknown; error: { message: string } | null }) => T1 | PromiseLike<T1>) | null, bad?: ((e: unknown) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve(this.run()).then(ok, bad)
  }
  private run(): { data: unknown; error: { message: string } | null } {
    const t = this.db.tables[this.table]
    const key = `${this.table}:${this.op}`
    if (this.op !== 'select' && this.db.failures.has(key)) return { data: null, error: { message: this.db.failures.get(key)! } }
    if (this.op === 'select') {
      const rows = t.filter((r) => this.filters.every((f) => f(r))).slice(this.from_, this.to_ + 1)
      return { data: this.one ? (rows[0] ?? null) : rows.map((r) => structuredClone(r)), error: null }
    }
    let out: Row[]
    if (this.op === 'update') {
      out = t.filter((r) => this.filters.every((f) => f(r)))
      for (const r of out) Object.assign(r, structuredClone(this.payload as Row))
    } else {
      out = (this.payload as Row[]).map((raw) => ({ ...structuredClone(raw), id: raw.id ?? ++this.db.seq }))
      t.push(...out)
    }
    if (out.length) {
      this.db.journal.push(key)
      const hook = this.db.after.get(key)
      if (hook) {
        this.db.after.delete(key)
        hook()
      }
    }
    return { data: out.map((r) => ({ ...r })), error: null }
  }
}

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => h.db }))

const { runMlsCloseSweep } = await import('./mls-close')

// ── fixtures (placeholders) ─────────────────────────────────────────────────

const DEAL = 'deal-0001'
const CYCLE = 'cycle-0001'
const MLS = '000000001'

function seed(db: FakeDb) {
  db.tables.tc_deals = [{ id: DEAL, address: '100 Example Ave, Bend, OR', stage: 'dead', stage_detail: 'All cycles canceled', updated_at: '2030-03-10T00:00:00+00:00' }]
  db.tables.tc_cycles = [
    {
      id: CYCLE,
      deal_id: DEAL,
      kind: 'sale',
      source: 'skyslope',
      status: 'Expired',
      mls_number: MLS,
      contract_acceptance_date: '2030-03-01',
      escrow_closing_date: '2030-03-20',
      actual_closing_date: null,
      dead_date: null,
      source_created_on: '2030-03-02T09:00:00+00:00',
      created_at: '2030-03-02T10:00:00+00:00',
      updated_at: '2030-03-02T10:00:00+00:00',
      sale_price: 500000,
      term_provenance: { sale_price: { by: 'import', at: '2030-03-02T10:00:00Z', actor: 'skyslope-intake' } },
      raw: { status: 'Expired' },
    },
  ]
  db.tables.listings = [
    {
      ListNumber: MLS,
      StandardStatus: 'Closed',
      CloseDate: '2030-03-20T00:00:00+00:00',
      ClosePrice: 500000,
      purchase_contract_date: '2030-03-01',
      ListOfficeName: 'Example Listing Office',
      buyer_office_name: 'Ryan Realty LLC',
      ModificationTimestamp: '2030-03-20T18:00:00+00:00',
    },
  ]
  db.tables.tc_cycle_repair_log = []
  db.tables.tc_events = []
}

beforeEach(() => {
  h.db = new FakeDb()
  seed(h.db)
})

const cycleRow = () => h.db.tables.tc_cycles.find((c) => c.id === CYCLE)!
const dealRow = () => h.db.tables.tc_deals.find((d) => d.id === DEAL)!

describe('runMlsCloseSweep', () => {
  it('plan mode decides and writes nothing', async () => {
    const before = h.db.snapshot()
    const res = await runMlsCloseSweep({ apply: false })
    expect(res.ok).toBe(true)
    expect(res.totals.closes).toBe(1)
    expect(res.deals[0].closes[0]).toMatchObject({ cycleId: CYCLE, set: { status: 'Closed', actual_closing_date: '2030-03-20' } })
    expect(res.deals[0].stage).toMatchObject({ kind: 'update', to: { stage: 'closed', stageDetail: 'Closed 2030-03-20' } })
    expect(h.db.snapshot()).toBe(before)
    expect(h.db.journal).toEqual([])
  })

  it('apply logs the old row first, then the stage, then the cycle, then the audit trail', async () => {
    const original = structuredClone(cycleRow())
    const res = await runMlsCloseSweep({ apply: true })
    expect(res.ok).toBe(true)
    expect(res.totals).toMatchObject({ closes: 1, closed: 1, failed: 0, stagesUpdated: 1, logged: 1 })
    expect(h.db.journal).toEqual([
      'tc_cycle_repair_log:insert',
      'tc_deals:update',
      'tc_events:insert',
      'tc_cycles:update',
      'tc_events:insert',
      'tc_cycle_repair_log:update',
    ])

    const [log] = h.db.tables.tc_cycle_repair_log
    expect(log).toMatchObject({
      source: 'mls-close',
      cycle_id: CYCLE,
      deal_id: DEAL,
      before_row: original,
      deal_before: { stage: 'dead', stage_detail: 'All cycles canceled' },
      changes: { cycle: { status: 'Closed', actual_closing_date: '2030-03-20' }, deal: { stage: 'closed', stage_detail: 'Closed 2030-03-20' } },
      evidence: { list_number: MLS, mls_close_date: '2030-03-20', escrow_closing_date: '2030-03-20', days_from_escrow_date: 0, mls_buyer_office: 'Ryan Realty LLC' },
      outcome: 'repaired',
    })

    expect(cycleRow()).toMatchObject({ status: 'Closed', actual_closing_date: '2030-03-20', escrow_closing_date: '2030-03-20', sale_price: 500000 })
    const prov = cycleRow().term_provenance as Row
    expect(prov.sale_price).toMatchObject({ by: 'import' })
    expect(prov.status).toMatchObject({ by: 'mls', actor: 'mls-close', mls: { listNumber: MLS, closeDate: '2030-03-20', closePrice: 500000 } })
    expect(prov.actual_closing_date).toMatchObject({ by: 'mls' })
    expect(dealRow()).toMatchObject({ stage: 'closed', stage_detail: 'Closed 2030-03-20' })

    const events = h.db.tables.tc_events
    expect(events.map((e) => [e.action, e.actor])).toEqual([
      ['mls_stage_updated', 'mls-close'],
      ['mls_cycle_closed', 'mls-close'],
    ])
    expect(events[1]).toMatchObject({ deal_id: DEAL, cycle_id: CYCLE, detail: { from: { status: 'Expired', actual_closing_date: null }, to: { status: 'Closed', actual_closing_date: '2030-03-20' }, repair_log_id: log.id } })
  })

  it('a second run writes nothing', async () => {
    await runMlsCloseSweep({ apply: true })
    const after = h.db.snapshot()
    const writes = h.db.journal.length
    const res = await runMlsCloseSweep({ apply: true })
    expect(res.ok).toBe(true)
    expect(res.totals.closes).toBe(0)
    expect(h.db.journal.length).toBe(writes)
    expect(h.db.snapshot()).toBe(after)
  })

  it('the fell-through-then-closed shape writes nothing', async () => {
    // contract 1 (this cycle) set to close 2030-02-10, canceled 2030-01-25;
    // contract 2 closed 2030-03-20 and the Vault already records it
    Object.assign(cycleRow(), { status: 'Canceled/App', contract_acceptance_date: '2030-01-05', escrow_closing_date: '2030-02-10', dead_date: '2030-01-25' })
    h.db.tables.tc_cycles.push({ ...structuredClone(cycleRow()), id: 'cycle-0002', status: 'Closed', contract_acceptance_date: '2030-02-20', escrow_closing_date: '2030-03-20', actual_closing_date: '2030-03-20', dead_date: null })
    dealRow().stage = 'closed'
    dealRow().stage_detail = 'Closed 2030-03-20'
    const before = h.db.snapshot()
    const res = await runMlsCloseSweep({ apply: true })
    expect(res.totals.closes).toBe(0)
    expect(res.deals[0].skips).toEqual([expect.objectContaining({ cycleId: CYCLE, reason: 'close_outside_window' })])
    expect(h.db.snapshot()).toBe(before)
    expect(h.db.journal).toEqual([])
  })

  it('a cycle edited while the sweep ran is left alone, logged as failed, and closed by the next run', async () => {
    h.db.after.set('tc_deals:update', () => {
      cycleRow().escrow_number = 'typed by a broker'
      cycleRow().updated_at = '2030-03-25T12:00:00+00:00'
    })
    const first = await runMlsCloseSweep({ apply: true })
    expect(first.totals).toMatchObject({ closed: 0, failed: 1 })
    expect(cycleRow()).toMatchObject({ status: 'Expired', actual_closing_date: null, escrow_number: 'typed by a broker' })
    expect(h.db.tables.tc_cycle_repair_log[0]).toMatchObject({ outcome: 'failed' })
    // the stage moved first; the next run decides again and closes the cycle
    const second = await runMlsCloseSweep({ apply: true })
    expect(second.totals).toMatchObject({ closed: 1, stagesUpdated: 0 })
    expect(cycleRow()).toMatchObject({ status: 'Closed', actual_closing_date: '2030-03-20', escrow_number: 'typed by a broker' })
    expect(h.db.tables.tc_cycle_repair_log.map((r) => r.outcome)).toEqual(['failed', 'repaired'])
  })

  it('writes nothing when the repair log cannot be written', async () => {
    h.db.failures.set('tc_cycle_repair_log:insert', 'permission denied')
    const before = h.db.snapshot()
    const res = await runMlsCloseSweep({ apply: true })
    expect(res.deals[0].errors.join(' ')).toMatch(/repair log: permission denied: nothing written/)
    expect(h.db.snapshot()).toBe(before)
  })

  it('only the deals asked for, when given', async () => {
    const res = await runMlsCloseSweep({ apply: false, dealIds: ['deal-other'] })
    expect(res.dealsChecked).toBe(0)
    expect(res.totals.closes).toBe(0)
  })
})
