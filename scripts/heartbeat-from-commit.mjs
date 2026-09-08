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
      return
    }

    /**
     * NO ROWS. Two very different reasons, and the silence covered both.
     *
     * Benign: the node exists but is not in_progress — a commit landing after
     * the node was blocked on its measurement window. Nothing to say.
     *
     * NOT benign: the trailer names a uuid that is not a node at all. G72
     * checks the trailer's SHAPE, not that it resolves, so a wrong uuid passes
     * the gate, and then every write keyed on it — the heartbeat here, the
     * evidence at the end of the round — updates zero rows and reports success.
     * That happened on 2026-09-08: two commits carried
     * 28a55619-8b9f-4de0-9f10-b5d1dd0d3a7d for a node whose real id ends
     * -eff3-4763-aeaf-e7f3617a9cb3, and the mistake surfaced only because the
     * queue listing still showed the node in_progress after it had supposedly
     * been closed.
     *
     * So: one extra request, only on the already-rare zero-row path, and a loud
     * line when the id resolves to nothing. Still non-blocking — the commit is
     * written and a post-commit hook must never look like a failed commit — but
     * a person watching their own commit scroll past now sees it.
     */
    const check = await fetch(`${url}/rest/v1/loop_work_nodes?id=eq.${id}&select=id`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(4000),
    })
    if (!check.ok) return
    const found = await check.json()
    if (Array.isArray(found) && found.length === 0) {
      console.warn(
        `\n  !! Node: ${id} is not a row in loop_work_nodes.\n` +
          `     This commit names a node that does not exist, so nothing keyed on that id —\n` +
          `     the heartbeat, and the evidence written at the end of the round — will land.\n` +
          `     Check the id with: npx tsx scripts/site-queue-status.ts\n`,
      )
    }
  } catch {
    // A hook that fails loudly on a network blip trains people to skip hooks.
  }
}

main()
