/**
 * HomepageV6Hero — "the city is the homepage" (LOCKED Matt 2026-06-11).
 *
 * Hero media (Matt 2026-06-14): the old-site DRONE FLYOVER video is the default
 * (Old Mill / Deschutes / Cascades aerial, /videos/hero-optimized.mp4), over a
 * poster-first LCP. The live 3D Bend tiles are the fallback only when no hero
 * video exists. Natural-language ask bar + live-pulse chip. One Amboqia moment,
 * this H1. Everything else Geist. 150ms motion only.
 *
 * The poster (a real Google 3D Tiles capture of Bend, from the locked
 * mockup kit) is the LCP element: server-rendered <Image priority>, no JS
 * required. The 3D canvas is a lazy client island that fades in over it.
 *
 * Live-chip figures come from getRegionPulse (market_pulse_live region row,
 * 10-15 min freshness) — passed down from app/page.tsx, never hard-coded.
 */

import Image from 'next/image'
import { DisplayHeading } from '@/components/site/primitives'
import HomepageV6AskBar from './HomepageV6AskBar.client'
import HomepageV6CityTiles from './HomepageV6CityTiles.client'

/**
 * Hero media priority (Matt 2026-06-14): a video is the DEFAULT hero whenever
 * one exists; the live 3D Bend tiles are the fallback. Set to null to fall back
 * to the 3D tiles. Landscape brand video, poster = bend-3d-poster.jpg.
 */
const HERO_VIDEO_SRC: string | null = '/videos/hero-optimized.mp4'

type Props = {
  activeCount: number | null
  medianListPrice: number | null
  freshnessLabel: string | null
}

function fmtPrice(n: number): string {
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}

