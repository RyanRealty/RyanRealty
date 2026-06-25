/**
 * CustomFieldsPanel — the FUB person-record custom-field section on the CRM
 * record card. Given the contact's `crm_people.custom` jsonb bag and the typed
 * field registry (getCrmFieldDefinitions), it renders the values grouped by
 * field_group, in position order, formatted by type.
 *
 * Read-only for v1: editing custom-field values from the card is a deferred
 * enhancement (it needs a per-type editor + a write action that revalidates
 * the contact). This panel only displays.
 *
 * Server component — all grouping/formatting is done by the pure groupAndFormat
 * helper, so this file is a thin presentational layer (design-system only).
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CrmFieldDefinition } from '@/lib/data/crm/getCrmFieldDefinitions'
import { groupAndFormat } from '@/lib/crm/custom-field-display'
import { cn } from '@/lib/utils'

export type CustomFieldsPanelProps = {
  custom: Record<string, unknown> | null | undefined
  defs: CrmFieldDefinition[]
  className?: string
}

export default function CustomFieldsPanel({ custom, defs, className }: CustomFieldsPanelProps) {
  const groups = groupAndFormat(custom, defs)
  if (groups.length === 0) return null

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Custom fields</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {groups.map((g) => (
          <div key={g.group ?? '__ungrouped__'} className="space-y-2">
            {g.group ? (
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.group}
              </div>
            ) : null}
            <dl className="space-y-1.5">
              {g.rows.map((row) => (
                <div key={row.key} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                  <dd
                    className={cn(
                      'truncate text-right text-foreground',
                      row.tabular && 'tabular-nums',
                    )}
                  >
                    {row.display}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
