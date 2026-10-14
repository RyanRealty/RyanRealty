/**
 * deploy-defects: deploy:verify's defect filer, and the claim path for the nodes it files.
 * Run under the react-server condition (the work-graph DAL carries `server-only`):
 *
 *   npx tsx --conditions=react-server scripts/deploy-defects.ts --claim DEPLOY-<id> --owner <tool>-<model>-<YYYY-MM-DD>
 *   npx tsx --conditions=react-server scripts/deploy-defects.ts --status [DEPLOY-<id>]
 *   npx tsx --conditions=react-server scripts/deploy-defects.ts --touch DEPLOY-<id> --owner <same>      # heartbeat
 *   npx tsx --conditions=react-server scripts/deploy-defects.ts --release DEPLOY-<id> --owner <same>    # cannot finish
 *   npx tsx --conditions=react-server scripts/deploy-defects.ts --complete DEPLOY-<id> --owner <same> --evidence "<the passing run>"
 *
 * Called by scripts/lib/deploy-defect-report.mjs (never by hand):
 *   --file [--dry-run]   a deploy:verify run as JSON on stdin; files what failed, closes what passed
 *   --read               the active deploy-found nodes as JSON (the sitemap walk fetches their URLs first)
 *
 * Every read and write is a work-graph DAL call (lib/data/loop/deploy-defects-dal.ts);
 * this file holds no table access and writes no claim by hand. The rules live in
 * lib/data/loop/deploy-defects.ts. Not imported by the app.
 */
import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
import { deployDefectOps } from '../lib/data/loop/deploy-defects-dal'
import {
  DEPLOY_CHECK_FAMILIES,
  existingNodeLine,
  keyPath,
  parseDeployGap,
  parseFailingKeys,
  reconcileDeployDefects,
  type DeployDefectOps,
  type DeployNodeView,
  type DeployVerifyRun,
} from '../lib/data/loop/deploy-defects'
import { touchWorkNode } from '../lib/data/loop/work-graph'

config({ path: '.env.local', quiet: true })

const argv = process.argv.slice(2)
const flag = (name: string) => argv.includes(name)
const value = (name: string): string => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ''
}

/** A dry run cannot write even if a caller asks it to: the write ops refuse. */
function refuseWrites(ops: DeployDefectOps): DeployDefectOps {
  const refuse = async () => {
    throw new Error('dry run: a write was attempted and refused')
  }
  return { ...ops, create: refuse, claim: refuse, complete: refuse, release: refuse }
}

async function findNode(ops: DeployDefectOps, ref: string): Promise<DeployNodeView | null> {
  return (await ops.list()).find((n) => n.versionGap === ref || n.id === ref) ?? null
}

function owner(): string {
  const o = value('--owner')
  if (!o) {
    console.error('--owner <tool>-<model>-<YYYY-MM-DD> is required')
    process.exit(2)
  }
  if (/[<>]/.test(o)) {
    console.error(`--owner ${o}: replace <tool>-<model> with your own (for example cursor-gpt-2026-10-14)`)
    process.exit(2)
  }
  return o
}

function need(name: string): string {
  const ref = value(name)
  if (!ref) {
    console.error(`usage: ${name} DEPLOY-<id> --owner <tool>-<model>-<YYYY-MM-DD>`)
    process.exit(2)
  }
  return ref
}

