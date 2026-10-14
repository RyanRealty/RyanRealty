// The one rule for an APPROVED technique (Matt 2026-10-14: "nothing is approved by an agent").
//
// Interim, until Matt's /admin approvals live in the database: a registry row is
// approved only when it says approved_by "matt", carries an ISO approved_on date,
// and names a reel that exists: a repo path that is a file in this checkout, or an
// https URL that answers a HEAD request within the timeout. The commit-msg gate
// (scripts/check-technique-approval.mjs) refuses a commit that adds or changes an
// approved row unless the message carries `Approved-by: matt` and names the technique.
//
// One source for three readers: video_gate.mjs, scripts/check-studio-techniques.mjs
// and lib/studio/qa/techniques.ts (the render preflight and video:check check 15).
import { statSync } from 'node:fs';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APPROVER = 'matt';
/**
 * The only approver a TEST-ONLY registry may name. A registry is test-only when a
 * test hands it in through a code seam (RenderDeps.registryPath, CheckDeps.testPaths,
 * the gate's `opts`); the committed file and the CLI never are. Never "matt".
 */
export const TEST_APPROVER = 'test-only stub';
export const REEL_HEAD_TIMEOUT_MS = 8000;
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** A real calendar date written YYYY-MM-DD. */
export function isIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/** "url" for an https URL, "path" for a path inside the repo, null for anything else (http, file:, absolute, ../). */
export function reelKind(reel) {
  if (typeof reel !== 'string' || !reel.trim() || reel !== reel.trim()) return null;
  if (/^https:\/\/[^\s/?#]+[^\s]*$/i.test(reel)) return 'url';
  if (/^[a-z][a-z0-9+.-]*:/i.test(reel) || isAbsolute(reel) || reel.startsWith('~') || reel.startsWith('-')) return null;
  return reel.split(/[\\/]/).includes('..') ? null : 'path';
}

/** True when a repo-path reel is a file inside `root`. */
export function repoReelExists(reel, root = REPO_ROOT) {
  const p = resolve(root, reel);
  if (p !== root && !p.startsWith(root + sep)) return false;
  try { return statSync(p).isFile(); } catch { return false; }
}

/**
 * HEAD an https reel; true only for a 2xx answer inside the timeout.
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 * @returns {Promise<boolean>}
 */
export async function headReel(url, { fetchImpl = globalThis.fetch, timeoutMs = REEL_HEAD_TIMEOUT_MS } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: 'HEAD', redirect: 'follow', signal: ac.signal });
    return Boolean(res && res.ok);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function reelFor(t, root) {
  const kind = reelKind(t.reel);
  if (kind === 'path') return repoReelExists(t.reel, root);
  if (kind === 'url') return null;
  return false;
}

/**
 * Whether each approved row's reel exists, as Map name -> true | false | null.
 * repoReels checks repo paths on disk and leaves https reels null (not checked);
 * checkReels also HEAD-checks every https reel.
 */
/**
 * @param {Record<string, any>} techniques
 * @param {string} [root]
 * @returns {Map<string, boolean | null>}
 */
export function repoReels(techniques, root = REPO_ROOT) {
  const out = new Map();
  for (const [name, t] of Object.entries(techniques || {})) {
    if (t && typeof t === 'object' && t.status === 'approved') out.set(name, reelFor(t, root));
  }
  return out;
}

/**
 * @param {Record<string, any>} techniques
 * @param {{ root?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 * @returns {Promise<Map<string, boolean | null>>}
 */
export async function checkReels(techniques, { root = REPO_ROOT, fetchImpl, timeoutMs } = {}) {
  const out = repoReels(techniques, root);
  await Promise.all([...out.keys()].map(async (name) => {
    const t = techniques[name];
    if (reelKind(t.reel) === 'url') out.set(name, await headReel(t.reel, { fetchImpl, timeoutMs }));
  }));
  return out;
}

/**
 * Why an approved row's approval does not hold; [] when it does. `reelFound` is the
 * answer from repoReels/checkReels (true, false, or null for an https reel not yet checked).
 */
/**
 * @param {any} t
 * @param {{ approver?: string, reelFound?: boolean | null }} [opts]
 * @returns {string[]}
 */
export function approvalProblems(t, { approver = APPROVER, reelFound = null } = {}) {
  const out = [];
  if (!t || typeof t !== 'object') return ['is not an object'];
  if (t.approved_by !== approver) out.push(`approved_by is ${JSON.stringify(t.approved_by ?? null)}, not "${approver}"`);
  if (!isIsoDate(t.approved_on)) out.push('has no approved_on ISO date (YYYY-MM-DD)');
  const kind = reelKind(t.reel);
  if (typeof t.reel !== 'string' || !t.reel.trim()) out.push('has no reel (the repo path or https URL of the showcase render Matt saw)');
  else if (!kind) out.push(`reel ${JSON.stringify(t.reel)} is neither a repo path nor an https URL`);
  else if (reelFound === null || reelFound === undefined) out.push(`reel ${t.reel} was not HEAD-checked`);
  else if (!reelFound) out.push(kind === 'url' ? `reel ${t.reel} did not answer a HEAD request` : `reel ${t.reel} is not a file in this checkout`);
  return out;
}
