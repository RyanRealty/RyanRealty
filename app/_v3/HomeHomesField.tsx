/**
 * Homepage inventory Field. Houses open the page. The D11 H1 is compact so
 * photographs fill the fold. Towns are filters into the browse Field, not a
 * number poster. The region count is a caption, never a V3Figure hero.
 */
import { V3Button, V3Field, V3SourceLine, type V3FieldItem } from '@/components/site/v3'

export function HomeHomesField({
  heading,
  fieldItems,
  towns,
  count,
}: {
  heading: string
  fieldItems: V3FieldItem[]
  towns: readonly { label: string; href: string }[]
  count?: {
    value: string
    label: string
    source: string
    updatedAt: string | null
  }
}) {
  const [firstTown, ...restTowns] = towns

  return (
    <>
      <header className="px-4 pt-4 sm:px-6">
        <h1 className="font-display text-sm font-medium leading-5 text-foreground">
          {heading}
        </h1>
        {count ? (
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="tabular-nums text-foreground">{count.value}</span>
            {` ${count.label}`}
          </p>
        ) : null}
        {firstTown ? (
          <nav aria-label="Towns" className="mt-3 flex flex-wrap gap-2">
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
        ariaLabel="Homes for sale in Central Oregon"
        items={fieldItems}
        emptyMessage="No photographed active single-family home with a list price and a street address returned on this refresh."
      />
      {count ? <V3SourceLine source={count.source} updatedAt={count.updatedAt} /> : null}
    </>
  )
}
