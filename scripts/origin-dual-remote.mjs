#!/usr/bin/env node
/**
 * origin-dual-remote.mjs — add Cursor Origin as a second remote.
 *
 * GitHub stays `origin` (canonical while mirrored). Origin is added as
 * `cursor`. This script never detaches, never rewrites `origin`, and never
 * deletes GitHub.
 *
 * Usage:
 *   npm run origin:dual-remote
 *   ORIGIN_REPO=ryanrealty/RyanRealty npm run origin:dual-remote
 *
 * Auth:
 *   origin auth login
 *   # or CURSOR_API_KEY / CURSOR_AUTH_TOKEN in the environment
 *
 * Docs: docs/ORIGIN_CUTOVER.md
 */
import { execFileSync, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const GITHUB_ORIGIN_HOST = 'github.com/RyanRealty/RyanRealty'
const DEFAULT_NAME_HINTS = ['RyanRealty', 'ryanrealty']

function out(msg) {
  process.stdout.write(`[origin:dual-remote] ${msg}\n`)
}

function fail(msg, code = 1) {
  process.stderr.write(`[origin:dual-remote] ${msg}\n`)
  process.exit(code)
}

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim()
}

function findOriginBin() {
  const candidates = [
    process.env.ORIGIN_BIN,
    '/exec-daemon/tools/origin',
    `${process.env.HOME || ''}/.local/bin/origin`,
    'origin',
  ].filter(Boolean)
  for (const bin of candidates) {
    try {
      if (bin.includes('/') && !existsSync(bin)) continue
      execFileSync(bin, ['--version'], { stdio: 'ignore' })
      return bin
    } catch {
      // try next
    }
  }
  return null
}

function origin(bin, args, opts = {}) {
  return execFileSync(bin, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  }).trim()
}

function remoteUrl(name) {
  try {
    return sh(`git remote get-url ${name}`)
  } catch {
    return null
  }
}

function stripAuth(url) {
  return url.replace(/https:\/\/[^@]+@/, 'https://')
}

function ensureGithubOrigin() {
  const url = remoteUrl('origin')
  if (!url) fail('No git remote named origin. Stay in the RyanRealty checkout.')
  const clean = stripAuth(url)
  if (!clean.includes('github.com') || !/RyanRealty\/RyanRealty/i.test(clean)) {
    fail(
      `Refusing to continue: origin is not GitHub RyanRealty/RyanRealty.\n  origin=${clean}\n  This helper only adds a second remote while GitHub is still canonical.`,
    )
  }
  out(`origin (canonical) ${clean}`)
  return clean
}

function loginNeededMessage() {
  return [
    'Origin CLI is not logged in.',
    'On this machine run:  origin auth login',
    'Or set CURSOR_API_KEY and rerun npm run origin:dual-remote',
    'Install: curl -fsSL https://downloads.cursor.com/origin/install.sh | sh',
  ].join('\n  ')
}

function loginIfNeeded(bin) {
  if (process.env.CURSOR_API_KEY?.trim()) {
    out('Logging in with CURSOR_API_KEY')
    origin(bin, ['auth', 'login', '--api-key', process.env.CURSOR_API_KEY.trim(), '--local'])
    return
  }

  let status = ''
  try {
    status = origin(bin, ['auth', 'status'])
  } catch (err) {
    status = String(err?.stderr || err?.stdout || err?.message || '')
  }

  if (!status || /not logged in/i.test(status) || /command failed/i.test(status)) {
    fail(loginNeededMessage(), 2)
  }
  out(status.split('\n')[0] || 'Origin CLI authenticated')
}

