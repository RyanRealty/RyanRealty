/**
 * The approval a TEST-ONLY registry gives its stub signature technique. It names
 * TEST_APPROVER (never "matt") and a test-only reel file, so it holds only in a
 * registry a test hands in through a code seam (RenderDeps.registryPath,
 * CheckDeps.testPaths, video_gate's opts.approver). The committed registry
 * approves nothing (scripts/__tests__/check-studio-techniques.test.mjs).
 *
 * reachability: entry-point test fixture, imported only by the studio tests (check, techniques, preflight, render).
 */
import { TEST_APPROVER } from '../techniques'

export const TEST_ONLY_REEL = 'lib/studio/qa/fixtures/test-only-reel.txt'

export const TEST_ONLY_APPROVAL = { approved_by: TEST_APPROVER, approved_on: '2026-10-14', reel: TEST_ONLY_REEL } as const
