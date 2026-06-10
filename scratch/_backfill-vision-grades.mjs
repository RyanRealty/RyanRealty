import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env = readFileSync('.env.local', 'utf8')
const get = (k) => env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1]?.trim()
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'))
const rows = JSON.parse(readFileSync('/tmp/vision-grades.json', 'utf8'))
let ok = 0, miss = 0
for (const grade of ['A', 'B', 'C']) {
  const ids = rows.filter((r) => r.q === grade).map((r) => r.id)
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200)
    const { error, count } = await sb.from('asset_library')
      .update({ vision_grade: grade }, { count: 'exact' })
      .in('id', batch)
    if (error) { console.error(grade, error.message); process.exit(1) }
    ok += count ?? 0
  }
}
console.log('updated rows:', ok, 'of', rows.length)
