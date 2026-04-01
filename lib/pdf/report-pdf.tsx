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

export type ReportPdfData = {
  title: string
  geoName: string
  period: string
  metrics?: Record<string, number | string>
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
        <Text style={styles.body}>{data.geoName} — {data.period}</Text>
        {data.metrics && Object.keys(data.metrics).length > 0 ? (
          <View style={{ marginTop: 12 }}>
            {Object.entries(data.metrics).map(([k, v]) => (
              <Text key={k} style={styles.body}>{k}: {String(v)}</Text>
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
