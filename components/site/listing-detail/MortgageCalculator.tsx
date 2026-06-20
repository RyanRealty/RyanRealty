'use client'

import { useMemo, useState } from 'react'
import {
  Body,
  Price,
} from '@/components/site/primitives'

/**
 * Listing-detail MortgageCalculator — KB section style.
 * Navy sec-head, Amboqia heading. All interactive controls preserved.
 *
 * Per CLAUDE.md §0 Data Accuracy: labeled as estimate, not a quote.
 */

type Props = {
  listPrice: number | null
  taxAnnualAmount?: number | null
  className?: string
}

const DEFAULT_RATE_PCT = 7.0
const DEFAULT_DOWN_PCT = 20
const DEFAULT_TERM_YEARS = 30
const TAX_FALLBACK_PCT = 0.85
const INSURANCE_PER_300K = 1000

function monthlyPI(principal: number, ratePct: number, termYears: number): number {
  if (principal <= 0 || termYears <= 0) return 0
  const r = ratePct / 100 / 12
  const n = termYears * 12
  if (r === 0) return principal / n
  return (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1)
}

function parseCurrency(raw: string): number {
  const n = parseFloat(raw.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function parsePercent(raw: string): number {
  const n = parseFloat(raw.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function MortgageCalculator({ listPrice, taxAnnualAmount, className }: Props) {
  const [priceInput, setPriceInput] = useState(listPrice ? String(listPrice) : '')
  const [downPctInput, setDownPctInput] = useState(String(DEFAULT_DOWN_PCT))
  const [rateInput, setRateInput] = useState(String(DEFAULT_RATE_PCT))
  const [termInput, setTermInput] = useState(String(DEFAULT_TERM_YEARS))

  const result = useMemo(() => {
    const price = parseCurrency(priceInput)
    const downPct = parsePercent(downPctInput)
    const ratePct = parsePercent(rateInput)
    const termYears = Math.max(1, Math.round(parsePercent(termInput)))
    const down = price * (downPct / 100)
    const principal = Math.max(0, price - down)
    const pi = monthlyPI(principal, ratePct, termYears)
    const taxesPerYear = taxAnnualAmount ?? price * (TAX_FALLBACK_PCT / 100)
    const insurancePerYear = (price / 300_000) * INSURANCE_PER_300K
    const taxesMonthly = taxesPerYear / 12
    const insuranceMonthly = insurancePerYear / 12
    return {
      principal,
      down,
      pi,
      taxesMonthly,
      insuranceMonthly,
      piti: pi + taxesMonthly + insuranceMonthly,
    }
  }, [priceInput, downPctInput, rateInput, termInput, taxAnnualAmount])

  return (
    <section className={className}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">Estimate</div>
          <h2 className="sec-title display">Monthly payment</h2>
        </div>
      </div>

      <div style={{ marginTop: 'clamp(22px,3vw,36px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Body size="small" tone="muted">
          A rough estimate, not a quote. A real number comes from a lender.
        </Body>

        {/* Input fields */}
        <div
          style={{
            border: '3px solid var(--navy)',
            padding: '22px 24px',
            display: 'grid',
            gap: 16,
            background: 'var(--cream)',
          }}
        >
          <KbField label="Home price" id="mc-price">
            <input
              id="mc-price"
              type="text"
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              style={KB_INPUT_STYLE}
            />
          </KbField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <KbField label="Down payment %" id="mc-down">
              <input
                id="mc-down"
                type="text"
                inputMode="decimal"
                value={downPctInput}
                onChange={(e) => setDownPctInput(e.target.value)}
                style={KB_INPUT_STYLE}
              />
            </KbField>
            <KbField label="Rate %" id="mc-rate">
              <input
                id="mc-rate"
                type="text"
                inputMode="decimal"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                style={KB_INPUT_STYLE}
              />
            </KbField>
          </div>
          <KbField label="Term (years)" id="mc-term">
            <input
              id="mc-term"
              type="text"
              inputMode="numeric"
              value={termInput}
              onChange={(e) => setTermInput(e.target.value)}
              style={KB_INPUT_STYLE}
            />
          </KbField>
        </div>

        {/* Results */}
        <div
          style={{
            background: 'var(--navy)',
            color: 'var(--cream)',
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <KpiRow label="Principal + interest" value={<Price value={Math.round(result.pi)} />} />
          <KpiRow label="Property taxes" value={<Price value={Math.round(result.taxesMonthly)} />} />
          <KpiRow label="Homeowners insurance" value={<Price value={Math.round(result.insuranceMonthly)} />} />
          <div
            style={{
              borderTop: '1px solid rgba(250,248,244,0.28)',
              marginTop: 6,
              paddingTop: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(250,248,244,0.7)',
              }}
            >
              Total monthly (PITI)
            </span>
            <span
              style={{
                fontFamily: 'var(--font-amboqia, serif)',
                fontSize: 'clamp(1.6rem,3.5vw,2.2rem)',
                lineHeight: 1,
                color: 'var(--cream)',
                fontVariantNumeric: 'tabular-nums',
                overflow: 'visible',
              }}
            >
              <Price value={Math.round(result.piti)} />
            </span>
          </div>
          <p
            style={{
              fontSize: '0.68rem',
              color: 'rgba(250,248,244,0.5)',
              letterSpacing: '0.02em',
              lineHeight: 1.5,
              marginTop: 4,
            }}
          >
            Loan amount <Price value={Math.round(result.principal)} /> · <Price value={Math.round(result.down)} /> down · {termInput} year term
          </p>
        </div>
      </div>
    </section>
  )
}

/** KB cream field: 2px navy edge, navy text, no rounding. */
const KB_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  background: 'var(--cream)',
  border: '2px solid var(--navy)',
  borderRadius: 0,
  padding: '10px 12px',
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  fontWeight: 600,
  color: 'var(--navy)',
  fontVariantNumeric: 'tabular-nums',
  outline: 'none',
}

function KbField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: '0.6rem',
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(16,39,66,0.72)',
          fontFamily: 'var(--font-sans, sans-serif)',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function KpiRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span
        style={{
          fontSize: '0.78rem',
          color: 'rgba(250,248,244,0.62)',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          color: 'var(--cream)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}/mo
      </span>
    </div>
  )
}
