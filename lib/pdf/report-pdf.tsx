/**
 * Market report PDF. @react-pdf/renderer.
 */

import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10 },
  navyBar: { backgroundColor: '#102742', padding: 12, marginBottom: 16 },
  logoText: { color: '#f0eeec', fontSize: 18, fontWeight: 'bold' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#102742' },
  footer: { position: 'absolute' as const, bottom: 30, left: 40, right: 40, fontSize: 8, color: '#6b7280', textAlign: 'center' as const },
})

export type ReportPdfData = {
  title: string
  geoName: string
  period: string
  metrics?: Record<string, number | string>
}

export function ReportPdfDocument({ data }: { data: ReportPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.navyBar}>
          <Text style={styles.logoText}>Ryan Realty</Text>
        </View>
        <Text style={styles.title}>{data.title}</Text>
        <Text>{data.geoName} — {data.period}</Text>
        {data.metrics && Object.keys(data.metrics).length > 0 ? (
          <View style={{ marginTop: 12 }}>
            {Object.entries(data.metrics).map(([k, v]) => (
              <Text key={k}>{k}: {String(v)}</Text>
            ))}
          </View>
        ) : null}
        <View style={styles.footer} fixed>
          <Text>Ryan Realty · Market Report · Equal Housing Opportunity</Text>
        </View>
      </Page>
    </Document>
  )
}
