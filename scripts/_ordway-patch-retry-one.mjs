#!/usr/bin/env node
/**
 * Retry the single failed Ordway PATCH with a SkySlope-safe filename.
 * Period inside "2.2" trips SkySlope's filename validator — replacing
 * with hyphen ("Form 2-2") to comply.
 */
import crypto from 'node:crypto'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const FOLDER = 'f88642ff-22e6-4618-b9e1-40b168a439e1'
const DOC_ID = '03d3afae-b8d3-4342-8416-6913ded75144'
const NEW_NAME = 'MR05072025_X_Oregon REALTORS Form 2-2 General Addendum.pdf'

async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto
    .createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}

const session = await login()
const url = `${BASE}/api/files/sales/${encodeURIComponent(FOLDER)}/documents/${encodeURIComponent(DOC_ID)}`
const r = await skyslopeFetchWithRetry(url, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' },
  body: JSON.stringify({ FileName: NEW_NAME }),
})
const text = await r.text()
console.log(`Status ${r.status}: ${text.slice(0, 200)}`)
console.log(`Target name: ${NEW_NAME}`)
