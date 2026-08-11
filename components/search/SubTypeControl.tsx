'use client'

/**
 * SubTypeControl — the enumerated property sub-type multi-select
 * (plan §4.5, 2026-07-30).
 *
 * All 21 sub types render pre-loaded, grouped under their class headings
 * (Residential / Manufactured / Multi-family / Land), each with its live
 * prevalence count from the class census. Zero-count values stay visible but
 * disabled with the reason (§4.5.4 — hiding them makes the surface feel
 * arbitrary). A selected value at zero under the current class scope renders
 * suspended (struck through, still tappable to remove) — suspend, never drop
 * (§7.1 rule 2). The parent owns selection state and the auto-narrow of the
 * property class on toggle.
 */

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { SUBTYPE_TO_CLASS, propertySubTypeDisplayLabel } from '@/lib/property-type'
import {
  PROPERTY_CLASS_LABELS,
  PROPERTY_CLASS_ORDER,
  assessValue,
  type ClassPrevalenceArtifact,
  type PropertyClass,
} from '@/lib/search/class-prevalence'
import { type SearchFieldDef } from '@/lib/search/field-registry'
import { Button } from '@/components/ui/button'

type SubTypeRow = {
  value: string
  count: number | null
  selected: boolean
  /** Zero under the current class scope and not selected — disabled. */
  disabled: boolean
  /** Selected but zero under the current class scope — struck, tappable to remove. */
  suspended: boolean
}

export default function SubTypeControl({
  def,
  artifact,
  classes,
  values,
  disabled,
  onToggle,
}: {
  def: SearchFieldDef
  artifact: ClassPrevalenceArtifact | null
  classes: readonly PropertyClass[] | null
  values: string[]
  disabled: boolean
  onToggle: (option: string) => void
}) {
  const groups = useMemo(() => {
    const byClass = new Map<PropertyClass, SubTypeRow[]>()
    for (const option of def.options ?? []) {
      const cls = SUBTYPE_TO_CLASS[option]
      if (!cls) continue
      const assessment = artifact ? assessValue(artifact, def.key, option, classes) : null
      const selected = values.includes(option)
      const count = assessment ? assessment.count : null
      const row: SubTypeRow = {
        value: option,
        count,
        selected,
        disabled: count === 0 && !selected,
        suspended: selected && count === 0,
      }
      const rows = byClass.get(cls)
      if (rows) rows.push(row)
      else byClass.set(cls, [row])
    }
    // Count-descending inside each group, ties alphabetical (plan §5 ordering).
    for (const rows of byClass.values()) {
      rows.sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.value.localeCompare(b.value))
    }
    return PROPERTY_CLASS_ORDER.filter((cls) => byClass.has(cls)).map((cls) => ({
      cls,
      label: PROPERTY_CLASS_LABELS[cls],
      rows: byClass.get(cls) as SubTypeRow[],
    }))
  }, [def, artifact, classes, values])

  const scopeLabel =
    classes && classes.length === 1 ? PROPERTY_CLASS_LABELS[classes[0]] : null
  const hasZero = groups.some((g) => g.rows.some((r) => r.count === 0))

  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">{def.label}</p>
      <div className="flex flex-col gap-2.5">
        {groups.map(({ cls, label, rows }) => (
          <div key={cls}>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rows.map((row) => (
                <Button
                  key={row.value}
                  type="button"
                  size="sm"
                  variant={row.selected ? 'default' : 'outline'}
                  aria-pressed={row.selected}
                  disabled={disabled || row.disabled}
                  aria-label={
                    row.count === 0
                      ? `${propertySubTypeDisplayLabel(row.value)}, 0 ${scopeLabel ? `${scopeLabel.toLowerCase()} ` : ''}listings`
                      : `${propertySubTypeDisplayLabel(row.value)}, ${row.count ?? 'unknown'} listings`
                  }
                  onClick={() => onToggle(row.value)}
                  className={cn(
                    'h-auto rounded-full px-2.5 py-1 text-xs tabular-nums',
                    row.suspended && 'line-through decoration-2 opacity-80',
                  )}
                >
                  {propertySubTypeDisplayLabel(row.value)}
                  {row.count !== null && (
                    <span className={cn('ml-1', row.selected ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                      {row.count.toLocaleString()}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {hasZero && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {scopeLabel
            ? `Values at 0 have no ${scopeLabel.toLowerCase()} listings right now.`
            : 'Values at 0 have no listings right now.'}
        </p>
      )}
    </div>
  )
}
