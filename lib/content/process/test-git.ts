/**
 * lib/content/process/test-git.ts - a throwaway git repository for tests that need one.
 *
 * On 2026-10-14 a test ran git under the pre-commit hook's environment and set
 * core.bare=true on the main repository. So: every inherited GIT_* variable is
 * removed from the child's environment, and the three that pick the repository
 * (GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE) are set explicitly to paths inside
 * the temp folder. Nothing here touches the checkout the test runs in, runs
 * `git config`, resets, rebases, fetches or reaches the network.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { withoutAnyGitVar } from './freshness'

export type RepoShape = 'level' | 'ahead' | 'behind' | 'diverged' | 'no-origin'

export type TempRepo = {
  env: NodeJS.ProcessEnv
  /** The work tree (also the cwd git runs in). */
  work: string
  head: string
  main: string | null
  /** Run git in the temp repository; throws on a non-zero exit. */
  git: (...args: string[]) => string
}

/** A repository in `dir` whose HEAD and refs/remotes/origin/main are in the given relation. */
export function makeTempRepo(dir: string, shape: RepoShape): TempRepo {
  const work = join(dir, 'work')
  const gitDir = join(dir, 'repo.git')
  mkdirSync(work, { recursive: true })
  const env = {
    ...withoutAnyGitVar(process.env),
    GIT_DIR: gitDir,
    GIT_WORK_TREE: work,
    GIT_INDEX_FILE: join(dir, 'index'),
    GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.invalid',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  } as NodeJS.ProcessEnv
  const git = (...args: string[]): string => {
    const r = spawnSync('git', args, { encoding: 'utf8', env, cwd: work })
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`)
    return r.stdout.trim()
  }
  const commit = (file: string, text: string): string => {
    writeFileSync(join(work, file), text)
    git('add', file)
    git('commit', '-q', '-m', `add ${file}`)
    return git('rev-parse', 'HEAD')
  }
  git('init', '-q', '-b', 'main')
  const a = commit('a.txt', 'a\n')
  let main: string | null = null
  if (shape === 'level') main = a
  else if (shape === 'ahead') {
    main = a
    commit('b.txt', 'b\n')
  } else if (shape === 'behind') {
    main = commit('b.txt', 'b\n')
    git('update-ref', 'refs/heads/main', a)
  } else if (shape === 'diverged') {
    main = commit('b.txt', 'b\n')
    git('update-ref', 'refs/heads/main', a)
    commit('c.txt', 'c\n')
  }
  if (main) git('update-ref', 'refs/remotes/origin/main', main)
  return { env, work, head: git('rev-parse', 'HEAD'), main, git }
}
