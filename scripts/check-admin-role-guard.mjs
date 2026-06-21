#!/usr/bin/env node
/**
 * check-admin-role-guard.mjs (ci:admin-role-guard) — audit p0.2d.
 *
 * upsertAdminRole + removeAdminRole are `'use server'` actions (public POST)
 * that mutate the admin_roles table via the SERVICE ROLE. They must guard the
 * CALLER as superuser before the write, or anyone could grant themselves an
 * admin role. This asserts both mutations carry the superuser caller guard.
 */
import { readFileSync } from 'node:fs'

const FILE = 'app/actions/admin-roles.ts'
const src = readFileSync(FILE, 'utf8')
const fails = []

const guardCount = (src.match(/actorRole !== 'superuser'/g) || []).length
if (guardCount < 2) {
  fails.push(`admin_roles mutations (upsertAdminRole + removeAdminRole) must guard the caller as superuser before any service-role write — found ${guardCount}/2 caller guards`)
}

console.log('admin-role mutation caller-guard gate (ci:admin-role-guard)')
console.log('==========================================================')
if (fails.length) {
  for (const f of fails) console.error('  ✗ ' + f)
  console.error('\nFAILED — see the p0.2d entry in docs/audit/REMEDIATION_PROGRESS.md.')
  process.exit(1)
}
console.log('OK — admin_roles mutations guard the caller as superuser.')
process.exit(0)
