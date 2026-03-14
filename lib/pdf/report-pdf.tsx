/**
 * Market report PDF. @react-pdf/renderer.
 * Branded with brokerage logo (or name), brand fonts (Amboqia display, AzoSans body), and brand colors.
 */

import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer'

const siteUrlRaw = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SITE_URL : undefined
const baseUrl = (typeof siteUrlRaw === 'string' ? siteUrlRaw.replace(/\/$/, '') : '') || 'https://ryan-realty.com'

Font.register({
  family: 'Amboqia',
  src: `${baseUrl}/fonts/Amboqia_Boriango.otf`,
})
Font.register({
  family: 'AzoSans',
  src: `${baseUrl}/fonts/AzoSans-Medium.ttf`,
  fontWeight: 500,
})

const BRAND_NAVY = '#102742'
const BRAND_CREAM = '#F0EEEC'
const BRAND_ACCENT = '#D4A853'
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