function parseRepoSlugs(listText) {
  const slugs = new Set()
  for (const line of listText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(/\b([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\b/)
    if (match) slugs.add(match[1])
  }
  return [...slugs]
}

function resolveOriginRepo(bin) {
  const explicit = (process.env.ORIGIN_REPO || '').trim()
  if (explicit) {
    out(`Using ORIGIN_REPO=${explicit}`)
    return explicit
  }

  let listText = ''
  try {
    listText = origin(bin, ['repo', 'list'])
  } catch (err) {
    fail(`origin repo list failed.\n  ${String(err?.stderr || err?.message || err)}`, 2)
  }

  const slugs = parseRepoSlugs(listText)
  const matches = slugs.filter((slug) => DEFAULT_NAME_HINTS.some((hint) => slug.toLowerCase().endsWith(`/${hint.toLowerCase()}`)))

  if (matches.length === 1) return matches[0]
  if (matches.length > 1) {
    fail(
      [
        'Multiple Origin repos look like RyanRealty. Set ORIGIN_REPO=owner/name and rerun.',
        ...matches.map((slug) => `  ${slug}`),
      ].join('\n'),
      2,
    )
  }

  if (slugs.length === 1) return slugs[0]

  fail(
    [
      'Could not find an Origin repo named RyanRealty.',
      'Set ORIGIN_REPO=owner/name from https://cursor.com/codebase and rerun.',
      listText ? `origin repo list:\n${listText}` : 'origin repo list was empty.',
    ].join('\n  '),
    2,
  )
}

function viewRepo(bin, repo) {
  try {
    return origin(bin, [
      'repo',
      'view',
      repo,
      '--json',
      'org,name,defaultBranch,cloneUrl,fullName',
    ])
  } catch {
    try {
      return origin(bin, ['repo', 'view', repo])
    } catch (err) {
      fail(`origin repo view ${repo} failed.\n  ${String(err?.stderr || err?.message || err)}`, 2)
    }
  }
}

function cloneUrlFor(repo, viewed) {
  try {
    const parsed = JSON.parse(viewed)
    const clone = parsed.cloneUrl || parsed.clone_url
    if (clone) return { cloneUrl: clone, label: parsed.fullName || repo }
  } catch {
    // text view
  }
  return {
    cloneUrl: `https://origin.cursor.com/${repo}.git`,
    label: repo,
  }
}

function addCursorRemote(cloneUrl) {
  const existing = remoteUrl('cursor')
  if (existing) {
    const clean = stripAuth(existing)
    const want = stripAuth(cloneUrl)
    if (clean.replace(/\.git$/, '') === want.replace(/\.git$/, '')) {
      out(`cursor remote already set ${clean}`)
      return
    }
    out(`Updating cursor remote ${clean} -> ${want}`)
    sh(`git remote set-url cursor ${JSON.stringify(cloneUrl).slice(1, -1)}`)
    return
  }
  sh(`git remote add cursor ${JSON.stringify(cloneUrl).slice(1, -1)}`)
  out(`Added cursor remote ${stripAuth(cloneUrl)}`)
}

function fetchCursor() {
  try {
    sh('git fetch cursor --prune')
    out('Fetched cursor (Origin). GitHub origin was not changed.')
  } catch (err) {
    fail(
      [
        'Added the cursor remote but git fetch cursor failed.',
        'Run origin auth login (or origin auth setup-git --local) and retry.',
        String(err?.stderr || err?.message || err),
      ].join('\n  '),
      2,
    )
  }
}

function printNext() {
  out('')
  out('GitHub remains the source of truth. Do not Detach from GitHub yet.')
  out('Next (browser, one sitting):')
  out('  1. Open the Origin repo → Apps → connect Vercel to the same Ryan Realty project.')
  out('  2. Do not disconnect the GitHub↔Vercel integration.')
  out('  3. On the Claude IDE machine: git pull, then npm run origin:dual-remote')
  out('  4. Detach only after an Origin-triggered production deploy is READY.')
}

const bin = findOriginBin()
if (!bin) {
  fail(
    'Origin CLI not found. Install with:\n  curl -fsSL https://downloads.cursor.com/origin/install.sh | sh',
    2,
  )
}

out(`Using ${bin}`)
ensureGithubOrigin()
loginIfNeeded(bin)
origin(bin, ['auth', 'setup-git', '--local'])
const repo = resolveOriginRepo(bin)
out(`Origin repo ${repo}`)
const viewed = viewRepo(bin, repo)
const { cloneUrl, label } = cloneUrlFor(repo, viewed)
out(`Origin clone ${stripAuth(cloneUrl)} (${label})`)
addCursorRemote(cloneUrl)
fetchCursor()
printNext()
