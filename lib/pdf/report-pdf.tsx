/* eslint-disable jsx-a11y/alt-text -- react-pdf Image does not support alt prop */
/**
 * Market report PDF. @react-pdf/renderer.
 * Branded with brokerage logo (or name), brand fonts (Amboqia display, AzoSans body), and brand colors.
 */

import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer'

// Use Inter from CDN as a fallback since custom fonts (Amboqia, AzoSans) are not bundled.
Font.register({
  family: 'Amboqia',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-400-normal.woff', fontWeight: 400, fontStyle: 'normal' },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-700-normal.woff', fontWeight: 700, fontStyle: 'normal' },
  ],
})
Font.register({
  family: 'AzoSans',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-400-normal.woff', fontWeight: 400, fontStyle: 'normal' },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-500-normal.woff', fontWeight: 500, fontStyle: 'normal' },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-700-normal.woff', fontWeight: 700, fontStyle: 'normal' },
  ],
})

const BRAND_NAVY = '#102742'
const BRAND_CREAM = '#F0EEEC'
const TEXT_SECONDARY = '#6B6058'
const TEXT_PRIMARY = '#1A1410'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'AzoSans',
    color: TEXT_PRIMARY,
  },
  navyBar: {
    backgroundColor: BRAND_NAVY,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImg: { height: 28, width: 'auto', maxWidth: 140 },
  logoText: {
    color: BRAND_CREAM,
    fontSize: 18,
    fontFamily: 'Amboqia',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Amboqia',
    fontWeight: 'bold',
    marginBottom: 12,
    color: BRAND_NAVY,
  },
  body: { fontFamily: 'AzoSans', color: TEXT_PRIMARY },
  sectionHeading: {
    fontFamily: 'AzoSans',
    fontWeight: 'bold',
    fontSize: 10,
    color: BRAND_NAVY,
    marginBottom: 3,
  },
  footer: {
    position: 'absolute' as const,
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: TEXT_SECONDARY,
    textAlign: 'center' as const,
    fontFamily: 'AzoSans',
  },
})

export type ReportBranding = {
  brokerageName: string
  brokerageLogoUrl?: string | null
}

/**
 * One labeled block of figures.
 *
 * §0: a market document carries figures measured over DIFFERENT windows — a
 * chosen closed-sale period, a trailing-12-month count, and a live inventory
 * snapshot that has no period at all. They used to be emitted as one flat
 * key/value list under a single header, so a Terrebonne export printed
 * "21 months of supply" inside a 6.8-month window with nothing on the page
 * saying the two were measured differently. Every block states its own window
 * in `heading`; a figure without a stated window does not belong in one.
 */
export type ReportSection = {
  heading: string
  rows: Array<[string, number | string]>
}

export type ReportPdfData = {
  title: string
  geoName: string
  /** The document's headline window. Each section restates its own. */
  period: string
  sections?: ReportSection[]
  branding: ReportBranding
}

export function ReportPdfDocument({ data }: { data: ReportPdfData }) {
  const { branding } = data
  const name = branding.brokerageName || 'Ryan Realty'
  const logoUrl = branding.brokerageLogoUrl?.trim() || null

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.navyBar}>
          {logoUrl ? (
            <Image src={logoUrl} style={styles.logoImg} />
          ) : (
            <Text style={styles.logoText}>{name}</Text>
          )}
        </View>
        <Text style={styles.title}>{data.title}</Text>
        {/* Middle dot, not an em-dash: this is a client-facing document and the
            brand's place separator is `·` (CLAUDE.md brand voice). */}
        <Text style={styles.body}>{data.geoName} · {data.period}</Text>
        {data.sections?.length ? (
          <View style={{ marginTop: 12 }}>
            {data.sections.map((section) => (
              <View key={section.heading} style={{ marginBottom: 10 }}>
                <Text style={styles.sectionHeading}>{section.heading}</Text>
                {section.rows.map(([k, v]) => (
                  <Text key={k} style={styles.body}>{k}: {String(v)}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.footer} fixed>
          <Text>{name} · Market Report · Equal Housing Opportunity</Text>
        </View>
      </Page>
    </Document>
  )
}
