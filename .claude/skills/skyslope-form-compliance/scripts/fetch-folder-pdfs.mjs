#!/usr/bin/env node
/**
 * Fetch every PDF (and image, ZIP, etc.) in a SkySlope folder to local
 * disk so Claude (in this conversation) can read them via the Read tool
 * without any Anthropic API calls.
 *
 * Output:
 *   tmp/skyslope-pdfs/<guid>/<docId>__<filename>
 *   tmp/skyslope-pdfs/<guid>/manifest.json
 *
 * Usage:
 *   node --env-file=.env.local .claude/skills/skyslope-form-compliance/scripts/fetch-folder-pdfs.mjs \
 *     --kind=sale --guid=<saleGuid>
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { fetchSkyslopeDocumentBinary, skyslopeFetchWithRetry } from '../../../../scripts/skyslope-files-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../../../..')
const BASE = 'https://api-latest.skyslope.com'

const args = process.argv.slice(2)
const arg = (n) => {
  for (const a of args) {
    if (a.startsWith(`--${n}=`)) return a.slice(n.length + 3)
  }
  return null
}
const KIND = arg('kind') || 'sale'
const GUID = arg('guid')
if (!GUID) {
  console.error('Usage: --kind=sale|listing --guid=<guid>')
  process.exit(1)
}

function loadEnv() {
  const env = {}
  for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    let v = t.slice(eq + 1).trim()
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    env[t.slice(0, eq).trim()] = v
  }
  return env
}
const env = loadEnv()

async function login() {
  const ts = new Date().toISOString()
  const hmac = crypto.createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}

function apiHeaders(session) {
  return { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' }
}

function sanitize(s) {
  return String(s).replace(/[\/\\:*?"<>|]/g, '_')
}

async function main() {
  const session = await login()
  const pathSeg = KIND === 'listing' ? 'listings' : 'sales'

  const folderRes = await skyslopeFetchWithRetry(`${BASE}/api/files/${pathSeg}/${GUID}`, { headers: apiHeaders(session) })
  const folder = (await folderRes.json())?.value?.[KIND]
  if (!folder) { console.error('folder not found'); process.exit(2) }

  const docsRes = await skyslopeFetchWithRetry(`${BASE}/api/files/${pathSeg}/${GUID}/documents`, { headers: apiHeaders(session) })
  const docs = (await docsRes.json())?.value?.documents || []
  const real = docs.filter((d) => d && d.fileSize !== -1)

  const OUT_DIR = path.join(ROOT, 'tmp/skyslope-pdfs', GUID)
  fs.mkdirSync(OUT_DIR, { recursive: true })

  console.log(`Folder: ${folder.propertyAddress || folder.address || GUID}`)
  console.log(`Status: ${folder.status}`)
  console.log(`Sellers: ${(folder.sellers || []).map((s) => [s.firstName, s.lastName].filter(Boolean).join(' ')).join(', ') || '(none)'}`)
  console.log(`Buyers: ${(folder.buyers || []).map((b) => [b.firstName, b.lastName].filter(Boolean).join(' ')).join(', ') || '(none)'}`)
  console.log(`Docs to fetch: ${real.length}\n`)

  const manifest = {
    folderGuid: GUID,
    folderKind: KIND,
    status: folder.status,
    address: folder.propertyAddress || folder.address,
    sellers: (folder.sellers || []).map((s) => [s.firstName, s.lastName].filter(Boolean).join(' ').trim()),
    buyers: (folder.buyers || []).map((b) => [b.firstName, b.lastName].filter(Boolean).join(' ').trim()),
    listingAgent: folder.listingAgent || null,
    saleAgent: folder.saleAgent || null,
    fetchedAt: new Date().toISOString(),
    documents: [],
  }

  for (let i = 0; i < real.length; i++) {
    const doc = real[i]
    const docId = doc.id || doc.documentGuid || doc.documentId
    const fileName = doc.fileName || `doc_${docId}.pdf`
    const localName = `${docId.slice(0, 8)}__${sanitize(fileName)}`
    const localPath = path.join(OUT_DIR, localName)

    if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
      manifest.documents.push({ docId, fileName, localPath, uploadDate: doc.uploadDate, fileSize: doc.fileSize, pages: doc.pages, skipped: true })
      console.log(`  [${i + 1}/${real.length}] cached: ${localName}`)
      continue
    }

    try {
      const docUrl = doc.url || `${BASE}/api/files/${pathSeg}/${GUID}/documents/${docId}/binary`
      const fetched = await fetchSkyslopeDocumentBinary(docUrl, () => apiHeaders(session))
      if (!fetched.ok) {
        console.log(`  [${i + 1}/${real.length}] FETCH FAIL ${fetched.status}: ${localName}`)
        manifest.documents.push({ docId, fileName, localPath: null, error: `HTTP ${fetched.status}` })
        continue
      }
      fs.writeFileSync(localPath, fetched.buf)
      manifest.documents.push({ docId, fileName, localPath, uploadDate: doc.uploadDate, fileSize: fetched.buf.length, pages: doc.pages })
      console.log(`  [${i + 1}/${real.length}] saved ${(fetched.buf.length / 1024).toFixed(0)}KB: ${localName}`)
    } catch (e) {
      console.log(`  [${i + 1}/${real.length}] ERR: ${e?.message || e}`)
      manifest.documents.push({ docId, fileName, localPath: null, error: e?.message || String(e) })
    }
  }

  const manifestPath = path.join(OUT_DIR, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`\nManifest: ${manifestPath}`)
}

main().catch((e) => { console.error('Fatal:', e?.message || e); process.exit(1) })
