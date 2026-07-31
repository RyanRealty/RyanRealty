/**
 * class-conditioning — pure state logic for the All-filters sheet's
 * class-aware rendering (plan §5 + §7.1 rule 2: suspend, never drop).
 *
 * Given the census artifact, the selected property-class scope, and the
 * user's current selections, computes how each value renders:
 *
 *   - live values sort by prominence then count (plan §5 ordering)
 *   - zero-for-class values stay visible but disabled, with the reason
 *   - 'hidden' values disappear UNLESS selected — a chosen value that
 *     becomes invalid is retained, struck through, and flagged for a
 *     one-tap resolution; the URL keeps it until the user resolves it
 *
 * Pure module — no React. The sheet owns rendering and resolutions.
 */

import { type SearchFieldDef } from '@/lib/search/field-registry'
import {
  assessValue,
  type ClassPrevalenceArtifact,
  type ClassPrevalenceState,
  type PropertyClass,
} from '@/lib/search/class-prevalence'

export interface ConditionedValue {
  value: string
  /** Live count under the class scope; null when the census has no entry. */
  count: number | null
  state: ClassPrevalenceState
  prominent: boolean
  selected: boolean
  /** Selected AND zero under the current class scope — struck, needs a resolution. */
  suspended: boolean
}

export interface ConditionedOptions {
  options: ConditionedValue[]
  /** The suspended subset, for the resolution row. */
  suspended: ConditionedValue[]
}

/**
 * Condition a multi field's option list on the class scope. Selected values
 * are always present (suspend, never drop) — a selected value missing from
 * the registry options (an old URL, a vocabulary shift) is appended so the
 * user can still see and remove it.
 */
export function conditionMultiOptions(
  def: Pick<SearchFieldDef, 'key' | 'options'>,
  artifact: ClassPrevalenceArtifact | null,
  classes: readonly PropertyClass[] | null,
  selectedValues: readonly string[],
): ConditionedOptions {
  const selected = new Set(selectedValues)
  const baseOptions = def.options ?? []
  const known = new Set(baseOptions)
  const allValues = [...baseOptions, ...selectedValues.filter((v) => !known.has(v))]

  const conditioned: ConditionedValue[] = allValues.map((value) => {
    const assessment = artifact ? assessValue(artifact, def.key, value, classes) : null
    if (!assessment) {
      return {
        value,
        count: null,
        state: 'shown',
        prominent: false,
        selected: selected.has(value),
        suspended: false,
      }
    }
    const isSelected = selected.has(value)
    return {
      value,
      count: assessment.count,
      state: assessment.state,
      prominent: assessment.prominent,
      selected: isSelected,
      suspended: isSelected && assessment.count === 0,
    }
  })

  // Hidden values vanish unless selected (then they render as suspended).
  const visible = conditioned.filter((v) => v.state !== 'hidden' || v.selected)

  // Ordering (plan §5): prominent by count desc, then remaining live values
  // by count desc, then zero-disabled; ties alphabetical for stability.
  // Uncounted values (artifact not loaded) keep registry order via rank 1.
  const rank = (v: ConditionedValue) =>
    v.count === null ? 1 : v.prominent ? 0 : v.count > 0 ? 1 : 2
  const sorted =
    artifact === null
      ? visible
      : [...visible].sort(
          (a, b) =>
            rank(a) - rank(b) ||
            (b.count ?? 0) - (a.count ?? 0) ||
            a.value.localeCompare(b.value),
        )

  return { options: sorted, suspended: sorted.filter((v) => v.suspended) }
}

/** Condition a boolean field (its census value is 'true'). */
export function conditionBoolean(
  fieldKey: string,
  artifact: ClassPrevalenceArtifact | null,
  classes: readonly PropertyClass[] | null,
  checked: boolean,
): ConditionedValue {
  const assessment = artifact ? assessValue(artifact, fieldKey, 'true', classes) : null
  if (!assessment) {
    return { value: 'true', count: null, state: 'shown', prominent: false, selected: checked, suspended: false }
  }
  return {
    value: 'true',
    count: assessment.count,
    state: assessment.state,
    prominent: assessment.prominent,
    selected: checked,
    suspended: checked && assessment.count === 0,
  }
}

/** The muted reason line for a disabled or suspended value. */
export function zeroReasonLabel(classLabel: string | null): string {
  return classLabel ? `0 ${classLabel.toLowerCase()} listings` : '0 matching listings'
}
