// @no-parity
// TEMPORARY verification harness for AnimatedSalesMap. Deleted before handoff.
import { getAnimatedSalesMapData } from '@/lib/data'
import AnimatedSalesMap from '@/components/geo-page/AnimatedSalesMap.client'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const vow = await getAnimatedSalesMapData({
    geoType: 'city',
    geoSlug: 'bend',
    scope: { kind: 'city', city: 'Bend' },
    audience: 'vow',
    monthsBack: 12,
    limit: 150,
  })
  const pub = await getAnimatedSalesMapData({
    geoType: 'city',
    geoSlug: 'bend',
    scope: { kind: 'city', city: 'Bend' },
    audience: 'public',
  })

  return (
    <main style={{ padding: 24, display: 'grid', gap: 32, maxWidth: 900, margin: '0 auto' }}>
      <pre id="trace" style={{ fontSize: 12 }}>
        {JSON.stringify(
          {
            vow: vow.trace,
            pub: pub.trace,
            vowSales: vow.sales.length,
            pubSales: pub.sales.length,
            hasBoundary: Boolean(vow.boundary),
          },
          null,
          2,
        )}
      </pre>

      <section>
        <h2>VOW (sales render)</h2>
        <AnimatedSalesMap boundary={vow.boundary} sales={vow.sales} audience="vow" />
      </section>

      <section>
        <h2>PUBLIC (boundary only)</h2>
        <AnimatedSalesMap boundary={pub.boundary} sales={pub.sales} audience="public" />
      </section>

      <section>
        <h2>No boundary, sales only</h2>
        <AnimatedSalesMap boundary={null} sales={vow.sales.slice(0, 12)} audience="vow" />
      </section>

      <section>
        <h2>Single sale</h2>
        <AnimatedSalesMap boundary={null} sales={vow.sales.slice(0, 1)} audience="vow" />
      </section>

      <section id="empty-case">
        <h2>No data at all (must render nothing)</h2>
        <AnimatedSalesMap boundary={null} sales={[]} audience="vow" />
      </section>
    </main>
  )
}
