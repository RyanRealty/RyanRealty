/**
 * Complete G7 after accept evidence is in hand.
 * Usage: npx tsx scripts/loop-complete-g7.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function loadEnv() {
  const env: Record<string, string> = { ...process.env } as Record<string, string>
  try {
    const raw = readFileSync('.env.local', 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* optional */
  }
  return env
}

const env = loadEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('missing supabase env')
  process.exit(1)
}

const NODE_ID = 'f10b9c7c-c4ad-4d55-bdbe-3294000a8e62'
const OWNER = 'bc-311e4201-0cc8-4ade-b44d-879873938822'

const evidence = process.argv[2]
if (!evidence) {
  console.error('pass evidence string as argv[2]')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

const { data: node, error: readErr } = await sb
  .from('loop_nodes')
  .select('id, status, owner, claimed_at')
  .eq('id', NODE_ID)
  .maybeSingle()

if (readErr || !node) {
  console.error(readErr ?? 'node missing')
  process.exit(1)
}

if (node.status !== 'in_progress' || node.owner !== OWNER) {
  console.error('refusing complete: status/owner mismatch', node)
  process.exit(1)
}

const { error } = await sb
  .from('loop_nodes')
  .update({
    status: 'done',
    completed_at: new Date().toISOString(),
    evidence,
  })
  .eq('id', NODE_ID)
  .eq('status', 'in_progress')
  .eq('owner', OWNER)

if (error) {
  console.error(error)
  process.exit(1)
}

console.log(JSON.stringify({ ok: true, id: NODE_ID, status: 'done' }, null, 2))
