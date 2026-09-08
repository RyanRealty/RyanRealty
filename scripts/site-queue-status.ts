/**
 * Site queue status — what "loop status" prints (Matt 2026-09-07).
 *
 * Reads the site queue (loop_work_nodes, domain public-ux, version_gap SITE-*) and
 * prints one line per item: state, who holds it, how long ago it moved, and the
 * one sentence that matters for that state (why it is blocked, what its evidence
 * says, what it waits on). Read-only. Operational, never published.
 *
 *   npx tsx scripts/site-queue-status.ts            # the table
 *   npx tsx scripts/site-queue-status.ts --json     # the same as JSON
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { MAX_SITE_CLAIMS_PER_SESSION, MAX_SITE_WORKERS } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

type Row = {
  id: string
  version_gap: string | null
  title: string
  state: 'open' | 'in_progress' | 'blocked' | 'done' | 'killed'
  owner_session: string | null
  depends_on: string[]
  blocked_reason: string | null
  evidence: string | null
  updated_at: string
  created_at: string
  heartbeat_at: string | null
  blocked_until: string | null
}

function ago(iso: string, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60000))
  if (min < 60) return `${min}m`
  const h = Math.round(min / 60)
  if (h < 48) return `${h}h`
  return `${Math.round(h / 24)}d`
}

function oneLine(s: string | null | undefined, max = 110): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max - 1) + '…' : t
}

/**
 * `--touch <SITE-XX,...> --owner <session>` is the heartbeat (2026-09-08). A
 * lane calls it at every report and at least hourly while it builds; the boot
 * brief releases a site claim whose heartbeat is older than the window. It
 * writes only heartbeat_at, and only for the session that holds the node, so it
 * can neither revive someone else's claim nor be mistaken for progress.
 */
async function touch(sb: ReturnType<typeof createClient>, gaps: string[], owner: string): Promise<number> {
  let ok = 0
  for (const gap of gaps) {
    const { data, error } = await sb
      .from('loop_work_nodes')
      .update({ heartbeat_at: new Date().toISOString() })
      .eq('version_gap', gap)
      .eq('state', 'in_progress')
      .eq('owner_session', owner)
      .select('version_gap')
    if (error) {
      console.error(`${gap}: ${error.message}`)
      continue
    }
    if (!data?.length) {
      console.error(`${gap}: not held by ${owner} — released or taken`)
      continue
    }
    console.log(`${gap}: heartbeat`)
    ok += 1
  }
  return ok
}

/**
 * `--claim <SITE-XX,...> --owner <session>` is how a session TAKES work.
 *
 * It exists because the cap cannot live where it was first written: the DAL's
 * claimWorkNode carries `server-only` and cannot load in a CLI, and the skill
 * tells sessions to claim with a plain supabase-js client — so a session doing
 * exactly what it was told would bypass the cap entirely (found 2026-09-08 when
 * Matt asked whether restarted sessions would pick the fixes up).
 *
 * Two limits, both enforced here rather than left to a session's discipline,
 * because the session that most needs a limit is the one already in trouble:
 *   - at most MAX_SITE_CLAIMS_PER_SESSION nodes held by one owner;
 *   - at most MAX_SITE_WORKERS distinct owners holding site nodes at once.
 * The second is the one that matters: every worker and the cloud routine spend
 * ONE shared account allowance, and on 2026-09-08 four concurrent lanes
 * exhausted it and killed every worker in the same minute.
 *
 * The write is optimistic on `state = 'open'`, so two sessions racing for the
 * same node cannot both win; the loser is told and moves on.
 */
