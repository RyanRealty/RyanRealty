import '@/components/place/place-opening.css'
import { V3MosBars } from '@/components/site/v3/V3MosBars'
import type { PlaceMosView } from '@/lib/site/place-mos'

/** Place still, with an optional MOS two-bar overlay. Null poster still works. Null MOS omits the drawing. */
export function PlaceAreaHero({
  posterSrc,
  mos,
}: {
  posterSrc: string | null | undefined
  mos?: PlaceMosView | null
}) {
  if (!posterSrc && !mos) return null
  return (
    <>
      {posterSrc ? (
        <div className="place-opening__media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={posterSrc} alt="" decoding="async" fetchPriority="high" />
        </div>
      ) : null}
      {mos ? (
        <div className="place-opening__mos">
          <V3MosBars
            caption={mos.caption}
            plainLabel={mos.plainLabel}
            homesName={mos.homesName}
            homesLabel={mos.homesLabel}
            homesValue={mos.homesValue}
            salesName={mos.salesName}
            salesLabel={mos.salesLabel}
            salesValue={mos.salesValue}
            source={mos.source}
            asOf={mos.asOf}
            sourceName="Oregon Data Share"
            tooltip={mos.tooltip}
          />
        </div>
      ) : null}
    </>
  )
}
