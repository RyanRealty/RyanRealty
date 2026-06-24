/* eslint-disable jsx-a11y/alt-text -- react-pdf has no alt prop */
/**
 * Rental property analysis PDF (branded, single page). @react-pdf/renderer.
 *
 * Every figure comes from the RentalAnalysisResult the API route computes via
 * analyzeRental (lib/rental-analysis.ts) — never the client's numbers — so the
 * PDF traces to the same verified engine (CLAUDE.md §0). The rent figure is a
 * user input / estimate; the disclaimer says so.
 */

import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { RentalAnalysisResult } from '@/lib/rental-analysis'

const NAVY = '#102742'
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#1a1a1a' },
  navyBar: { backgroundColor: NAVY, padding: 14, marginBottom: 18 },
  logoText: { color: '#faf8f4', fontSize: 16, fontWeight: 'bold' },
  kicker: { color: '#c9d2dd', fontSize: 9, marginTop: 2 },
  h2: { fontSize: 12, fontWeight: 'bold', color: NAVY, marginTop: 16, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  stat: { width: '33%', marginBottom: 10 },
  statValue: { fontSize: 15, fontWeight: 'bold', color: NAVY },
  statKey: { fontSize: 8, color: '#6b7280', marginTop: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  rowKey: { color: '#374151' },
  rowVal: { fontWeight: 'bold' },
  th: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: NAVY, paddingBottom: 3, marginTop: 4 },
  thc: { flex: 1, fontSize: 8, fontWeight: 'bold', color: NAVY },
  tr: { flexDirection: 'row', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  tc: { flex: 1, fontSize: 9 },
  disc: { marginTop: 16, fontSize: 8, color: '#6b7280', lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 28, left: 40, right: 40, fontSize: 8, color: '#6b7280', textAlign: 'center' },
})

export type RentalPdfData = {
  propertyLabel?: string | null
  purchasePrice: number
  downPaymentPct: number
  interestRatePct: number
  loanTermYears: number
  grossRentMonthly: number
  result: RentalAnalysisResult
  generatedOn?: string | null
}

function usd(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US')
}
function pct(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1) + '%'
}

const MILESTONES = [1, 5, 10, 20, 30]

export function RentalPdfDocument({ data }: { data: RentalPdfData }) {
  const r = data.result
  const rows = r.projection.filter((p) => MILESTONES.includes(p.year))
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.navyBar}>
          <Text style={styles.logoText}>Ryan Realty</Text>
          <Text style={styles.kicker}>Rental property analysis · Bend · Oregon</Text>
        </View>

        {data.propertyLabel ? <Text style={styles.label}>{data.propertyLabel}</Text> : null}
        <Text style={{ fontSize: 9, color: '#6b7280', marginBottom: 8 }}>
          {usd(data.purchasePrice)} purchase · {data.downPaymentPct}% down · {pct(data.interestRatePct)} over{' '}
          {data.loanTermYears} years · {usd(data.grossRentMonthly)} rent per month
        </Text>

        <View style={styles.statGrid}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{usd(r.cashFlowMonthly)}</Text>
            <Text style={styles.statKey}>Monthly cash flow</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{pct(r.capRatePurchase)}</Text>
            <Text style={styles.statKey}>Cap rate</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{pct(r.cashOnCash)}</Text>
            <Text style={styles.statKey}>Cash-on-cash return</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{usd(r.totalCashNeeded)}</Text>
            <Text style={styles.statKey}>Total cash needed</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{usd(r.noiAnnual)}</Text>
            <Text style={styles.statKey}>Net operating income / yr</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{r.dscr.toFixed(2)}</Text>
            <Text style={styles.statKey}>Debt-service coverage</Text>
          </View>
        </View>

        <Text style={styles.h2}>Monthly cash flow</Text>
        <View style={styles.row}><Text style={styles.rowKey}>Gross rent</Text><Text style={styles.rowVal}>{usd(r.grossRentMonthly)}</Text></View>
        <View style={styles.row}><Text style={styles.rowKey}>Vacancy</Text><Text style={styles.rowVal}>-{usd(r.vacancyAnnual / 12)}</Text></View>
        <View style={styles.row}><Text style={styles.rowKey}>Operating expenses</Text><Text style={styles.rowVal}>-{usd(r.operatingExpensesMonthly)}</Text></View>
        <View style={styles.row}><Text style={styles.rowKey}>Mortgage (principal + interest)</Text><Text style={styles.rowVal}>-{usd(r.monthlyDebtService)}</Text></View>
        <View style={[styles.row, { borderTopWidth: 1, borderTopColor: NAVY, marginTop: 3, paddingTop: 4 }]}>
          <Text style={{ fontWeight: 'bold', color: NAVY }}>Net monthly cash flow</Text>
          <Text style={{ fontWeight: 'bold', color: NAVY }}>{usd(r.cashFlowMonthly)}</Text>
        </View>

        <Text style={styles.h2}>Long-term projection</Text>
        <View style={styles.th}>
          <Text style={styles.thc}>Year</Text>
          <Text style={styles.thc}>Property value</Text>
          <Text style={styles.thc}>Loan balance</Text>
          <Text style={styles.thc}>Equity</Text>
          <Text style={styles.thc}>Annual cash flow</Text>
        </View>
        {rows.map((p) => (
          <View key={p.year} style={styles.tr}>
            <Text style={styles.tc}>{p.year}</Text>
            <Text style={styles.tc}>{usd(p.propertyValue)}</Text>
            <Text style={styles.tc}>{usd(p.loanBalance)}</Text>
            <Text style={styles.tc}>{usd(p.equity)}</Text>
            <Text style={styles.tc}>{usd(p.cashFlow)}</Text>
          </View>
        ))}

        <Text style={styles.disc}>
          These figures are estimates based on the inputs provided, not investment advice, an appraisal, or a
          guarantee of rent, value, or return. Rent and growth assumptions are user inputs. Talk to a Ryan Realty
          broker for real rent comps and help underwriting a specific property.
        </Text>

        <Text style={styles.footer}>
          Ryan Realty · 541.703.3095 · ryan-realty.com{data.generatedOn ? ` · ${data.generatedOn}` : ''}
        </Text>
      </Page>
    </Document>
  )
}