/** Bend neighborhood boundary strokes from the locked v6 mockup (static 1px, no dash-draw). */
function BoundaryLines() {
  return (
    <div className="v6-boundaries" aria-hidden="true">
      <svg viewBox="-40 -40 1280 1060" focusable="false">
        <path
          className="v6-nb"
          d="M 711.5 825.4 L 718.6 824.9 L 721.0 824.9 L 747.5 824.8 L 754.7 824.8 L 759.7 824.7 L 768.6 824.5 L 805.6 823.2 L 842.0 822.3 L 843.9 824.4 L 846.7 833.2 L 849.3 841.8 L 849.1 851.7 L 848.9 855.1 L 848.5 860.9 L 848.6 864.5 L 847.9 865.8 L 847.1 866.1 L 846.6 866.6 L 846.4 867.2 L 846.6 867.7 L 847.1 868.1 L 847.7 868.4 L 848.5 873.0 L 848.6 908.5 L 847.8 909.6 L 846.8 910.2 L 846.5 910.9 L 813.8 910.9 L 796.6 910.9 L 789.4 911.7 L 783.7 913.1 L 778.9 915.1 L 773.7 919.4 L 775.9 922.0 L 776.0 928.4 L 762.3 933.5 L 750.3 968.6 L 693.6 968.9 L 682.8 969.1 L 673.6 972.8 L 660.4 975.6 L 645.7 975.9 L 632.5 975.2 L 619.7 975.6 L 612.4 976.4 L 606.7 978.2 L 603.2 980.0 L 581.4 960.9 L 572.1 955.0 L 532.1 931.3 L 525.4 927.1 L 523.0 925.1 L 514.7 917.0 L 510.1 914.3 L 507.0 913.1 L 527.7 883.4 L 534.1 875.1 L 543.7 861.5 L 544.9 858.9 L 546.0 853.7 L 546.4 848.2 L 548.6 842.4 L 553.2 841.1 L 555.4 840.0 L 558.9 833.4 L 563.7 822.9 L 567.1 816.3 L 577.1 817.6 L 584.9 821.0 L 585.5 821.8 L 585.6 821.9 L 585.8 821.9 L 585.9 822.0 L 586.1 822.1 L 586.3 822.1 L 586.4 822.2 L 586.6 822.2 L 586.8 822.3 L 587.0 822.4 L 587.1 822.4 L 587.3 822.5 L 587.5 822.5 L 587.7 822.6 L 587.8 822.7 L 588.0 822.7 L 588.2 822.8 L 588.4 822.8 L 588.6 822.9 L 588.7 822.9 L 588.9 823.0 L 589.1 823.0 L 589.3 823.1 L 589.3 823.2 L 592.3 823.8 L 594.0 823.8 L 601.7 823.9 L 606.5 823.7 L 621.8 822.0 L 640.9 820.1 L 652.6 819.1 L 656.4 819.5 L 660.8 820.9 L 673.9 825.1 L 677.0 825.8 L 681.8 826.3 L 684.7 826.0 L 690.5 825.9 L 711.5 825.4 Z"
        />
        <path
          className="v6-nb"
          d="M 1024.5 700.7 L 1023.2 772.1 L 1025.2 796.8 L 1023.7 796.6 L 1021.0 796.6 L 989.7 796.4 L 978.6 796.4 L 978.1 825.7 L 956.6 825.7 L 936.0 827.0 L 932.9 853.8 L 895.1 853.9 L 849.0 853.9 L 849.5 843.2 L 848.8 839.4 L 844.1 825.3 L 843.7 822.3 L 820.1 823.0 L 773.2 824.3 L 762.6 824.6 L 756.7 824.7 L 751.4 824.8 L 721.0 824.9 L 718.6 824.9 L 711.5 825.4 L 704.6 825.8 L 690.5 825.9 L 684.7 826.0 L 681.8 826.3 L 677.0 825.8 L 673.9 825.1 L 660.8 820.9 L 656.4 819.5 L 652.6 819.1 L 640.9 820.1 L 621.8 822.0 L 606.5 823.7 L 601.7 823.9 L 594.0 823.8 L 592.3 823.8 L 589.3 823.2 L 589.3 823.1 L 589.1 823.0 L 588.9 823.0 L 588.7 822.9 L 588.6 822.9 L 588.4 822.8 L 588.2 822.8 L 588.0 822.7 L 587.8 822.7 L 587.7 822.6 L 587.5 822.5 L 587.3 822.5 L 587.1 822.4 L 587.0 822.4 L 586.8 822.3 L 586.6 822.2 L 586.4 822.2 L 586.3 822.1 L 586.1 822.1 L 585.9 822.0 L 585.8 821.9 L 585.6 821.9 L 585.5 821.8 L 584.9 821.0 L 577.1 817.6 L 568.8 812.3 L 576.6 795.0 L 579.4 789.1 L 583.5 780.0 L 591.7 762.3 L 594.5 757.4 L 596.2 755.3 L 604.4 747.1 L 586.2 747.1 L 580.0 742.7 L 592.1 729.9 L 594.3 726.9 L 597.3 721.7 L 598.8 717.6 L 601.9 707.5 L 605.1 699.4 L 607.9 695.5 L 616.5 688.3 L 625.2 682.3 L 631.5 677.6 L 642.8 669.5 L 649.8 670.1 L 660.0 670.2 L 704.9 670.1 L 708.5 669.7 L 720.8 666.7 L 723.2 666.5 L 724.8 666.6 L 735.3 668.7 L 753.7 672.3 L 765.0 675.5 L 771.5 678.5 L 776.1 679.8 L 788.9 682.2 L 796.9 682.5 L 815.3 682.7 L 844.8 682.9 L 865.4 682.6 L 901.2 682.2 L 937.8 681.7 L 974.3 681.9 L 1003.1 682.1 L 1026.2 682.3 L 1068.1 682.5 L 1024.5 700.7 Z"
        />
        <path
          className="v6-nb"
          d="M 1068.9 569.7 L 1068.5 611.5 L 1068.4 638.8 L 1068.1 682.5 L 1053.3 682.5 L 1026.2 682.3 L 1024.8 682.3 L 991.8 682.1 L 974.3 681.9 L 946.2 681.7 L 932.5 681.8 L 901.2 682.2 L 872.7 682.7 L 861.2 682.7 L 844.8 682.9 L 824.5 682.8 L 804.9 682.6 L 796.9 682.5 L 790.6 682.3 L 787.3 682.0 L 776.1 679.8 L 772.9 679.0 L 770.0 677.9 L 765.0 675.5 L 757.5 673.1 L 748.6 671.3 L 735.3 668.7 L 726.2 666.9 L 723.9 666.5 L 723.2 666.5 L 722.2 666.5 L 719.4 666.9 L 708.5 669.7 L 705.7 670.0 L 703.6 670.1 L 660.0 670.2 L 653.1 670.1 L 645.4 669.9 L 642.8 669.5 L 647.6 665.9 L 651.2 663.2 L 653.3 661.4 L 655.1 659.3 L 656.7 657.3 L 659.4 653.0 L 660.1 651.1 L 661.1 646.3 L 661.4 644.3 L 661.4 635.1 L 661.3 622.1 L 660.9 604.9 L 659.7 597.5 L 656.7 589.1 L 653.1 580.3 L 652.4 577.6 L 650.9 569.5 L 650.9 564.2 L 650.7 563.4 L 650.8 545.4 L 650.8 533.5 L 662.6 533.5 L 677.9 533.5 L 705.3 533.4 L 721.3 533.4 L 746.4 533.3 L 762.6 533.4 L 769.3 533.4 L 774.7 533.4 L 793.7 533.4 L 803.2 533.4 L 808.4 532.5 L 808.4 531.5 L 808.4 530.2 L 808.4 528.0 L 808.4 526.9 L 808.4 525.8 L 808.4 524.8 L 808.4 522.8 L 808.4 522.1 L 808.4 520.9 L 808.4 520.4 L 808.4 519.4 L 808.4 517.0 L 808.4 514.8 L 808.4 513.3 L 808.7 512.4 L 816.6 512.5 L 819.9 513.4 L 823.1 517.0 L 826.5 520.0 L 830.3 522.4 L 834.5 524.4 L 839.8 526.4 L 844.9 527.7 L 849.0 528.4 L 852.5 528.8 L 858.4 529.3 L 868.7 529.7 L 874.6 529.9 L 878.1 529.5 L 883.6 529.6 L 887.8 529.8 L 892.4 530.4 L 894.5 530.8 L 899.3 532.1 L 904.2 533.4 L 908.5 534.6 L 917.0 536.9 L 921.3 538.1 L 927.2 539.7 L 935.1 541.0 L 938.8 541.2 L 953.9 541.4 L 973.1 541.4 L 981.7 541.4 L 1020.6 541.8 L 1029.1 541.8 L 1068.1 542.0 L 1100.5 542.1 L 1112.1 542.9 L 1112.3 553.9 L 1111.9 569.7 L 1101.7 569.0 L 1069.1 569.0 L 1068.9 569.7 Z"
        />
      </svg>
    </div>
  )
}

