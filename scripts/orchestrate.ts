#!/usr/bin/env tsx
/**
 * Development Process Orchestrator
 *
 * Reads the task registry, determines what to work on next, validates
 * task completion, and generates progress reports.
 *
 * Usage:
 *   npx tsx scripts/orchestrate.ts status          — Show current state of all phases/tasks
 *   npx tsx scripts/orchestrate.ts next             — Show next task to work on with full spec
 *   npx tsx scripts/orchestrate.ts complete <id>    — Mark a task complete
 *   npx tsx scripts/orchestrate.ts add <json>       — Add a new backlog item
 *   npx tsx scripts/orchestrate.ts validate <id>    — Run acceptance criteria checks
 *   npx tsx scripts/orchestrate.ts report           — Generate progress report
 *   npx tsx scripts/orchestrate.ts blocked <id>     — Mark a task as blocked
 *   npx tsx scripts/orchestrate.ts start <id>       — Mark a task as in-progress
 *   npx tsx scripts/orchestrate.ts list-backlog     — Show all backlog items
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Task {
  id: string
  title: string
  status: 'complete' | 'open' | 'in-progress' | 'blocked'
  requirement?: string
  owner: string
  files: string[]
  acceptanceCriteria: string[]
  dependsOn: string[]
  priority?: 'high' | 'medium' | 'low'
  category?: string
  source?: string
  blockedReason?: string
}

interface Phase {
  id: string
  name: string
  status: 'complete' | 'in-progress' | 'open'
  goal: string
  tasks: Task[]
}

interface Registry {
  version: string
  lastUpdated: string
  phases: Phase[]
  backlog: Task[]
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(
  typeof import.meta.dirname === 'string' ? import.meta.dirname : path.dirname(new URL(import.meta.url).pathname),
  '..',
)
const REGISTRY_PATH = path.join(ROOT, 'docs', 'plans', 'task-registry.json')
const REPORT_PATH = path.join(ROOT, 'docs', 'plans', 'continuous-improvement.md')
const HANDOFF_TEMPLATE_PATH = path.join(ROOT, 'docs', 'plans', 'task-handoff-template.md')

// ---------------------------------------------------------------------------
// Registry I/O
// ---------------------------------------------------------------------------

function loadRegistry(): Registry {
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error(`Registry not found at ${REGISTRY_PATH}`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'))
}

function saveRegistry(registry: Registry): void {
  registry.lastUpdated = new Date().toISOString().slice(0, 10)
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf8')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAllTasks(registry: Registry): Task[] {
  const tasks: Task[] = []
  for (const phase of registry.phases) {
    for (const task of phase.tasks) {
      tasks.push(task)
    }
  }
  for (const task of registry.backlog) {
    tasks.push(task)
  }
  return tasks
}

function findTask(registry: Registry, id: string): { task: Task; location: string } | null {
  for (const phase of registry.phases) {
    for (const task of phase.tasks) {
      if (task.id === id) return { task, location: `${phase.id} (${phase.name})` }
    }
  }
  for (const task of registry.backlog) {
    if (task.id === id) return { task, location: 'backlog' }
  }
  return null
}

function isBlocked(task: Task, allTasks: Task[]): boolean {
  if (!task.dependsOn || task.dependsOn.length === 0) return false
  for (const depId of task.dependsOn) {
    const dep = allTasks.find(t => t.id === depId)
    if (dep && dep.status !== 'complete') return true
  }
  return false
}

function getNextTasks(registry: Registry): Task[] {
  const allTasks = getAllTasks(registry)
  const openTasks = allTasks.filter(t => t.status === 'open' && !isBlocked(t, allTasks))

  // Build a map of task ID → phase index for ordering
  const taskPhaseIndex = new Map<string, number>()
  for (let i = 0; i < registry.phases.length; i++) {
    for (const task of registry.phases[i].tasks) {
      taskPhaseIndex.set(task.id, i)
    }
  }
  // Backlog items get a phase index after all phases
  for (const task of registry.backlog) {
    taskPhaseIndex.set(task.id, registry.phases.length)
  }

  // Sort by: critical first, then phase/tier order, then priority within tier, then ID
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  openTasks.sort((a, b) => {
    // Critical priority always first
    const pa = priorityOrder[a.priority ?? 'medium'] ?? 2
    const pb = priorityOrder[b.priority ?? 'medium'] ?? 2
    if (pa !== pb) return pa - pb

    // Then by phase/tier order (tier-1 before tier-2 before backlog)
    const phaseA = taskPhaseIndex.get(a.id) ?? 999
    const phaseB = taskPhaseIndex.get(b.id) ?? 999
    if (phaseA !== phaseB) return phaseA - phaseB

    // Then by ID (numeric sort)
    return a.id.localeCompare(b.id, undefined, { numeric: true })
  })

  return openTasks
}

// ---------------------------------------------------------------------------
// Color helpers (ANSI)
// ---------------------------------------------------------------------------

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

function statusIcon(status: string): string {
  switch (status) {
    case 'complete': return `${c.green}✓${c.reset}`
    case 'in-progress': return `${c.yellow}●${c.reset}`
    case 'blocked': return `${c.red}✗${c.reset}`
    case 'open': return `${c.dim}○${c.reset}`
    default: return '?'
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'complete': return c.green
    case 'in-progress': return c.yellow
    case 'blocked': return c.red
    case 'open': return c.dim
    default: return c.reset
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdStatus(registry: Registry): void {
  const allTasks = getAllTasks(registry)
  const counts = {
    complete: allTasks.filter(t => t.status === 'complete').length,
    'in-progress': allTasks.filter(t => t.status === 'in-progress').length,
    open: allTasks.filter(t => t.status === 'open').length,
    blocked: allTasks.filter(t => t.status === 'blocked').length,
  }

  console.log(`\n${c.bold}Development Process Status${c.reset}`)
  console.log(`${'─'.repeat(60)}`)
  console.log(`Last updated: ${registry.lastUpdated}`)
  console.log(`Total tasks: ${allTasks.length}`)
  console.log(
    `  ${c.green}${counts.complete} complete${c.reset}  ` +
    `${c.yellow}${counts['in-progress']} in-progress${c.reset}  ` +
    `${counts.open} open  ` +
    `${c.red}${counts.blocked} blocked${c.reset}`
  )
  console.log()

  // Phase summary
  for (const phase of registry.phases) {
    const done = phase.tasks.filter(t => t.status === 'complete').length
    const total = phase.tasks.length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5))
    const icon = done === total ? `${c.green}✓${c.reset}` : `${c.yellow}…${c.reset}`
    console.log(`  ${icon} ${c.bold}${phase.id}${c.reset}: ${phase.name}`)
    console.log(`    ${bar} ${pct}% (${done}/${total})`)

    // Show non-complete tasks
    const incomplete = phase.tasks.filter(t => t.status !== 'complete')
    for (const task of incomplete) {
      console.log(`    ${statusIcon(task.status)} ${task.id}: ${task.title}`)
    }
  }

  // Backlog summary
  if (registry.backlog.length > 0) {
    const blDone = registry.backlog.filter(t => t.status === 'complete' || t.status === 'done' as string).length
    const blOpen = registry.backlog.filter(t => t.status === 'open').length
    console.log(`\n  ${c.cyan}Backlog${c.reset}: ${registry.backlog.length} items (${blOpen} open, ${blDone} done)`)
    for (const task of registry.backlog.filter(t => t.status !== 'complete')) {
      const pri = task.priority === 'high' ? `${c.red}HIGH${c.reset}` : task.priority === 'medium' ? `${c.yellow}MED${c.reset}` : `${c.dim}LOW${c.reset}`
      console.log(`    ${statusIcon(task.status)} [${pri}] ${task.id}: ${task.title}`)
    }
  }

  console.log()
}

function cmdNext(registry: Registry): void {
  const nextTasks = getNextTasks(registry)

  if (nextTasks.length === 0) {
    console.log(`\n${c.green}${c.bold}All tasks complete!${c.reset} No open, unblocked tasks remain.`)
    console.log(`Run ${c.cyan}npx tsx scripts/orchestrate.ts add${c.reset} to add new backlog items.\n`)
    return
  }

  const task = nextTasks[0]
  const found = findTask(registry, task.id)

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`${c.bold}NEXT TASK${c.reset}`)
  console.log(`${'═'.repeat(60)}`)
  console.log()
  console.log(`# Task: ${task.id} — ${task.title}`)
  console.log()
  console.log(`## Context`)
  if (found) {
    console.log(`Location: ${found.location}`)
  }
  console.log(`Owner: ${task.owner}`)
  if (task.requirement) console.log(`Requirement: ${task.requirement}`)
  if (task.priority) console.log(`Priority: ${task.priority}`)
  if (task.category) console.log(`Category: ${task.category}`)
  console.log()

  if (task.files.length > 0) {
    console.log(`## Files to Modify`)
    for (const f of task.files) {
      console.log(`- \`${f}\``)
    }
    console.log()
  }

  if (task.acceptanceCriteria.length > 0) {
    console.log(`## Acceptance Criteria`)
    for (const ac of task.acceptanceCriteria) {
      console.log(`- [ ] ${ac}`)
    }
    console.log()
  }

  console.log(`## Quality Gates`)
  console.log(`- [ ] \`npm run build\` passes`)
  console.log(`- [ ] No new lint errors on edited files`)
  if (task.files.some(f => f.includes('components/') || f.endsWith('.tsx'))) {
    console.log(`- [ ] \`npm run lint:design-tokens\` passes`)
  }
  if (task.files.some(f => f.includes('app/') && f.includes('page.'))) {
    console.log(`- [ ] \`npm run lint:seo-routes\` passes`)
  }
  console.log(`- [ ] \`npm run test\` passes`)
  console.log()

  if (task.dependsOn.length > 0) {
    console.log(`## Dependencies`)
    console.log(`Requires: ${task.dependsOn.join(', ')}`)
    console.log()
  }

  console.log(`## File Ownership`)
  console.log(`Owner: ${task.owner}`)
  console.log(`See docs/plans/master-plan.md for the full ownership matrix.`)
  console.log()

  console.log(`## Workflow`)
  console.log(`1. Start: \`npx tsx scripts/orchestrate.ts start ${task.id}\``)
  console.log(`2. Implement the changes described above`)
  console.log(`3. Run quality gates: \`npm run quality:full\``)
  console.log(`4. Validate: \`npx tsx scripts/orchestrate.ts validate ${task.id}\``)
  console.log(`5. Complete: \`npx tsx scripts/orchestrate.ts complete ${task.id}\``)
  console.log(`6. Commit and push with conventional commit format`)
  console.log()

  if (nextTasks.length > 1) {
    console.log(`${'─'.repeat(60)}`)
    console.log(`${c.dim}${nextTasks.length - 1} more tasks available after this one:${c.reset}`)
    for (const t of nextTasks.slice(1, 6)) {
      const pri = t.priority === 'high' ? `${c.red}HIGH${c.reset}` : t.priority === 'medium' ? `${c.yellow}MED${c.reset}` : `${c.dim}LOW${c.reset}`
      console.log(`  [${pri}] ${t.id}: ${t.title}`)
    }
    if (nextTasks.length > 6) {
      console.log(`  ... and ${nextTasks.length - 6} more`)
    }
    console.log()
  }
}

function cmdComplete(registry: Registry, taskId: string): void {
  const found = findTask(registry, taskId)
  if (!found) {
    console.error(`Task ${taskId} not found.`)
    process.exit(1)
  }

  if (found.task.status === 'complete') {
    console.log(`Task ${taskId} is already complete.`)
    return
  }

  found.task.status = 'complete'
  saveRegistry(registry)
  console.log(`${c.green}✓${c.reset} Task ${taskId} (${found.task.title}) marked as complete.`)

  // Check if phase is now complete
  for (const phase of registry.phases) {
    if (phase.tasks.some(t => t.id === taskId)) {
      const allDone = phase.tasks.every(t => t.status === 'complete')
      if (allDone && phase.status !== 'complete') {
        phase.status = 'complete'
        saveRegistry(registry)
        console.log(`${c.green}✓${c.reset} Phase ${phase.id} (${phase.name}) is now complete!`)
      }
      break
    }
  }
}

function cmdStart(registry: Registry, taskId: string): void {
  const found = findTask(registry, taskId)
  if (!found) {
    console.error(`Task ${taskId} not found.`)
    process.exit(1)
  }

  const allTasks = getAllTasks(registry)
  if (isBlocked(found.task, allTasks)) {
    const blockers = found.task.dependsOn.filter(depId => {
      const dep = allTasks.find(t => t.id === depId)
      return dep && dep.status !== 'complete'
    })
    console.error(`Task ${taskId} is blocked by: ${blockers.join(', ')}`)
    process.exit(1)
  }

  found.task.status = 'in-progress'

  // Update phase status if needed
  for (const phase of registry.phases) {
    if (phase.tasks.some(t => t.id === taskId) && phase.status === 'open') {
      phase.status = 'in-progress'
    }
  }

  saveRegistry(registry)
  console.log(`${c.yellow}●${c.reset} Task ${taskId} (${found.task.title}) is now in-progress.`)
}

function cmdBlocked(registry: Registry, taskId: string, reason?: string): void {
  const found = findTask(registry, taskId)
  if (!found) {
    console.error(`Task ${taskId} not found.`)
    process.exit(1)
  }

  found.task.status = 'blocked'
  if (reason) found.task.blockedReason = reason
  saveRegistry(registry)
  console.log(`${c.red}✗${c.reset} Task ${taskId} (${found.task.title}) marked as blocked.${reason ? ` Reason: ${reason}` : ''}`)
}

function cmdAdd(registry: Registry, jsonStr: string): void {
  let newTask: Partial<Task>
  try {
    newTask = JSON.parse(jsonStr)
  } catch {
    console.error('Invalid JSON. Usage: npx tsx scripts/orchestrate.ts add \'{"title":"...","priority":"medium","category":"bug"}\'')
    process.exit(1)
  }

  // Auto-generate ID
  const maxId = registry.backlog
    .map(t => {
      const match = t.id.match(/^BL-(\d+)$/)
      return match ? parseInt(match[1], 10) : 0
    })
    .reduce((max, n) => Math.max(max, n), 0)

  const task: Task = {
    id: `BL-${String(maxId + 1).padStart(3, '0')}`,
    title: newTask.title ?? 'Untitled task',
    status: 'open',
    priority: newTask.priority ?? 'medium',
    category: newTask.category ?? 'improvement',
    source: newTask.source ?? 'user-report',
    owner: newTask.owner ?? 'shared',
    files: newTask.files ?? [],
    acceptanceCriteria: newTask.acceptanceCriteria ?? [],
    dependsOn: newTask.dependsOn ?? [],
  }

  registry.backlog.push(task)
  saveRegistry(registry)
  console.log(`${c.green}+${c.reset} Added backlog item ${task.id}: ${task.title}`)
}

function cmdValidate(registry: Registry, taskId: string): void {
  const found = findTask(registry, taskId)
  if (!found) {
    console.error(`Task ${taskId} not found.`)
    process.exit(1)
  }

  const task = found.task
  console.log(`\n${c.bold}Validating task ${task.id}: ${task.title}${c.reset}\n`)

  const checks: { name: string; pass: boolean; detail?: string }[] = []

  // Check if files exist (for tasks with file lists)
  for (const f of task.files) {
    if (f.includes('*')) continue // Skip glob patterns
    const fullPath = path.join(ROOT, f)
    const exists = fs.existsSync(fullPath)
    checks.push({ name: `File exists: ${f}`, pass: exists, detail: exists ? 'found' : 'missing' })
  }

  // Run build check
  console.log(`${c.dim}Running npm run build...${c.reset}`)
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'pipe', timeout: 300000 })
    checks.push({ name: 'npm run build', pass: true })
  } catch (e) {
    const err = e as { stderr?: Buffer }
    checks.push({ name: 'npm run build', pass: false, detail: err.stderr?.toString().slice(-200) ?? 'failed' })
  }

  // Run tests
  console.log(`${c.dim}Running npm run test...${c.reset}`)
  try {
    execSync('npm run test', { cwd: ROOT, stdio: 'pipe', timeout: 60000 })
    checks.push({ name: 'npm run test', pass: true })
  } catch {
    checks.push({ name: 'npm run test', pass: false })
  }

  // Check design tokens if UI files
  if (task.files.some(f => f.includes('components/') || f.endsWith('.tsx'))) {
    console.log(`${c.dim}Running design token lint...${c.reset}`)
    try {
      execSync('npm run lint:design-tokens', { cwd: ROOT, stdio: 'pipe', timeout: 30000 })
      checks.push({ name: 'lint:design-tokens', pass: true })
    } catch {
      checks.push({ name: 'lint:design-tokens', pass: false })
    }
  }

  // Check SEO routes if page files
  if (task.files.some(f => f.includes('page.'))) {
    console.log(`${c.dim}Running SEO route lint...${c.reset}`)
    try {
      execSync('npm run lint:seo-routes', { cwd: ROOT, stdio: 'pipe', timeout: 30000 })
      checks.push({ name: 'lint:seo-routes', pass: true })
    } catch {
      checks.push({ name: 'lint:seo-routes', pass: false })
    }
  }

  // Print results
  console.log(`\n${c.bold}Validation Results${c.reset}`)
  console.log(`${'─'.repeat(50)}`)
  let allPass = true
  for (const check of checks) {
    const icon = check.pass ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`
    console.log(`  ${icon} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`)
    if (!check.pass) allPass = false
  }

  console.log()
  if (allPass) {
    console.log(`${c.green}${c.bold}All checks passed!${c.reset} Task ${task.id} is ready to be marked complete.`)
    console.log(`Run: ${c.cyan}npx tsx scripts/orchestrate.ts complete ${task.id}${c.reset}`)
  } else {
    console.log(`${c.red}${c.bold}Some checks failed.${c.reset} Fix the issues above and re-run validation.`)
  }
  console.log()
}

function cmdListBacklog(registry: Registry): void {
  console.log(`\n${c.bold}Backlog Items${c.reset} (${registry.backlog.length} total)`)
  console.log(`${'─'.repeat(60)}`)

  const byPriority = { high: [] as Task[], medium: [] as Task[], low: [] as Task[] }
  for (const task of registry.backlog) {
    const p = task.priority ?? 'medium'
    if (p in byPriority) byPriority[p as keyof typeof byPriority].push(task)
  }

  for (const [priority, tasks] of Object.entries(byPriority)) {
    if (tasks.length === 0) continue
    const label = priority === 'high' ? `${c.red}HIGH PRIORITY${c.reset}` : priority === 'medium' ? `${c.yellow}MEDIUM PRIORITY${c.reset}` : `${c.dim}LOW PRIORITY${c.reset}`
    console.log(`\n  ${label}`)
    for (const task of tasks) {
      const cat = task.category ? ` [${task.category}]` : ''
      console.log(`    ${statusIcon(task.status)} ${task.id}: ${task.title}${cat}`)
      if (task.status === 'blocked' && task.blockedReason) {
        console.log(`      ${c.red}Blocked: ${task.blockedReason}${c.reset}`)
      }
    }
  }
  console.log()
}

function cmdReport(registry: Registry): void {
  const allTasks = getAllTasks(registry)
  const complete = allTasks.filter(t => t.status === 'complete').length
  const total = allTasks.length
  const pct = Math.round((complete / total) * 100)

  const openTasks = getNextTasks(registry)
  const inProgress = allTasks.filter(t => t.status === 'in-progress')
  const blocked = allTasks.filter(t => t.status === 'blocked')

  // Count by owner
  const byOwner: Record<string, { complete: number; open: number; total: number }> = {}
  for (const task of allTasks) {
    const owner = task.owner ?? 'shared'
    if (!byOwner[owner]) byOwner[owner] = { complete: 0, open: 0, total: 0 }
    byOwner[owner].total++
    if (task.status === 'complete') byOwner[owner].complete++
    if (task.status === 'open' || task.status === 'in-progress') byOwner[owner].open++
  }

  // Count by category
  const byCategory: Record<string, number> = {}
  for (const task of registry.backlog.filter(t => t.status === 'open')) {
    const cat = task.category ?? 'uncategorized'
    byCategory[cat] = (byCategory[cat] ?? 0) + 1
  }

  // Generate report
  const now = new Date().toISOString().slice(0, 10)
  const report = `# Continuous Improvement Report

**Generated**: ${now}
**Registry version**: ${registry.version}

---

## Overall Progress

| Metric | Value |
|--------|-------|
| Total tasks | ${total} |
| Complete | ${complete} (${pct}%) |
| In progress | ${inProgress.length} |
| Open (ready) | ${openTasks.length} |
| Blocked | ${blocked.length} |

## Phase Progress

${registry.phases.map(phase => {
  const done = phase.tasks.filter(t => t.status === 'complete').length
  const phaseTotal = phase.tasks.length
  const phasePct = phaseTotal > 0 ? Math.round((done / phaseTotal) * 100) : 0
  return `| ${phase.id} | ${phase.name} | ${phasePct}% (${done}/${phaseTotal}) | ${phase.status} |`
}).join('\n')}

## Work by Owner

${Object.entries(byOwner).map(([owner, counts]) => {
  return `| ${owner} | ${counts.complete}/${counts.total} complete | ${counts.open} open |`
}).join('\n')}

## Current Priorities

${openTasks.length === 0 ? '_No open tasks remaining._' : openTasks.slice(0, 10).map((t, i) => {
  return `${i + 1}. **${t.id}**: ${t.title} (${t.priority ?? 'medium'} priority, owner: ${t.owner})`
}).join('\n')}

${blocked.length > 0 ? `## Blocked Tasks\n\n${blocked.map(t => {
  return `- **${t.id}**: ${t.title}${t.blockedReason ? ` — ${t.blockedReason}` : ''}`
}).join('\n')}` : ''}

## Open Backlog by Category

${Object.entries(byCategory).length === 0 ? '_No open backlog items._' : Object.entries(byCategory).map(([cat, count]) => {
  return `| ${cat} | ${count} items |`
}).join('\n')}

---

## Recommended Next Actions

${openTasks.length === 0
  ? '1. All tasks complete. Consider adding new backlog items based on user feedback or audit findings.'
  : openTasks.slice(0, 3).map((t, i) => {
    return `${i + 1}. **${t.id} — ${t.title}**: ${t.acceptanceCriteria[0] ?? 'See task details'}`
  }).join('\n')}

---

*This report was auto-generated by \`scripts/orchestrate.ts report\`. Run \`npm run orchestrate:status\` for a live terminal view.*
`

  // Write report
  fs.writeFileSync(REPORT_PATH, report, 'utf8')
  console.log(`${c.green}✓${c.reset} Report written to ${path.relative(ROOT, REPORT_PATH)}`)

  // Also print to stdout
  console.log()
  console.log(report)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2)
  const command = args[0] ?? 'status'
  const registry = loadRegistry()

  switch (command) {
    case 'status':
      cmdStatus(registry)
      break

    case 'next':
      cmdNext(registry)
      break

    case 'complete':
      if (!args[1]) {
        console.error('Usage: npx tsx scripts/orchestrate.ts complete <taskId>')
        process.exit(1)
      }
      cmdComplete(registry, args[1])
      break

    case 'start':
      if (!args[1]) {
        console.error('Usage: npx tsx scripts/orchestrate.ts start <taskId>')
        process.exit(1)
      }
      cmdStart(registry, args[1])
      break

    case 'blocked':
      if (!args[1]) {
        console.error('Usage: npx tsx scripts/orchestrate.ts blocked <taskId> [reason]')
        process.exit(1)
      }
      cmdBlocked(registry, args[1], args.slice(2).join(' ') || undefined)
      break

    case 'add':
      if (!args[1]) {
        console.error('Usage: npx tsx scripts/orchestrate.ts add \'{"title":"...","priority":"medium","category":"bug"}\'')
        process.exit(1)
      }
      cmdAdd(registry, args.slice(1).join(' '))
      break

    case 'validate':
      if (!args[1]) {
        console.error('Usage: npx tsx scripts/orchestrate.ts validate <taskId>')
        process.exit(1)
      }
      cmdValidate(registry, args[1])
      break

    case 'report':
      cmdReport(registry)
      break

    case 'list-backlog':
      cmdListBacklog(registry)
      break

    case 'help':
    default:
      console.log(`
${c.bold}Development Process Orchestrator${c.reset}

Commands:
  ${c.cyan}status${c.reset}          Show current state of all phases and tasks
  ${c.cyan}next${c.reset}            Show the next task to work on with full spec
  ${c.cyan}start <id>${c.reset}      Mark a task as in-progress
  ${c.cyan}complete <id>${c.reset}   Mark a task complete
  ${c.cyan}blocked <id>${c.reset}    Mark a task as blocked (optional reason after id)
  ${c.cyan}add <json>${c.reset}      Add a new backlog item
  ${c.cyan}validate <id>${c.reset}   Run acceptance criteria checks for a task
  ${c.cyan}report${c.reset}          Generate progress report to docs/plans/continuous-improvement.md
  ${c.cyan}list-backlog${c.reset}    Show all backlog items grouped by priority
  ${c.cyan}help${c.reset}            Show this help message
`)
      break
  }
}

main()
