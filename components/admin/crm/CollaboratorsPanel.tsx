/**
 * CollaboratorsPanel — shows the list of broker collaborators on a contact and
 * lets the acting broker add or remove collaborators via server-action forms.
 *
 * Mirrors the FUB Collaborators right-rail section (spec §7c.8.9 / §7c.7).
 * The assigned_broker is excluded from the "Add" list (they already own the
 * record). Brokers already added are shown with a Remove button.
 *
 * This is a pure server component; state is held in the URL (redirect-on-submit).
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ContactCollaborator } from '@/lib/data/crm/getContactCollaborators'
import { CRM_BROKER_DISPLAY, CRM_BROKERS, type CrmBrokerSlug } from '@/lib/crm/constants'

type Props = {
  collaborators: ContactCollaborator[]
  assignedBroker: string | null
  addAction: (formData: FormData) => Promise<void>
  removeAction: (formData: FormData) => Promise<void>
}

export function CollaboratorsPanel({ collaborators, assignedBroker, addAction, removeAction }: Props) {
  const collaboratorSlugs = new Set(collaborators.map((c) => c.brokerSlug))

  // Brokers available to add: all CRM brokers EXCEPT the assigned one and anyone
  // already added.
  const available = CRM_BROKERS.filter(
    (slug) => slug !== assignedBroker && !collaboratorSlugs.has(slug),
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Collaborators{' '}
          {collaborators.length > 0 ? (
            <span className="font-normal text-muted-foreground">({collaborators.length})</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current collaborators */}
        {collaborators.length === 0 ? (
          <p className="text-sm text-muted-foreground">No collaborators added.</p>
        ) : (
          <div className="space-y-1.5">
            {collaborators.map((c) => (
              <div
                key={c.brokerSlug}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {c.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-foreground">{c.displayName}</span>
                  <Badge variant="outline" className="text-xs">Collaborator</Badge>
                </div>
                <form action={removeAction}>
                  <Input type="hidden" name="brokerSlug" value={c.brokerSlug} />
                  <Button
                    type="submit"
                    size="sm"
                    variant="ghost"
                    className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${c.displayName} as collaborator`}
                  >
                    Remove
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}

        {/* Add available brokers */}
        {available.length > 0 ? (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Add collaborator
            </div>
            {available.map((slug) => (
              <form key={slug} action={addAction} className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2">
                <Input type="hidden" name="brokerSlug" value={slug} />
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {(CRM_BROKER_DISPLAY[slug as CrmBrokerSlug] ?? slug)
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {CRM_BROKER_DISPLAY[slug as CrmBrokerSlug] ?? slug}
                  </span>
                </div>
                <Button type="submit" size="sm" variant="outline" className="min-h-10 sm:min-h-0">
                  Add
                </Button>
              </form>
            ))}
          </div>
        ) : null}

        {available.length === 0 && collaborators.length > 0 ? (
          <p className="text-xs text-muted-foreground">All brokers are already collaborating on this contact.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
