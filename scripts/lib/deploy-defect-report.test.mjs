import { describe, expect, it } from 'vitest'
import {
  FILER_SCRIPT,
  createDefectReport,
  noFileRequested,
  parseFilerJson,
  runFiler,
} from './deploy-defect-report.mjs'

const OK = (lines, outcomes = []) => ({ status: 0, stdout: `${JSON.stringify({ lines, outcomes })}\n`, stderr: '' })

function fakeRun(reply) {
  const calls = []
  const run = (args, input, opts) => {
    calls.push({ args, input: input === undefined ? undefined : JSON.parse(input), opts })
    return typeof reply === 'function' ? reply(args, input) : reply
  }
  return { run, calls }
}

describe('--no-file', () => {
  it('is the flag or DEPLOY_VERIFY_NO_FILE=1, and nothing else', () => {
    expect(noFileRequested(['--no-file'], {})).toBe(true)
    expect(noFileRequested(['abc1234', '--no-file'], {})).toBe(true)
    expect(noFileRequested([], { DEPLOY_VERIFY_NO_FILE: '1' })).toBe(true)
    expect(noFileRequested([], { DEPLOY_VERIFY_NO_FILE: '0' })).toBe(false)
    expect(noFileRequested(['abc1234'], {})).toBe(false)
  })
})

describe('the filer process', () => {
  it('runs scripts/deploy-defects.ts under tsx with the react-server condition', () => {
    const seen = []
    runFiler(['--file'], '{}', { cwd: '/nowhere', spawn: (cmd, args, opts) => (seen.push({ cmd, args, opts }), { status: 0 }) })
    expect(seen[0].cmd).toBe('npx')
    expect(seen[0].args).toEqual(['--no-install', 'tsx', '--conditions=react-server', FILER_SCRIPT, '--file'])
    expect(FILER_SCRIPT).toBe('scripts/deploy-defects.ts')
    expect(seen[0].opts.input).toBe('{}')
    expect(seen[0].opts.timeout).toBeGreaterThan(0)
  })

  it('reads the JSON line the filer prints last, through any warnings tsx prints first', () => {
    expect(parseFilerJson('(node:1) ExperimentalWarning: x\n{"lines":["a"]}\n')).toEqual({ lines: ['a'] })
    expect(parseFilerJson('not json')).toBeNull()
    expect(parseFilerJson('')).toBeNull()
    expect(parseFilerJson(undefined)).toBeNull()
  })
})

describe('createDefectReport', () => {
  it('sends every recorded result, the sha and the time, and returns the lines the filer printed', () => {
    const { run, calls } = fakeRun(OK(['Filed DEPLOY-live-seo-0123456789 (unclaimed): claim it with x']))
    const report = createDefectReport({ sha: 'abc1234', at: '2026-10-14T20:00:00.000Z', run })
    report.record({ family: 'live-seo', status: 'fail', keys: ['/team: no <title>'] })
    report.record({ family: 'inline-scripts', status: 'pass', evidence: 'ok' })
    const out = report.flush()
    expect(out.lines).toEqual(['Filed DEPLOY-live-seo-0123456789 (unclaimed): claim it with x'])
    expect(calls).toHaveLength(1)
    expect(calls[0].args).toEqual(['--file'])
    expect(calls[0].input).toEqual({
      sha: 'abc1234',
      at: '2026-10-14T20:00:00.000Z',
      write: true,
      results: [
        { family: 'live-seo', status: 'fail', keys: ['/team: no <title>'] },
        { family: 'inline-scripts', status: 'pass', evidence: 'ok' },
      ],
    })
  })

  it('asks the filer for a dry run when writes are off', () => {
    const { run, calls } = fakeRun(OK([]))
    const report = createDefectReport({ sha: 'abc1234', write: false, run })
    report.record({ family: 'live-seo', status: 'fail', keys: ['/team: no <title>'] })
    report.flush()
    expect(calls[0].args).toEqual(['--file', '--dry-run'])
    expect(calls[0].input.write).toBe(false)
  })

  it('does not spawn anything when nothing failed or passed', () => {
    const { run, calls } = fakeRun(OK([]))
    const report = createDefectReport({ sha: 'abc1234', run })
    expect(report.flush()).toEqual({ lines: [], outcomes: [] })
    report.record({ family: 'live-seo', status: 'skipped' })
    expect(report.flush().lines).toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('never throws: a failed child, a timeout, garbage output or a throwing spawn prints one line that says the failure was not filed', () => {
    const cases = [
      { status: 1, stdout: '', stderr: 'Error: Supabase service role not configured\n' },
      { status: null, stdout: '', stderr: '', error: Object.assign(new Error('spawnSync npx ETIMEDOUT'), { code: 'ETIMEDOUT' }) },
      { status: 0, stdout: 'garbage', stderr: '' },
      { status: null, signal: 'SIGKILL', stdout: '', stderr: '' },
      () => {
        throw new Error('spawn failed')
      },
    ]
    for (const reply of cases) {
      const { run } = fakeRun(reply)
      const report = createDefectReport({ sha: 'abc1234', run })
      report.record({ family: 'live-seo', status: 'fail', keys: ['/team: no <title>'] })
      const { lines } = report.flush()
      expect(lines).toHaveLength(1)
      expect(lines[0]).toMatch(/^deploy-defect filing unavailable \(.+\): 1 failing check\(s\) NOT filed/)
    }
  })

  it('says nothing when only passes were sent and the filer is unavailable', () => {
    const { run } = fakeRun({ status: 1, stdout: '', stderr: 'down' })
    const report = createDefectReport({ sha: 'abc1234', run })
    report.record({ family: 'live-seo', status: 'pass' })
    expect(report.flush().lines).toEqual([])
  })

  it('reads the open nodes once and returns the URLs they name for one check', () => {
    const { run, calls } = fakeRun(() => ({
      status: 0,
      stdout: JSON.stringify({
        nodes: [
          { gap: 'DEPLOY-sitemap-url-health-aaaaaaaaaa', family: 'sitemap-url-health', state: 'open', owner: null, paths: ['/open-houses/bend', '/open-houses/redmond'] },
          { gap: 'DEPLOY-sitemap-url-health-bbbbbbbbbb', family: 'sitemap-url-health', state: 'in_progress', owner: 'x', paths: ['/open-houses/bend'] },
          { gap: 'DEPLOY-live-seo-cccccccccc', family: 'live-seo', state: 'open', owner: null, paths: ['/team'] },
        ],
      }),
    }))
    const report = createDefectReport({ sha: 'abc1234', run })
    expect(report.priorityPaths('sitemap-url-health')).toEqual(['/open-houses/bend', '/open-houses/redmond'])
    expect(report.priorityPaths('live-seo')).toEqual(['/team'])
    expect(report.priorityPaths('sitemap-smoke')).toEqual([])
    expect(calls).toHaveLength(1)
    expect(calls[0].args).toEqual(['--read'])
  })

  it('returns no priority URLs, and does not throw, when the read fails or answers with the wrong shape', () => {
    for (const reply of [{ status: 1, stdout: '', stderr: 'x' }, { status: 0, stdout: '{}' }, { status: 0, stdout: 'null' }, () => { throw new Error('nope') }]) {
      const { run } = fakeRun(reply)
      expect(createDefectReport({ sha: 'abc1234', run }).priorityPaths('sitemap-url-health')).toEqual([])
    }
  })
})
