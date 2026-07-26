#!/usr/bin/env node
/**
 * check-person-workspace-single-tree.mjs — spec-03 RC3 is gated, not prose.
 *
 * Fails when the person workspace regresses to a route-level mobile fork:
 *  - crm/[id]/mobile-detail.tsx must not exist (moved under person-detail/)
 *  - route page must Suspense-stream PersonWorkspaceBody
 *  - PersonWorkspace must own both md:hidden and hidden md:block layouts
 */
import { existsSync, readFileSync } from 'node:fs'

const fails = []

const FORBIDDEN = 'app/admin/(protected)/crm/[id]/mobile-detail.tsx'
if (existsSync(FORBIDDEN)) {
  fails.push(`${FORBIDDEN} still exists — RC3 requires one PersonWorkspace tree (delete the route fork)`)
}

const page = 'app/admin/(protected)/crm/[id]/page.tsx'
const pageSrc = readFileSync(page, 'utf8')
for (const re of [/PersonWorkspaceBody/, /Suspense/, /PersonWorkspaceSkeleton/]) {
  if (!re.test(pageSrc)) fails.push(`${page}: missing ${re}`)
}
if (/md:hidden/.test(pageSrc) || /hidden md:block/.test(pageSrc)) {
  fails.push(`${page}: still owns the md fork — move layout into PersonWorkspace`)
}
if (/from ['"]\.\/mobile-detail['"]/.test(pageSrc) || /from ['"][^'"]*MobileLeadDetail['"]/.test(pageSrc)) {
  fails.push(`${page}: must not import MobileLeadDetail directly`)
}

const workspace = 'components/admin/crm/person-detail/PersonWorkspace.tsx'
const wsSrc = readFileSync(workspace, 'utf8')
for (const re of [/forceMobile/, /md:hidden/, /hidden md:block/]) {
  if (!re.test(wsSrc)) fails.push(`${workspace}: missing ${re}`)
}

const mobile = 'components/admin/crm/person-detail/MobileLeadDetail.tsx'
if (!existsSync(mobile)) fails.push(`${mobile}: missing (mobile tabs live here under PersonWorkspace)`)

if (fails.length) {
  console.error('ci:person-workspace-single-tree FAILED:')
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('ci:person-workspace-single-tree OK — one PersonWorkspace tree, Suspense identity shell')
process.exit(0)
