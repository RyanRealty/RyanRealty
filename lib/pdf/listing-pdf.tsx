/**
 * Listing sheet PDF (3-page branded). @react-pdf/renderer.
 */

import React from 'react'
import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10 },
  navyBar: { backgroundColor: '#102742', padding: 12, marginBottom: 16 },
  logoText: { color: '#f0eeec', fontSize: 18, fontWeight: 'bold' },
  address: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  price: { fontSize: 20, fontWeight: 'bold', color: '#102742', marginVertical: 8 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  footer: { position: 'absolute' as const, bottom: 30, left: 40, right: 40, fontSize: 8, color: '#6b7280', textAlign: 'center' as const },
})

export type ListingPdfData = {
  address: string
  city?: string | null
  state?: string | null
  zip?: string | null
  price: number
  beds: number | null
  baths: number | null
  sqft: number | null
  lotAcres: number | null
  yearBuilt: number | null
  garageSpaces: number | null
  status?: string | null
  daysOnMarket?: number | null
  mlsNumber?: string | null
  heroPhotoUrl?: string | null
  description?: string | null
  agentName?: string | null
  agentPhone?: string | null
  agentEmail?: string | null
  listingUrl?: string | null
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function ListingPdfDocument({ data }: { data: ListingPdfData }) {
  const loc = [data.address, data.city, data.state, data.zip].filter(Boolean).join(', ')
  const stats = [
    data.beds != null && `${data.beds} bed`,
    data.baths != null && `${data.baths} bath`,
    data.sqft != null && `${data.sqft} sqft`,
    data.lotAcres != null && `${data.lotAcres} ac`,
    data.yearBuilt != null && `Built ${data.yearBuilt}`,
    data.garageSpaces != null && `${data.garageSpaces} garage`,
  ].filter(Boolean).join(' · ')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.navyBar}>
          <Text style={styles.logoText}>Ryan Realty</Text>
        </View>
        <Text style={styles.address}>{loc}</Text>
        {data.heroPhotoUrl ? (
          <Image src={data.heroPhotoUrl} style={{ width: '100%', maxHeight: 200, marginVertical: 12, objectFit: 'cover' }} />
        ) : null}
        <Text style={styles.price}>{formatPrice(data.price)}</Text>
        <Text style={styles.stats}>{stats}</Text>
        {data.status ? <Text>{data.status}</Text> : null}
        {data.daysOnMarket != null ? <Text>DOM: {data.daysOnMarket}</Text> : null}
        {data.mlsNumber ? <Text>MLS# {data.mlsNumber}</Text> : null}
        <View style={styles.footer} fixed>
          <Text>Generated from ryan-realty.com · Equal Housing Opportunity</Text>
        </View>
      </Page>
      <Page size="A4" style={styles.page}>
        <View style={styles.navyBar}>
          <Text style={styles.logoText}>Ryan Realty</Text>
        </View>
        {data.description ? (
          <Text style={{ marginBottom: 12 }}>{String(data.description).slice(0, 1500)}</Text>
        ) : null}
        <View style={styles.footer} fixed>
          <Text>Ryan Realty · Central Oregon</Text>
        </View>
      </Page>
      <Page size="A4" style={styles.page}>
        <View style={styles.navyBar}>
          <Text style={styles.logoText}>Ryan Realty</Text>
        </View>
        {data.agentName ? <Text>Contact: {data.agentName}</Text> : null}
        {data.agentPhone ? <Text>{data.agentPhone}</Text> : null}
        {data.agentEmail ? <Text>{data.agentEmail}</Text> : null}
        {data.listingUrl ? <Text>View online: {data.listingUrl}</Text> : null}
        <View style={styles.footer} fixed>
          <Text>Ryan Realty · Equal Housing Opportunity · MLS attribution</Text>
        </View>
      </Page>
    </Document>
  )
}
