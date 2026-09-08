#!/usr/bin/env node
/**
 * heartbeat-from-commit.mjs — a site commit IS a heartbeat.
 *
 * WHY (2026-09-08). A site queue claim is released by the boot brief when its
 * heartbeat goes stale, and the heartbeat was a rule a session had to remember:
 * "touch the node at least hourly while a lane builds". It did not hold. At
 * 16:05Z two lanes were demonstrably alive — their branches had moved 16 and 25
 * minutes earlier, one carrying an evaluator verdict — while their heartbeats
 * read two hours old and were an hour from wrongful release. Releasing a live
 * lane costs a duplicate build and a merge fight, which is the exact failure the
 * heartbeat exists to prevent.
 *
 * So the heartbeat stops being a rule and becomes a consequence. Every commit
 * touching the public site already carries a `Node: <id>` trailer (G72), and a
 * commit is the least ambiguous proof of life a lane can emit. This hook reads
 * that trailer and touches the node.
 *
 * It is DELIBERATELY silent and non-blocking: post-commit runs after the commit
 * is written, so a network failure here must never look like a failed commit.
 * It writes only heartbeat_at, and only for a node in_progress — it cannot
 * revive a released claim, cannot change state, and cannot be mistaken for
 * progress. The owner is not checked, because a commit naming a node is
 * evidence that node is being worked whoever holds it; the brief's release is
 * still optimistic on the owner it judged.
 *
 * Invoked by .husky/post-commit. Never call it by hand.
 */
import { execSync } from 'node:child_process'
import { loadEnv, env } from '../lib/platform/env.mjs'

const UUID = /^Node:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/im

async function main() {
  let body = ''
  try {
    body = execSync('git log -1 --pretty=%B', { encoding: 'utf8' })
  } catch {
    return
  }
  const id = body.match(UUID)?.[1]
  if (!id) return // not a site commit, or `Node: none (reason)` — nothing to touch

  // loadEnv, not a hand-rolled .env.local read: a cloud VM has no .env.local and
  // its secrets come from the environment list (ci:vm-parity enforces this, and
  // caught the first version of this file).
  await loadEnv().catch(() => {})
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return // no credentials here (a fresh clone, CI) — silence is correct

  try {
    const res = await fetch(`${url}/rest/v1/loop_work_nodes?id=eq.${id}&state=eq.in_progress`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ heartbeat_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return
    const rows = await res.json()
    if (Array.isArray(rows) && rows.length) {
      console.log(`heartbeat: ${rows[0].version_gap ?? id.slice(0, 8)} (this commit is proof of life)`)
    }
  } catch {
    // A hook that fails loudly on a network blip trains people to skip hooks.
  }
}

main()
