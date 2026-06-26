import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { sendDeployHealthAlertEmail } from '@/lib/deploy-health-alert'

export const dynamic = 'force-dynamic'

/**
 * deploy-health — the backstop for the silent-deploy-break failure mode.
 *
 * A build break (e.g. a Turbopack-only use-server/RSC error that tsc + ci:gates
 * miss) deploys to Vercel as `state: ERROR`; the production alias stays on the
 * last good deployment, so new commits silently never go live. That broke the
 * whole CRM Wave 3->9 series for days with every gate green.
 *
 * This cron runs ON the live production deployment, so its own
 * VERCEL_GIT_COMMIT_SHA IS the commit the live site was built from. It compares
 * that to the current HEAD of origin/main (public GitHub API, no token needed).
 * If the live site is behind main past a grace window (a normal deploy finishes
 * in a few minutes), it emails Matt — the deploy pipeline is stuck.
 *
 * No Vercel API token required: the deployed SHA comes from the runtime env Vercel
 * already sets, the latest SHA from the public repo. Re-alerts each run while
 * stuck (an undeployed-prod incident is worth repeating); silent once prod
 * catches up. Self-failures (GitHub down, no SHA locally) never alert.
 */

const REPO = 'RyanRealty/RyanRealty'
const GRACE_MINUTES = 20

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const deployedSha = process.env.VERCEL_GIT_COMMIT_SHA
  if (!deployedSha) {
    // Local / preview / non-git build — nothing to compare against.
    return NextResponse.json({ ok: true, status: 'skipped', reason: 'no VERCEL_GIT_COMMIT_SHA' })
  }

  let latest: { sha: string; date: string; subject: string }
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
      headers: { 'User-Agent': 'ryan-realty-deploy-health', Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      // Our own check failing (rate limit, GitHub down) must never page Matt.
      return NextResponse.json({ ok: true, status: 'skipped', reason: `github ${res.status}` })
    }
    const json = (await res.json()) as {
      sha: string
      commit: { committer: { date: string }; message: string }
    }
    latest = {
      sha: json.sha,
      date: json.commit.committer.date,
      subject: (json.commit.message || '').split('\n')[0].slice(0, 120),
    }
  } catch (err) {
    return NextResponse.json({
      ok: true,
      status: 'skipped',
      reason: err instanceof Error ? err.message : 'github fetch failed',
    })
  }

  if (deployedSha === latest.sha) {
    return NextResponse.json({ ok: true, status: 'current', deployedSha })
  }

  const behindMinutes = Math.round((Date.now() - new Date(latest.date).getTime()) / 60000)
  if (behindMinutes < GRACE_MINUTES) {
    // Within the normal deploy window — a build is probably still running.
    return NextResponse.json({ ok: true, status: 'deploying', behindMinutes, deployedSha, latestSha: latest.sha })
  }

  // Stale past the grace window → a deploy is stuck/failed. Alert.
  const alert = await sendDeployHealthAlertEmail({
    deployedSha,
    latestSha: latest.sha,
    latestCommitSubject: latest.subject,
    behindMinutes,
  })

  return NextResponse.json({
    ok: true,
    status: 'stale',
    behindMinutes,
    deployedSha,
    latestSha: latest.sha,
    alerted: alert.ok,
    alertError: alert.ok ? undefined : alert.error,
  })
}