export default function HomepageV6Hero({ activeCount, medianListPrice, freshnessLabel }: Props) {
  const chipParts: string[] = []
  if (activeCount != null) chipParts.push(`${activeCount.toLocaleString('en-US')} active`)
  if (medianListPrice != null) chipParts.push(`median ${fmtPrice(medianListPrice)}`)
  if (freshnessLabel) chipParts.push(freshnessLabel)

  return (
    <section className="v6-hero">
      <div className="v6-hero-poster">
        <Image
          src="/images/hero/bend-3d-poster.jpg"
          alt="Aerial view of Bend, Oregon rendered from photoreal 3D map tiles"
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover"
        />
      </div>
      {/* Hero media priority (Matt 2026-06-14): VIDEO is the default whenever one
          exists; the live 3D Bend tiles are the fallback when there is no hero
          video. The poster above is the LCP + the video's poster frame. */}
      {HERO_VIDEO_SRC ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/images/hero/bend-3d-poster.jpg"
          aria-hidden="true"
        >
          <source src={HERO_VIDEO_SRC} type="video/mp4" />
        </video>
      ) : (
        <>
          <HomepageV6CityTiles apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null} />
          <BoundaryLines />
        </>
      )}
      <div className="v6-scrim-left" aria-hidden="true" />
      <div className="v6-scrim-bottom" aria-hidden="true" />

      <div className="v6-hero-stack">
        {chipParts.length > 0 && (
          <div className="v6-live-chip v6-panel v6-tnum">
            <span className="v6-dot" aria-hidden="true" />
            <span className="v6-label">Live · {chipParts.join(' · ')}</span>
          </div>
        )}
        <DisplayHeading as="h1" className="v6-h1">
          This is Bend, right now.
        </DisplayHeading>
        <HomepageV6AskBar />
      </div>
    </section>
  )
}
