/**
 * Homepage inventory Field. The Stage above carries the D11 H1, so this
 * section names itself through V3Field's ariaLabel and renders no heading of
 * its own. The count line is the leftover region row with the D19 sentence
 * (label arrives from app/page.tsx so ci:pulse-city-remainder can read it),
 * towns are ghost filters into the browse surface, and the map in the frame
 * plots exactly the homes the list shows.
 */
import { V3Button, V3Field, type V3FieldItem, type V3FieldMapSlot } from '@/components/site/v3'
import './home-homes-field.css'

export function HomeHomesField({
  fieldItems,
  towns,
  count,
  mapSlot,
  mapNote,
  emptyMessage,
}: {
  fieldItems: V3FieldItem[]
  towns: readonly { label: string; href: string }[]
  count?: {
    value: string
    label: string
    source: string
    updatedAt: string | null
  }
  mapSlot?: V3FieldMapSlot
  mapNote?: string
  emptyMessage: string
}) {
  const [firstTown, ...restTowns] = towns

  return (
    <div className="home-homes-field" id="homes">
      {/* The count renders once, through V3Field's own count line, so the
          figure and its trace stay welded (V3Field renders them together). */}
      <header className="home-homes-field__head">
        {firstTown ? (
          <nav aria-label="Towns" className="home-homes-field__towns">
            <V3Button href={firstTown.href} variant="ghost">
              {firstTown.label}
            </V3Button>
            {restTowns.map((town) => (
              <V3Button key={town.href} href={town.href} variant="ghost">
                {town.label}
              </V3Button>
            ))}
          </nav>
        ) : null}
      </header>

      <V3Field
        id="listed"
        ariaLabel="Homes for sale across Central Oregon"
        items={fieldItems}
        mapSlot={mapSlot}
        mapNote={mapNote}
        count={count ? { value: count.value, label: count.label, source: count.source, updatedAt: count.updatedAt } : undefined}
        emptyMessage={emptyMessage}
      />
    </div>
  )
}
