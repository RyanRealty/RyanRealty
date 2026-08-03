/* eslint-disable jsx-a11y/alt-text -- react-pdf Image does not support alt prop */
/**
 * Comparison PDF (side-by-side 2–4 homes). @react-pdf/renderer.
 */

import React from 'react'
import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer'
import { REACT_PDF_PAGE_STYLE, REACT_PDF_FOOTER_STYLE } from '@/lib/pdf/page-contract'

const styles = StyleSheet.create({
  page: {
    ...REACT_PDF_PAGE_STYLE, fontSize: 10 },
  navyBar: { backgroundColor: '#102742', padding: 12, marginBottom: 16 },
  logoText: { color: '#f0eeec', fontSize: 18, fontWeight: 'bold' },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 12, color: '#102742' },
  row: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 16, marginBottom: 12 },
  col: { width: '48%', minWidth: 200 },
  footer: {
    ...REACT_PDF_FOOTER_STYLE, fontSize: 8, color: '#6b7280', textAlign: 'center' as const },
})

export type ComparisonListing = {
  address: string
  price: number
  beds: number | null
  baths: number | null
  sqft: number | null
  photoUrl?: string | null
}

export type ComparisonPdfData = {
  listings: ComparisonListing[]
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function ComparisonPdfDocument({ data }: { data: ComparisonPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.navyBar}>
          <Text style={styles.logoText}>Ryan Realty</Text>
        </View>
        <Text style={styles.title}>Property Comparison</Text>
        <View style={styles.row}>
          {data.listings.slice(0, 4).map((list, i) => (
            <View key={i} style={styles.col}>
              {list.photoUrl ? <Image src={list.photoUrl} style={{ width: '100%', height: 100, objectFit: 'cover' }} /> : null}
              <Text style={{ fontWeight: 'bold', marginTop: 4 }}>{list.address}</Text>
              <Text>{formatPrice(list.price)}</Text>
              <Text>{[list.beds != null && `${list.beds} bed`, list.baths != null && `${list.baths} bath`, list.sqft != null && `${list.sqft} sqft`].filter(Boolean).join(' · ')}</Text>
            </View>
          ))}
        </View>
        <View style={styles.footer} fixed>
          <Text>Ryan Realty · Equal Housing Opportunity</Text>
        </View>
      </Page>
    </Document>
  )
}
