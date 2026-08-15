/**
 * Homepage inventory Field. Houses open the page. The D11 H1 is Amboqia at
 * field size so photographs fill the fold. Towns are filters into the browse
 * Field, not a number poster. The region count is a caption, never a V3Figure
 * hero. The first photographed house is the fold.
 */
import { V3Button, V3Field, V3Heading, V3SourceLine, type V3FieldItem } from '@/components/site/v3'
import './home-homes-field.css'

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
    <div className="home-homes-field">
      <header className="home-homes-field__head">
        <V3Heading level={1} size="field">
          {heading}
        </V3Heading>
        {count ? (
          <p className="home-homes-field__count">
            <span className="home-homes-field__count-value tabular-nums text-foreground">
              {count.value}
            </span>
            {` ${count.label}`}
          </p>
        ) : null}
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
        ariaLabel="Homes for sale in Central Oregon"
        items={fieldItems}
        emptyMessage="No photographed active single-family home with a list price and a street address returned on this refresh."
      />
      {count ? <V3SourceLine source={count.source} updatedAt={count.updatedAt} /> : null}
    </div>
  )
}
