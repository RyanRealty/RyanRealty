'use client'

/**
 * Two-layer Home type control (class + MLS sub type).
 *
 * Layer 1 — property class: Residential / Multi-family / Manufactured / Land /
 * Commercial (maps to MLS PropertyType codes via propertyTypeFilterToCodes).
 * Layer 2 — exact PropertySubType multi-select (Duplex, Manufactured On Land, …)
 * with human labels. Selecting a sub type auto-narrows the class when needed.
 *
 * Lives on the primary chip bar so buyers do not need All filters for duplex /
 * multifamily / manufactured — the engine already supports these via registry.
 */

import { useMemo } from 'react'
import {
  PROPERTY_TYPES,
  SUBTYPE_TO_CLASS,
  propertySubTypeDisplayLabel,
  type PropertySubTypeClass,
} from '@/lib/property-type'
import {
  PROPERTY_CLASS_LABELS,
  PROPERTY_CLASS_ORDER,
  autoNarrowPropertyType,
  propertyTypeDisplayLabel,
} from '@/lib/search/class-prevalence'
import { searchFieldByKey } from '@/lib/search/field-registry'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SUBTYPE_OPTIONS = searchFieldByKey('propertySubTypes')?.options ?? []

type Props = {
  propertyType: string | undefined
  /** Exact feed strings, already split (e.g. from ?propertySubTypes=Duplex,Triplex). */
  propertySubTypes: string[]
  /**
   * Apply one or both layers. Parent owns URL mutation (updateUrl / apply).
   * Pass undefined to clear a key.
   */
  onChange: (next: { propertyType?: string; propertySubTypes?: string[] }) => void
  /** Compact width for chip popovers. */
  className?: string
}

function groupsForClass(scope: readonly PropertySubTypeClass[] | null) {
  const byClass = new Map<PropertySubTypeClass, string[]>()
  for (const option of SUBTYPE_OPTIONS) {
    const cls = SUBTYPE_TO_CLASS[option]
    if (!cls) continue
    if (scope && !scope.includes(cls)) continue
    const rows = byClass.get(cls)
    if (rows) rows.push(option)
    else byClass.set(cls, [option])
  }
  return PROPERTY_CLASS_ORDER.filter((cls) => byClass.has(cls)).map((cls) => ({
    cls,
    label: PROPERTY_CLASS_LABELS[cls],
    options: byClass.get(cls)!,
  }))
}

/** Classes implied by current propertyType param (null = all A–D subtypes). */
function classScope(propertyType: string | undefined): readonly PropertySubTypeClass[] | null {
  const v = (propertyType ?? '').trim()
  if (!v) return null
  if (/^a$/i.test(v) || v.toLowerCase() === 'residential') return ['A']
  if (/^b$/i.test(v) || v.toLowerCase() === 'manufactured') return ['B']
  if (/^c$/i.test(v) || /multi/i.test(v) || v.toLowerCase() === 'income') return ['C']
  if (/^d$/i.test(v) || v.toLowerCase() === 'land') return ['D']
  // Commercial E–H: no A–D subtypes
  if (v.toLowerCase() === 'commercial') return []
  return null
}

export default function HomeTypeFilterPanel({
  propertyType,
  propertySubTypes,
  onChange,
  className,
}: Props) {
  const selected = useMemo(() => new Set(propertySubTypes), [propertySubTypes])
  const scope = classScope(propertyType)
  const groups = useMemo(() => groupsForClass(scope), [scope])

  const activeClassValue = (propertyType ?? '').trim()

  function setClass(value: string) {
    // Changing class clears subtypes that no longer belong.
    if (!value) {
      onChange({ propertyType: undefined, propertySubTypes: [] })
      return
    }
    const nextScope = classScope(value)
    const kept =
      nextScope === null
        ? propertySubTypes
        : nextScope.length === 0
          ? []
          : propertySubTypes.filter((s) => {
              const cls = SUBTYPE_TO_CLASS[s]
              return cls != null && nextScope.includes(cls)
            })
    onChange({ propertyType: value, propertySubTypes: kept })
  }

  function toggleSubType(option: string) {
    const next = selected.has(option)
      ? propertySubTypes.filter((s) => s !== option)
      : [...propertySubTypes, option]
    const narrowed = autoNarrowPropertyType(next)
    // null = no opinion (keep class); '' = widen to all; else set class
    const nextType =
      narrowed === null ? propertyType : narrowed === '' ? undefined : narrowed
    onChange({
      propertyType: nextType,
      propertySubTypes: next,
    })
  }

  return (
    <div className={cn('p-3', className)}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Property class
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PROPERTY_TYPES.map(({ value, label }) => {
          const isActive = (activeClassValue || '') === value
          return (
            <Button
              key={value || 'all'}
              type="button"
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              className="rounded-full px-3"
              onClick={() => setClass(value)}
            >
              {label}
            </Button>
          )
        })}
      </div>

      {groups.length > 0 ? (
        <>
          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Specific type
          </p>
          <p className="mb-2.5 text-[11px] leading-snug text-muted-foreground">
            MLS sub-types for Central Oregon inventory. Pick one or more, e.g. Duplex,
            Manufactured on land, Condo.
          </p>
          <div className="max-h-[min(50vh,22rem)] space-y-3 overflow-y-auto pr-0.5">
            {groups.map(({ cls, label, options }) => (
              <div key={cls}>
                <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{label}</p>
                <div className="flex flex-col gap-0.5">
                  {options.map((option) => {
                    const on = selected.has(option)
                    return (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={on ? 'default' : 'ghost'}
                        className="h-auto justify-start px-2.5 py-1.5 text-left text-sm font-normal"
                        onClick={() => toggleSubType(option)}
                        aria-pressed={on}
                      >
                        {propertySubTypeDisplayLabel(option)}
                      </Button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Commercial inventory does not use residential sub-types. Use All filters for
          commercial details.
        </p>
      )}

      {(activeClassValue || propertySubTypes.length > 0) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 w-full text-muted-foreground"
          onClick={() => onChange({ propertyType: undefined, propertySubTypes: [] })}
        >
          Clear home type
        </Button>
      )}
    </div>
  )
}

/** Chip label: prefer specific subtypes, else class name. */
export function homeTypeChipLabel(
  propertyType: string | undefined,
  propertySubTypes: string[],
): string | null {
  if (propertySubTypes.length === 1) {
    return propertySubTypeDisplayLabel(propertySubTypes[0])
  }
  if (propertySubTypes.length > 1) {
    return `${propertySubTypes.length} home types`
  }
  if (!propertyType?.trim()) return null
  // Prefer PROPERTY_TYPES label, then class-prevalence helper (codes / multi-family).
  const fromList = PROPERTY_TYPES.find((t) => t.value === propertyType)?.label
  if (fromList) return fromList
  return propertyTypeDisplayLabel(propertyType)
}