async function claim(sb: ReturnType<typeof createClient>, gaps: string[], owner: string): Promise<number> {
  const { data: rows, error } = await sb
    .from('loop_work_nodes')
    .select('version_gap,state,owner_session,depends_on')
    .eq('domain', 'public-ux')
    .like('version_gap', 'SITE-%')
  if (error) {
    console.error('read failed:', error.message)
    return 0
  }
  const all = (rows ?? []) as Array<{ version_gap: string; state: string; owner_session: string | null; depends_on: string[] }>
  const inProgress = all.filter((r) => r.state === 'in_progress')
  const mine = inProgress.filter((r) => r.owner_session === owner)
  const otherOwners = new Set(inProgress.filter((r) => r.owner_session !== owner).map((r) => r.owner_session ?? '?'))

  if (!mine.length && otherOwners.size >= MAX_SITE_WORKERS) {
    console.error(
      `site fleet full: ${otherOwners.size}/${MAX_SITE_WORKERS} workers already hold site claims (${[...otherOwners].join(', ')}). One account allowance feeds them all — do not start a lane.`,
    )
    return 0
  }

  let held = mine.length
  let taken = 0
  for (const gap of gaps) {
    if (held >= MAX_SITE_CLAIMS_PER_SESSION) {
      console.error(`${gap}: refused — ${owner} already holds ${held} site node(s), cap is ${MAX_SITE_CLAIMS_PER_SESSION}. Finish or release one first.`)
      continue
    }
    const now = new Date().toISOString()
    const { data, error: claimErr } = await sb
      .from('loop_work_nodes')
      .update({ state: 'in_progress', owner_session: owner, heartbeat_at: now, updated_at: now })
      .eq('version_gap', gap)
      .eq('state', 'open')
      .select('version_gap')
    if (claimErr) {
      console.error(`${gap}: ${claimErr.message}`)
      continue
    }
    if (!data?.length) {
      console.error(`${gap}: not open — someone else took it, or it is blocked`)
      continue
    }
    console.log(`${gap}: claimed by ${owner}`)
    held += 1
    taken += 1
  }
  if (taken) {
    console.log(`\nheartbeat every hour while you hold these:\n  npx tsx scripts/site-queue-status.ts --touch ${gaps.join(',')} --owner ${owner}`)
  }
  return taken
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(2)
  }
  const sb = createClient(url, key)

  const claimIdx = process.argv.indexOf('--claim')
  if (claimIdx > -1) {
    const gaps = (process.argv[claimIdx + 1] ?? '').split(',').map((g) => g.trim()).filter(Boolean)
    const ownerIdx = process.argv.indexOf('--owner')
    const owner = process.argv[ownerIdx + 1] ?? ''
    if (!gaps.length || ownerIdx === -1 || !owner) {
      console.error('usage: --claim SITE-02,SITE-05 --owner <session-id>')
      process.exit(2)
    }
    const took = await claim(sb, gaps, owner)
    process.exit(took > 0 ? 0 : 1)
  }

  const touchIdx = process.argv.indexOf('--touch')
  if (touchIdx > -1) {
    const gaps = (process.argv[touchIdx + 1] ?? '').split(',').map((g) => g.trim()).filter(Boolean)
    const ownerIdx = process.argv.indexOf('--owner')
    const owner = process.argv[ownerIdx + 1] ?? ''
    if (!gaps.length || ownerIdx === -1 || !owner) {
      console.error('usage: --touch SITE-02,SITE-05 --owner <session-id>')
      process.exit(2)
    }
    const ok = await touch(sb, gaps, owner)
    process.exit(ok === gaps.length ? 0 : 1)
  }

  const { data, error } = await sb
    .from('loop_work_nodes')
    .select('id,version_gap,title,state,owner_session,depends_on,blocked_reason,evidence,updated_at,created_at,heartbeat_at,blocked_until')
    .eq('domain', 'public-ux')
    .like('version_gap', 'SITE-%')
    .order('created_at', { ascending: true })
  if (error) {
    console.error('read failed:', error.message)
    process.exit(1)
  }
  const rows = (data ?? []) as Row[]
  const byId = new Map(rows.map((r) => [r.id, r]))
  const now = new Date()
  const doneIds = new Set(rows.filter((r) => r.state === 'done').map((r) => r.id))
  const gapOf = (id: string) => byId.get(id)?.version_gap ?? id.slice(0, 8)

  const view = rows
    .slice()
    .sort((a, b) => String(a.version_gap).localeCompare(String(b.version_gap), 'en', { numeric: true }))
    .map((r) => {
      const waits = r.depends_on.filter((d) => !doneIds.has(d)).map(gapOf)
      const eligible = r.state === 'open' && waits.length === 0
      let note = ''
      if (r.state === 'open') note = eligible ? 'eligible' : `waits on ${waits.join(', ')}`
      if (r.state === 'in_progress') {
        const beat = r.heartbeat_at ?? r.updated_at
        note = `held by ${r.owner_session ?? '?'} · last heartbeat ${ago(beat, now)} ago${r.heartbeat_at ? '' : ' (never heartbeated)'}`
      }
      if (r.state === 'blocked') {
        const until = r.blocked_until ? `reopens ${r.blocked_until.slice(0, 10)} · ` : 'waiting on a person · '
        note = until + oneLine(r.blocked_reason, 90)
      }
      if (r.state === 'done') note = oneLine(r.evidence)
      if (r.state === 'killed') note = oneLine(r.blocked_reason)
      return { gap: r.version_gap ?? '-', state: r.state, moved: ago(r.updated_at, now), title: r.title, note, eligible }
    })

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ readAt: now.toISOString(), items: view }, null, 2))
    return
  }

  const counts = view.reduce<Record<string, number>>((acc, v) => ((acc[v.state] = (acc[v.state] ?? 0) + 1), acc), {})
  const next = view.find((v) => v.eligible)
  console.log(`SITE QUEUE — ${view.length} items · ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(' · ')} · read ${now.toISOString().slice(0, 16)}Z`)
  console.log(`next served: ${next ? `${next.gap} ${oneLine(next.title, 80)}` : 'nothing eligible'}`)
  console.log('')
  console.log('gap       state        moved  item')
  for (const v of view) {
    console.log(`${v.gap.padEnd(9)} ${v.state.padEnd(12)} ${v.moved.padStart(5)}  ${oneLine(v.title, 90)}`)
    if (v.note) console.log(`${''.padEnd(29)}${v.note}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
