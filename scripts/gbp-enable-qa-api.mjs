#!/usr/bin/env node
/**
 * Attempt to programmatically enable the My Business Q&A API on the Ryan Realty
 * GCP project via the Service Usage API + the service account credentials.
 *
 * Requirements (any missing → exit non-zero with the next manual step):
 *   - GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env.local
 *   - Service account must hold one of: roles/serviceusage.serviceUsageAdmin,
 *     roles/owner, or roles/editor on project 725620954432
 *   - Service Usage API itself must already be enabled (it is by default on every
 *     GCP project, so this is a non-issue in practice)
 *
 * Usage:
 *   node scripts/gbp-enable-qa-api.mjs
 *   node scripts/gbp-enable-qa-api.mjs --project 725620954432
 *   node scripts/gbp-enable-qa-api.mjs --service mybusinessqanda.googleapis.com
 *   node scripts/gbp-enable-qa-api.mjs --check-only        # just report current state
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const DEFAULT_PROJECT = '725620954432'
const DEFAULT_SERVICE = 'mybusinessqanda.googleapis.com'

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (!t.startsWith('--')) continue
    const key = t.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i++
    } else {
      out[key] = true
    }
  }
  return out
}

function readDotEnv(filePath) {
  const env = {}
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!m) continue
    env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return env
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getServiceAccountAccessToken(env, scopes) {
  const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL
  const privateKey = (env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!clientEmail || !privateKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL / PRIVATE_KEY missing in .env.local')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: scopes.join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const signing = `${header}.${claim}`
  const signature = crypto.createSign('RSA-SHA256').update(signing).sign(privateKey)
  const jwt = `${signing}.${base64url(signature)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.access_token) {
    throw new Error(`SA token exchange failed: ${res.status} ${JSON.stringify(body)}`)
  }
  return body.access_token
}

async function checkServiceState(token, project, service) {
  const url = `https://serviceusage.googleapis.com/v1/projects/${project}/services/${service}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, status: res.status, error: json?.error?.message || res.statusText, raw: json }
  }
  return { ok: true, state: json.state, name: json.name, raw: json }
}

async function enableService(token, project, service) {
  const url = `https://serviceusage.googleapis.com/v1/projects/${project}/services/${service}:enable`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, status: res.status, error: json?.error?.message || res.statusText, raw: json }
  }
  return { ok: true, operation: json.name, done: json.done, raw: json }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const project = args.project || DEFAULT_PROJECT
  const service = args.service || DEFAULT_SERVICE
  const checkOnly = !!args['check-only']

  const envPath = path.resolve(process.cwd(), '.env.local')
  const env = { ...readDotEnv(envPath), ...process.env }

  console.log(`Project: ${project}`)
  console.log(`Service: ${service}`)
  console.log('')

  let token
  try {
    token = await getServiceAccountAccessToken(env, [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/service.management',
    ])
    console.log('✓ Service-account access token obtained')
  } catch (e) {
    console.error(`✗ ${e.message}`)
    console.error('')
    console.error('NEXT STEP: Matt to enable manually at:')
    console.error(`  https://console.developers.google.com/apis/api/${service}/overview?project=${project}`)
    process.exit(1)
  }

  const before = await checkServiceState(token, project, service)
  if (!before.ok) {
    console.error(`✗ Could not read service state: HTTP ${before.status} — ${before.error}`)
    if (before.status === 403) {
      console.error('')
      console.error('The service account does not have serviceusage.services.get on this project.')
      console.error(`Matt: grant it at https://console.cloud.google.com/iam-admin/iam?project=${project}`)
      console.error('Grant role: "Service Usage Admin" to the SA email.')
      console.error('Or click the activation link directly:')
      console.error(`  https://console.developers.google.com/apis/api/${service}/overview?project=${project}`)
    }
    process.exit(1)
  }

  console.log(`Current state: ${before.state}`)
  if (before.state === 'ENABLED') {
    console.log('✓ Already enabled — nothing to do')
    process.exit(0)
  }

  if (checkOnly) {
    console.log('(--check-only specified, not enabling)')
    process.exit(0)
  }

  console.log('Enabling...')
  const result = await enableService(token, project, service)
  if (!result.ok) {
    console.error(`✗ Enable failed: HTTP ${result.status} — ${result.error}`)
    if (result.status === 403) {
      console.error('')
      console.error('The service account does not have serviceusage.services.enable on this project.')
      console.error(`Matt: grant it at https://console.cloud.google.com/iam-admin/iam?project=${project}`)
      console.error('Grant role: "Service Usage Admin" (or Editor/Owner) to the SA email.')
      console.error('Or click the activation link directly:')
      console.error(`  https://console.developers.google.com/apis/api/${service}/overview?project=${project}`)
    }
    process.exit(1)
  }

  console.log(`✓ Enable request submitted: ${result.operation || '(no op name)'}`)
  if (result.done) {
    console.log('✓ Already done')
  } else {
    console.log('Waiting up to 30s for propagation...')
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const after = await checkServiceState(token, project, service)
      if (after.ok && after.state === 'ENABLED') {
        console.log(`✓ ${service} is now ENABLED`)
        process.exit(0)
      }
      console.log(`  ...still ${after.state || '?'}`)
    }
    console.log('State did not flip to ENABLED within 30s; check the GCP console.')
  }
}

main().catch((e) => {
  console.error(`FATAL: ${e?.message || e}`)
  if (e?.stack) console.error(e.stack)
  process.exit(1)
})
