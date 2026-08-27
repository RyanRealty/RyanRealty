import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const sb = createClient(url, key, { auth: { autoRefreshToken:false, persistSession:false } })
const { data, error } = await sb.auth.admin.generateLink({
  type: 'magiclink',
  email: 'matt@ryan-realty.com',
  options: { redirectTo: 'http://localhost:3300/auth/callback' },
})
if (error) { console.error('ERR', error.message); process.exit(1) }
console.log(`http://localhost:3300/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=/admin/crm`)
