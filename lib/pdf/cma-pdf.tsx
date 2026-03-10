/**
 * CMA PDF document (4-page branded). @react-pdf/renderer.
 */

import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import type { CMAResult } from '@/lib/cma'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10 },
  navyBar: { backgroundColor: '#102742', padding: 12, marginBottom: 16 },
  logoText: { color: '#f0eeec', fontSize: 18, fontWeight: 'bold' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#102742' },
  address: { fontSize: 14, marginBottom: 4 },
  value: { fontSize: 22, fontWeight: 'bold', color: '#102742', marginTop: 12, marginBottom: 4 },
  valueRange: { fontSize: 11, color: '#6b7280', marginBottom: 8 },
  confidence: { fontSize: 10, marginBottom: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  stat: { fontSize: 10 },
  date: { fontSize: 9, color: '#6b7280', marginTop: 16 },
  table: { marginTop: 12 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb', paddingVertical: 6 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 2, borderColor: '#102742', paddingVertical: 6, fontWeight: 'bold' },
  col1: { width: '25%' },
  col2: { width: '15%' },
  col3: { width: '15%' },
  col4: { width: '20%' },
  col5: { width: '25%' },
  disclaimer: { fontSize: 8, color: '#6b7280', marginTop: 24 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#6b7280', textAlign: 'center' },
})

export type CMAPdfData = {
  cma: CMAResult
  address: string
  beds: number | null
  baths: number | null
  sqft: number | null
  lotAcres: number | null
  yearBuilt: number | null
  heroPhotoUrl?: string | null
  agentName?: string | null
  agentEmail?: string | null
  agentPhone?: string | null
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function CMAPdfDocument({ data }: { data: CMAPdfData }) {
  const { cma, address, beds, baths, sqft, lotAcres, yearBuilt } = data
  const stats = [beds != null && `${beds} bed`, baths != null && `${baths} bath`, sqft != null && `${sqft} sqft`, lotAcres != null && `${lotAcres} ac`, yearBuilt != null && `Built ${yearBuilt}`].filter(Boolean).join(' · ')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.navyBar}>
          <Text style={styles.logoText}>Ryan Realty</Text>
        </View>
        <Text style={styles.title}>Comparative Market Analysis</Text>
        <Text style={styles.address}>{address}</Text>
        {data.heroPhotoUrl ? (
          <Image src={data.heroPhotoUrl} style={{ width: '100%', maxHeight: 180, marginVertical: 12, objectFit: 'cover' }} />
        ) : null}
        <Text style={styles.value}>Estimated Market Value: {formatPrice(cma.estimatedValue)}</Text>
        <Text style={styles.valueRange}>Range: {formatPrice(cma.valueLow)} — {formatPrice(cma.valueHigh)}</Text>
        <Text style={styles.confidence}>Confidence: {cma.confidence.charAt(0).toUpperCase() + cma.confidence.slice(1)}</Text>
        <Text style={styles.stats}>{stats}</Text>
        <Text style={styles.date}>Generated {new Date().toLocaleDateString('en-US')}</Text>
        {data.agentName ? <Text style={styles.date}>Prepared by {data.agentName}</Text> : null}
        <View style={styles.footer} fixed>
          <Text>This is an estimate and not a formal appraisal. MLS data. Equal Housing Opportunity.</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.navyBar}>
          <Text style={styles.logoText}>Ryan Realty</Text>
        </View>
        <Text style={styles.title}>Comparable Sales</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Address</Text>
            <Text style={styles.col2}>Sold</Text>
            <Text style={styles.col3}>Date</Text>
            <Text style={styles.col4}>Beds/Bath/Sqft</Text>
            <Text style={styles.col5}>Adjusted</Text>
          </View>
          {cma.comps.slice(0, 6).map((comp, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col1}>{comp.address}</Text>
              <Text style={styles.col2}>{formatPrice(comp.soldPrice)}</Text>
              <Text style={styles.col3}>{comp.soldDate}</Text>
              <Text style={styles.col4}>{comp.beds}/{comp.baths}{comp.sqft != null ? ` / ${comp.sqft}` : ''}</Text>
              <Text style={styles.col5}>{formatPrice(comp.adjustedPrice)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.disclaimer}>{cma.methodology}</Text>
        <View style={styles.footer} fixed>
          <Text>Ryan Realty · Central Oregon</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.navyBar}>
          <Text style={styles.logoText}>Ryan Realty</Text>
        </View>
        <Text style={styles.title}>Market Context</Text>
        <Text style={styles.disclaimer}>Market condition and trends are based on local MLS data. Median price, days on market, and inventory metrics vary by area and time period.</Text>
        <View style={styles.footer} fixed>
          <Text>This is an estimate and not a formal appraisal.</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.navyBar}>
          <Text style={styles.logoText}>Ryan Realty</Text>
        </View>
        <Text style={styles.title}>Methodology & Disclaimer</Text>
        <Text style={styles.disclaimer}>{cma.methodology}</Text>
        <Text style={styles.disclaimer}>This estimate is not a formal appraisal. Data sources: MLS. For professional valuation, contact a licensed appraiser.</Text>
        {data.agentName && (data.agentEmail || data.agentPhone) ? (
          <Text style={styles.date}>Contact: {data.agentName} {data.agentEmail ?? ''} {data.agentPhone ?? ''}</Text>
        ) : null}
        <View style={styles.footer} fixed>
          <Text>Ryan Realty · Equal Housing Opportunity · MLS attribution</Text>
        </View>
      </Page>
    </Document>
  )
}
