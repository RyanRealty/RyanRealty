#!/usr/bin/env node
/**
 * Set GitHub Actions repository secrets from .env.local.
 *
 * Preferred: GITHUB_TOKEN or GH_TOKEN (classic PAT with `repo`, or fine-grained with
 * Repository → Actions → Secrets read/write) in the shell or .env.local. Uses REST API + Libsodium seal.
 *
 * Fallback: `gh secret set` when `gh` is installed and authenticated.
 *
 * Usage: node scripts/sync-github-secrets-from-local.mjs KEY1 KEY2 ... [--optional OPT1 OPT2 ...]
 * Optional keys are skipped (not uploaded) when missing or empty in .env.local.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { spawnSync, execSync } from 'child_process'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { seal } = require('tweetsodium')

const GH_API = 'https://api.github.com'

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  const raw = readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (val.startsWith('"') && val.endsWith('"'))
      val = val.slice(1, -1).replace(/\\n/g, '\n')
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
    env[key] = val
  }
  return env
}

function parseRepoFromRemote(url) {
  const u = String(url || '').trim()
  const m = u.match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/i)
  if (!m) return null
  return { owner: m[1], repo: m[2] }
}

function getOriginRepo() {
  try {
    const url = execSync('git remote get-url origin', { encoding: 'utf8' }).trim()
    return parseRepoFromRemote(url)
  } catch {
    return null
  }
}

function encryptSecret(value, publicKeyB64) {
  const messageBytes = Buffer.from(value, 'utf8')
  const keyBytes = Buffer.from(publicKeyB64, 'base64')
  const encryptedBytes = seal(messageBytes, keyBytes)
  return Buffer.from(encryptedBytes).toString('base64')
}

async function getRepoPublicKey(owner, repo, token) {
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/actions/secrets/public-key`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`public-key ${res.status}: ${text.slice(0, 400)}`)
  return JSON.parse(text)
}

async function putRepoSecret(owner, repo, token, secretName, plainValue, keyId, publicKey) {
  const encrypted_value = encryptSecret(plainValue, publicKey)
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/actions/secrets/${secretName}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ encrypted_value, key_id: keyId }),
  })
  if (!res.ok && res.status !== 204) {
    const text = await res.text()
    throw new Error(`PUT ${secretName} ${res.status}: ${text.slice(0, 400)}`)
  }
}

function assertGhReady() {
  const ghVersion = spawnSync('gh', ['--version'], { encoding: 'utf8' })
  if (ghVersion.status !== 0) {
    console.error('No GITHUB_TOKEN/GH_TOKEN and GitHub CLI (gh) is not on PATH.')
    console.error('Add to .env.local: GITHUB_TOKEN=<classic PAT with repo scope, or fine-grained Actions secrets read/write>')
    console.error('Or: brew install gh && gh auth login')
    process.exit(1)
  }
  const ghAuth = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' })
  if (ghAuth.status !== 0) {
    console.error('gh is installed but not logged in. Run: gh auth login')
    process.exit(1)
  }
}

function setViaGh(name, value) {
  const r = spawnSync('gh', ['secret', 'set', name], {
    input: value,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  if (r.status !== 0) {
    console.error(`gh secret set ${name} failed (gh repo set-default?)`)
    process.exit(r.status ?? 1)
  }
}

const rawArgs = process.argv.slice(2).filter(Boolean)
const optIdx = rawArgs.indexOf('--optional')
/** @type {string[]} */
let requiredKeys = []
/** @type {string[]} */
let optionalKeys = []
if (optIdx === -1) {
  requiredKeys = rawArgs
} else {
  requiredKeys = rawArgs.slice(0, optIdx)
  optionalKeys = rawArgs.slice(optIdx + 1).filter((a) => a !== '--optional')
}
if (requiredKeys.length === 0) {
  console.error(
    'Usage: node scripts/sync-github-secrets-from-local.mjs KEY1 [KEY2 ...] [--optional OPT1 [OPT2 ...]]'
  )
  process.exit(1)
}

const envPath = resolve(process.cwd(), '.env.local')
if (!existsSync(envPath)) {
  console.error('Missing .env.local')
  process.exit(1)
}

const fileEnv = loadEnvLocal()
const token = (
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN ||
  fileEnv.GITHUB_TOKEN ||
  fileEnv.GH_TOKEN ||
  ''
).trim()

for (const key of requiredKeys) {
  const val = fileEnv[key]
  if (val == null || String(val).trim() === '') {
    console.error(`Missing or empty ${key} in .env.local`)
    process.exit(1)
  }
}

const keysToSet = [...requiredKeys]
for (const key of optionalKeys) {
  const val = fileEnv[key]
  if (val != null && String(val).trim() !== '') {
    keysToSet.push(key)
  } else {
    console.log(`Skipping optional (missing or empty in .env.local): ${key}`)
  }
}

async function main() {
  if (token) {
    const repo = getOriginRepo()
    if (!repo) {
      console.error('Could not parse owner/repo from git remote origin')
      process.exit(1)
    }
    const { key, key_id } = await getRepoPublicKey(repo.owner, repo.repo, token)
    for (const name of keysToSet) {
      await putRepoSecret(repo.owner, repo.repo, token, name, fileEnv[name], key_id, key)
      console.log(`GitHub Actions secret set (API): ${name}`)
    }
    return
  }

  assertGhReady()
  for (const name of keysToSet) {
    setViaGh(name, fileEnv[name])
    console.log(`GitHub Actions secret set (gh): ${name}`)
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
