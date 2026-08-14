/**
 * Homepage inventory Field. Houses open the page. The D11 H1 is compact so
 * photographs fill the fold. Towns are filters into the browse Field, not a
 * number poster. The region count is a caption on the Field, same shape as
 * CityHomesField.
 */
import Link from 'next/link'
import { V3Button, V3Field, type V3FieldItem } from '@/components/site/v3'

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
  const [firstFieldItem, ...restFieldItems] = fieldItems
  const [firstTown, ...restTowns] = towns

  return (
    <>
      <header className="px-4 pt-4 sm:px-6">
        <h1 className="font-display text-sm font-medium leading-5 text-foreground">
          {heading}
        </h1>
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

      {firstFieldItem ? <HomeFieldPhoto item={firstFieldItem} priority /> : null}

      <V3Field
        id="listed"
        ariaLabel="Homes for sale in Central Oregon"
        items={restFieldItems.length > 0 ? restFieldItems : fieldItems}
        count={count}
        footNote={
          firstFieldItem
            ? `Listed here: ${fieldItems.length} photographed homes from the live list. Each photograph opens the listing.`
            : undefined
        }
        emptyMessage="No photographed active single-family home with a list price and a street address returned on this refresh."
      />
    </>
  )
}

function HomeFieldPhoto({
  item,
  priority = false,
}: {
  item: V3FieldItem
  priority?: boolean
}) {
  if (!item.photoSrc) return null

  return (
    <Link
      href={item.href}
      className="mx-auto block min-w-0 max-w-5xl px-4 text-foreground no-underline sm:px-6"
    >
      <img
        src={item.photoSrc}
        alt=""
        width={800}
        height={600}
        className="mt-4 h-64 w-full object-cover"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
      />
      <p className="mt-2 text-sm font-medium tabular-nums">{item.priceLabel}</p>
      <p className="text-sm text-muted-foreground">{item.title}</p>
      {item.meta ? <p className="text-sm text-muted-foreground">{item.meta}</p> : null}
    </Link>
  )
}
