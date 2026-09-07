/**
 * /housing-market/reports .  sales reports and weekly snapshots.
 *
 * Cos IA: this page is NOT the live pulse dashboard. Live inventory / MOS / city
 * pulse live on /housing-market. Here: download or view sales by city and week.
 * Stats: Oregon Data Share via MarketPulse only. Never invent.
 */

// @data-free — sales/weekly chooser; figures load in ReportsIslands, not this page.

import type { Metadata } from "next"
import { MetadataBlock } from "@/components/site/MetadataBlock"
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
} from "@/components/site/v3"
import { ReportsInquirySheet } from "./_v3/ReportsInquirySheet.client"
import { RangeTableSection, SalesAndWeeklySection } from "./_v3/ReportsIslands"
import { CANONICAL_PATH, SELL_HREF, siteUrl } from "./_v3/hub-constants"
import { parseReportsParams } from "./_v3/hub-sections"
import {
  marketReportDoorLinks,
  marketReportHereBody,
} from "@/lib/market/report-doors"
import { PUBLIC_MARKET_PULSE_SOURCE } from "@/lib/market/publish-public-methodology"

const defaultOgImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: "Central Oregon sales and weekly reports",
  description:
    "Sales reports and weekly snapshots for Central Oregon. Live inventory and pace live on the Live market hub. Download or view sales by city and week.",
  alternates: { canonical: `${siteUrl}${CANONICAL_PATH}` },
  openGraph: {
    title: "Central Oregon sales and weekly reports",
    description:
      "Sales reports and weekly snapshots by city. Live pulse numbers live on the housing market hub.",
    url: `${siteUrl}${CANONICAL_PATH}`,
    type: "website",
    siteName: "Ryan Realty",
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: "Ryan Realty market reports" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Central Oregon sales and weekly reports",
    description:
      "Sales reports and weekly snapshots by city. Live pulse numbers live on the housing market hub.",
    images: [defaultOgImage],
  },
}

type PageProps = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }

export default async function ReportsIndexPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { cities: selectedCities, period } = parseReportsParams(params ?? null)

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock
          schemas={[
            {
              type: 'breadcrumb',
              items: [
                { name: "Home", url: "/" },
                { name: "Housing market", url: "/housing-market" },
                { name: "Sales and weekly reports", url: CANONICAL_PATH },
              ],
            },
            {
              type: 'webPage',
              name: "Central Oregon sales and weekly reports",
              description:
                "Sales reports and weekly snapshots by city. Live pulse numbers live on the housing market hub.",
              url: CANONICAL_PATH,
            },
          ]}
        />
        <V3Breadcrumb
          trail={[
            { label: "Home", href: "/" },
            { label: "Housing market", href: "/housing-market" },
            { label: "Sales and weekly reports" },
          ]}
        />

        <V3Quiet
          id="reports"
          eyebrow="Sales reports · Weekly snapshots"
          heading="Central Oregon sales and weekly reports"
          headingLevel={1}
          items={[
            {
              kind: "prose",
              term: "What this page is",
              body: "Download or view sales by city and week. Live inventory, months of supply, and city pulse live on the Live market hub. This page does not re-host those numbers.",
            },
            { label: "Live market hub", href: "/housing-market" },
            { label: "City pulse (Bend)", href: "/housing-market/bend" },
            { label: "Months of supply", href: "/months-of-supply" },
            {
              kind: "prose",
              term: "Source",
              body: `${PUBLIC_MARKET_PULSE_SOURCE}. Closed-sales cards and weekly snapshots use the same Oregon Data Share path the live pages cite.`,
            },
          ]}
        />

        <RangeTableSection selectedCities={selectedCities} period={period} />
        <SalesAndWeeklySection />

        <ReportsInquirySheet />

        <V3Quiet
          id="explore"
          eyebrow="Sales and weekly"
          heading="What each report is"
          items={[
            {
              kind: "prose",
              term: "Where you are",
              body: marketReportHereBody("published"),
            },
            ...marketReportDoorLinks("published"),
            { label: "Homes for sale", href: "/homes-for-sale?view=list" },
            { label: "Value my home", href: SELL_HREF },
            { label: "Oregon Data Share", href: "https://www.oregondatashare.com" },
          ]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
