/**
 * automation-links — pure helpers for the §12.2.3 "Linked Automations" column
 * (docs/fub-crm-spec/12-action-plans-and-automations.md).
 *
 * FUB's Automations list shows a "Using: N ▾" pill per row where N = the count
 * of OTHER automations that reference this one via a Run Automation step. Our
 * engine's equivalent is the `run_automation` step channel whose `value` holds
 * the target sequence id (see lib/crm/sequence-step-schema.ts).
 *
 * Pure module — no I/O. Walks a steps jsonb array INCLUDING condition-node
 * branches (truePath / falsePath, recursively) so a Run Automation buried in an
 * IF/ELSE branch still counts.
 */

type LooseStep = {
  channel?: unknown
  value?: unknown
  type?: unknown
  truePath?: unknown
  falsePath?: unknown
}

/**
 * Collect every sequence id referenced by a `run_automation` step anywhere in
 * the steps tree (top level + condition branches). Non-numeric / non-positive
 * values are ignored. Deduplicated, stable order of first appearance.
 */
export function collectLinkedAutomationIds(steps: unknown): number[] {
  const out: number[] = []
  const seen = new Set<number>()
  const walk = (nodes: unknown): void => {
    if (!Array.isArray(nodes)) return
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue
      const s = node as LooseStep
      if (s.type === 'condition') {
        walk(s.truePath)
        walk(s.falsePath)
        continue
      }
      if (s.channel === 'run_automation' && typeof s.value === 'string') {
        const id = Number(s.value.trim())
        if (Number.isInteger(id) && id > 0 && !seen.has(id)) {
          seen.add(id)
          out.push(id)
        }
      }
    }
  }
  walk(steps)
  return out
}

/**
 * Invert the per-sequence outgoing links into the "Using: N" map the list
 * column renders: for each sequence id, WHICH other sequences reference it.
 * (FUB semantics per shot-34: the pill on row X lists the automations that
 * use X — incoming references, not outgoing.)
 */
export function buildUsedByMap(
  sequences: Array<{ id: number; steps: unknown }>,
): Map<number, number[]> {
  const usedBy = new Map<number, number[]>()
  for (const seq of sequences) {
    for (const target of collectLinkedAutomationIds(seq.steps)) {
      if (target === seq.id) continue // self-reference is not a link
      const list = usedBy.get(target) ?? []
      if (!list.includes(seq.id)) list.push(seq.id)
      usedBy.set(target, list)
    }
  }
  return usedBy
}