async function main() {
  const ops = deployDefectOps()

  if (flag('--file')) {
    const run = JSON.parse(readFileSync(0, 'utf8')) as DeployVerifyRun
    const dry = flag('--dry-run') || run.write === false
    const report = await reconcileDeployDefects({ ...run, write: !dry }, dry ? refuseWrites(ops) : ops)
    console.log(JSON.stringify(report))
    return
  }

  if (flag('--read')) {
    const nodes = (await ops.list()).filter((n) => ['open', 'in_progress', 'blocked'].includes(n.state))
    console.log(
      JSON.stringify({
        nodes: nodes.map((n) => ({
          gap: n.versionGap,
          family: parseDeployGap(n.versionGap)?.family ?? null,
          state: n.state,
          owner: n.ownerSession,
          updatedAt: n.updatedAt,
          paths: parseFailingKeys(n.objective).map(keyPath).filter((p): p is string => p !== null),
        })),
      }),
    )
    return
  }

  if (flag('--status')) {
    const ref = value('--status')
    const nodes = (await ops.list()).filter((n) => (ref ? n.versionGap === ref || n.id === ref : ['open', 'in_progress', 'blocked'].includes(n.state)))
    if (nodes.length === 0) console.log(ref ? `${ref}: no such deploy-found node` : 'no open deploy-found nodes')
    for (const n of nodes) {
      const gap = n.versionGap ?? n.id
      console.log(n.state === 'done' || n.state === 'killed' ? `${gap} is ${n.state}` : existingNodeLine(n))
    }
    process.exit(ref && nodes.length === 0 ? 1 : 0)
  }

  if (flag('--claim')) {
    const ref = need('--claim')
    const me = owner()
    const node = await findNode(ops, ref)
    if (!node) {
      console.error(`${ref}: no such deploy-found node`)
      process.exit(1)
    }
    const gap = node.versionGap ?? node.id
    if (node.state === 'in_progress' && node.ownerSession === me) {
      console.log(`${gap}: already yours (${me})`)
      return
    }
    if (node.state !== 'open') {
      console.error(node.state === 'done' || node.state === 'killed' ? `${gap} is ${node.state}: nothing to claim` : existingNodeLine(node))
      process.exit(1)
    }
    const res = await ops.claim(node.id, me)
    if (!res.ok) {
      console.error(`${gap}: not claimed (${res.error ?? 'claim failed'}). Someone else took it; leave it.`)
      process.exit(1)
    }
    console.log(`${gap}: claimed by ${me}`)
    const { label, reproduce } = DEPLOY_CHECK_FAMILIES[parseDeployGap(gap)?.family ?? 'homepage']
    console.log(`\n${label}. Reproduce first: ${reproduce}\n\n${node.objective}\n`)
    console.log(`heartbeat while you hold it:\n  npx tsx --conditions=react-server scripts/deploy-defects.ts --touch ${gap} --owner ${me}`)
    console.log('A later deploy:verify that passes this check completes the node itself; otherwise --complete it with the passing run.')
    return
  }

  if (flag('--touch')) {
    const ref = need('--touch')
    const me = owner()
    const node = await findNode(ops, ref)
    if (!node) {
      console.error(`${ref}: no such deploy-found node`)
      process.exit(1)
    }
    const res = await touchWorkNode(node.id, me)
    if (res.error) {
      console.error(`${node.versionGap}: ${res.error}`)
      process.exit(1)
    }
    console.log(`${node.versionGap}: heartbeat`)
    return
  }

  if (flag('--release')) {
    const ref = need('--release')
    const me = owner()
    const node = await findNode(ops, ref)
    if (!node || node.state !== 'in_progress' || node.ownerSession !== me) {
      console.error(`${ref}: not held by ${me}; nothing to release`)
      process.exit(1)
    }
    const res = await ops.release(node.id)
    if (!res.ok) {
      console.error(`${ref}: ${res.error ?? 'release failed'}`)
      process.exit(1)
    }
    console.log(`${node.versionGap}: released (open, no owner)`)
    return
  }

  if (flag('--complete')) {
    const ref = need('--complete')
    const me = owner()
    const evidence = value('--evidence')
    if (!evidence.trim()) {
      console.error('--evidence "<the passing run>" is required: a node is done when the environment says so')
      process.exit(2)
    }
    const node = await findNode(ops, ref)
    if (!node || node.state !== 'in_progress' || node.ownerSession !== me) {
      console.error(`${ref}: not held by ${me}; claim it before you complete it`)
      process.exit(1)
    }
    const res = await ops.complete(node.id, evidence)
    if (!res.ok) {
      console.error(`${ref}: ${res.error ?? 'complete failed'}`)
      process.exit(1)
    }
    console.log(`${node.versionGap}: done`)
    return
  }

  console.error('usage: --claim|--status|--touch|--release|--complete DEPLOY-<id> [--owner <tool>-<model>-<YYYY-MM-DD>]')
  process.exit(2)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
