#!/usr/bin/env node
/**
 * check-vercel-project-config.mjs — CI gate: "The Vercel project settings that
 * make the ship pipeline fast stay set."
 *
 * The 2026-08-21 pipeline work depends on server-side project settings no repo
 * file controls: full on-demand build concurrency, the Enhanced build machine,
 * production-fast-lane, previews disabled. They were verified live that day;
 * this gate re-verifies them on every push from a machine that holds Vercel
 * auth, so a dashboard change (accidental or well-meaning) is caught by the
 * next shipping session instead of resurfacing as "builds feel slow again".
 *
 * DESIRED is the canon. Changing a setting deliberately = change DESIRED in
 * the same commit and say why. buildMachineType is a Matt-level decision
 * (enhanced = speed at ~$0.10/deploy; elastic sizing = cheaper, slower).
 *
 * Credential-dependent: SKIPS with exit 0 when no Vercel token is reachable
 * (secret-less CI), per docs/MECHANICAL_GATES.md. Token resolution mirrors
 * scripts/check-vercel-deploy.mjs: VERCEL_TOKEN env → .env.local → Vercel CLI
 * stored auth.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadEnv } from '../lib/platform/env.mjs';

const PROJECT_ID = 'prj_7ApmWUMyZQR3IIQbSiqHyzSWZoaA';
const TEAM_ID = 'team_zwYQPapH0CpleD7RzJ7WctGO';

const DESIRED = {
  'resourceConfig.elasticConcurrencyEnabled': true, // full on-demand concurrency — simultaneous agent pushes never queue
  'resourceConfig.buildMachineType': 'enhanced', // 8 vCPU; pinned for speed (Matt priority 2026-08-21)
  'resourceConfig.buildMachineSelection': 'fixed', // flip to 'elastic' only as a deliberate cost decision
  'resourceConfig.fluid': true,
  productionDeploymentsFastLane: true, // Prioritize Production Builds
  previewDeploymentsDisabled: true, // branch pushes never burn Build CPU
  gitForkProtection: true,
  autoAssignCustomDomains: true, // READY prod deploy = ryan-realty.com flips automatically
  nodeVersion: '24.x',
};

async function loadToken() {
  await loadEnv(); // real env wins; .env.local only if present (VM parity)
  if (process.env.VERCEL_TOKEN?.trim()) return process.env.VERCEL_TOKEN.trim();
  for (const p of [
    path.join(os.homedir(), 'Library/Application Support/com.vercel.cli/auth.json'),
    path.join(os.homedir(), '.vercel/auth.json'),
  ]) {
    try {
      const t = JSON.parse(fs.readFileSync(p, 'utf8')).token;
      if (t) return t;
    } catch {
      /* try next */
    }
  }
  return null;
}

function dig(obj, dotted) {
  return dotted.split('.').reduce((o, k) => o?.[k], obj);
}

const token = await loadToken();
if (!token) {
  console.log('ci:vercel-config SKIP — no Vercel token in this environment (secret-less CI).');
  process.exit(0);
}

let project;
try {
  const res = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.log(`ci:vercel-config SKIP — Vercel API ${res.status} (token stale or offline); not a config verdict.`);
    process.exit(0);
  }
  project = await res.json();
} catch {
  console.log('ci:vercel-config SKIP — Vercel API unreachable (offline?); not a config verdict.');
  process.exit(0);
}

const drift = [];
for (const [key, want] of Object.entries(DESIRED)) {
  const got = dig(project, key);
  if (got !== want) drift.push({ key, want, got });
}

if (drift.length === 0) {
  console.log(`ci:vercel-config OK — ${Object.keys(DESIRED).length} project settings match canon`);
  process.exit(0);
}

console.error('ci:vercel-config FAIL — Vercel project settings drifted from canon:');
for (const d of drift) {
  console.error(`  ✗ ${d.key}: expected ${JSON.stringify(d.want)}, live value ${JSON.stringify(d.got)}`);
}
console.error('\nDeliberate change? Update DESIRED in scripts/check-vercel-project-config.mjs in the same');
console.error('commit and say why. To restore canon instead:');
console.error(`  PATCH https://api.vercel.com/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}`);
console.error('  (dashboard: Settings → Build and Deployment on the ryanrealty project)');
process.exit(1);
