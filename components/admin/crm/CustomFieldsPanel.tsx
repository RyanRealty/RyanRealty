/**
 * CustomFieldsPanel — the FUB person-record custom-field section on the CRM
 * record card. Given the contact's `crm_people.custom` jsonb bag and the typed
 * field registry (getCrmFieldDefinitions), it renders the values grouped by
 * field_group, in position order, formatted by type.
 *
 * v2: writable rows. Fields whose definition is NOT readOnly / isProtected render
 * a `<CustomFieldEditor>` client island alongside the display value. The island
 * handles the Edit → save → optimistic update cycle without a full page reload.
 * readOnly + isProtected fields remain display-only (<dd> only, no editor).
 *
 * Server component — grouping/formatting via groupAndFormat (pure). The client
 * editor island (CustomFieldEditor.tsx) owns the mutation layer. Design-system
 * only — all output is Card/CardContent/CardHeader primitives.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CrmFieldDefinition } from '@/lib/data/crm/getCrmFieldDefinitions'
import { groupAndFormat } from '@/lib/crm/custom-field-display'
import { cn } from '@/lib/utils'
import { CustomFieldEditor, type EditableFieldDef } from '@/components/admin/crm/CustomFieldEditor'

export type CustomFieldsPanelProps = {
  /** The contact's crm_people.id — required for the write action. */
  personId: number
  custom: Record<string, unknown> | null | undefined
  defs: CrmFieldDefinition[]
  className?: string
}

export default function CustomFieldsPanel({ personId, custom, defs, className }: CustomFieldsPanelProps) {
  const groups = groupAndFormat(custom, defs)
  if (groups.length === 0) return null

  // Build a quick lookup from key → full definition (for editable checks + editor).
  const defMap = new Map(defs.map((d) => [d.key, d]))

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
            <dl className="space-y-2">
              {g.rows.map((row) => {
                const def = defMap.get(row.key)
                const isEditable = def && !def.readOnly && !def.isProtected

                const editorDef: EditableFieldDef | null = isEditable
                  ? {
                      key: def.key,
                      label: def.label,
                      type: def.type,
                      options: def.options,
                    }
                  : null

                return (
                  <div key={row.key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                      {editorDef ? (
                        <CustomFieldEditor
                          personId={personId}
                          def={editorDef}
                          currentRaw={(custom ?? {})[row.key]}
                          displayValue={row.display}
                        />
                      ) : (
                        <dd
                          className={cn(
                            'truncate text-right text-foreground',
                            row.tabular && 'tabular-nums',
                          )}
                        >
                          {row.display}
                        </dd>
                      )}
                    </div>
                  </div>
                )
              })}
            </dl>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
