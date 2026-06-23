#!/usr/bin/env node
/** Pull current-deal contract docs from SkySlope to check for a paint/color provision. */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { skyslopeFetchWithRetry, fetchSkyslopeDocumentBinary } from './skyslope-files-api.mjs'
const BASE = 'https://api-latest.skyslope.com'
const GUID = '1a2f5e36-eefb-4695-9b6d-547a87aec6a7'
const env = process.env
const WANT = ['addendum to sale agreement','general_addendum','counter','sellers counteroffer','residential real estate sale agreement','psa','sale agreement','oref_1-1','oref_2-2']
async function login() {
  const ts = new Date().toISOString()
  const hmac = crypto.createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }) })
  return (await r.json()).Session
}
const session = await login()
const H = () => ({ Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' })
const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}/documents`, { headers: { ...H(), 'Content-Type': 'application/json' } })
const docs = (await r.json())?.value?.documents || []
await fs.mkdir('tmp/beaumont-contract', { recursive: true })
const seen = new Set()
for (const d of docs) {
  const fn = (d.fileName || '').toLowerCase()
  if (!WANT.some((w) => fn.includes(w))) continue
  if (!d.url || d.fileSize === -1 || seen.has(d.fileName)) continue
  seen.add(d.fileName)
  const { ok, buf } = await fetchSkyslopeDocumentBinary(d.url, H)
  if (ok && buf.length) { await fs.writeFile(`tmp/beaumont-contract/${d.fileName.replace(/[\\/]/g,'_')}`, buf); console.log(`OK ${d.fileName} (${buf.length}b) up=${d.uploadDate}`) }
}
console.log('done')
