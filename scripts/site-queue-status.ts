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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { data, error } = await sb
    .from('loop_work_nodes')
    .select('id,version_gap,title,state,owner_session,depends_on,blocked_reason,evidence,updated_at,created_at')
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
      if (r.state === 'in_progress') note = `held by ${r.owner_session ?? '?'}`
      if (r.state === 'blocked') note = oneLine(r.blocked_reason)
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
