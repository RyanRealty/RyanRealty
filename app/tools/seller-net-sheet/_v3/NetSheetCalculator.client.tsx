'use client'
// Client boundary: the inputs are visitor state. Every figure comes from
// lib/tools/seller-net-sheet.ts, the same math the server-rendered example uses.

/**
 * The live seller net sheet (brief section 4). It runs on top of the page; the
 * worked example, the notes, and the FAQ are server HTML outside this island,
 * so nothing a crawler needs depends on it.
 *
 * No wall clock here: the default closing day arrives from the server as a
 * civil YYYY-MM-DD string, and the proration is civil-day arithmetic.
 */
import { useId, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { V3Button } from '@/components/site/v3'
import '@/components/site/v3/V3Input.css'
import {
  ESCROW_CARD_MAX,
  NET_SHEET_LIMITS,
  NET_SHEET_RATES,
  estimatedAnnualTax,
  netSheet,
  taxBillCanBePaid,
  validateNetSheet,
  type NetSheetField,
  type NetSheetInput,
} from '@/lib/tools/seller-net-sheet'
import { formatPriceExact } from '@/lib/format/money'
import { NET_SHEET_LINKS, NET_SHEET_ROW_SOURCES } from './net-sheet-constants'
import './net-sheet.css'

type Props = {
  defaultPrice: number
  defaultClosingDate: string
}

const usd = (n: number): string => formatPriceExact(Math.round(n))
const minus = (n: number): string => (Math.round(n) === 0 ? usd(0) : `\u2212${usd(n)}`)
const pct1 = (share: number): string => `${(Math.round(share * 1000) / 10).toFixed(1)}%`

/** A typed number, or null when the field is blank or not a number. */
function num(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function NetSheetCalculator({ defaultPrice, defaultClosingDate }: Props) {
  const uid = useId()
  const id = (name: string) => `${uid}-${name}`

  const [price, setPrice] = useState(String(defaultPrice))
  const [agentMode, setAgentMode] = useState<'pct' | 'usd'>('pct')
  const [agentValue, setAgentValue] = useState('0')
  const [loans, setLoans] = useState('1')
  const [pages, setPages] = useState('1')
  const [pagesTouched, setPagesTouched] = useState(false)
  const [payoff, setPayoff] = useState('')
  const [closingDate, setClosingDate] = useState(defaultClosingDate)
  const [taxRaw, setTaxRaw] = useState<string | null>(null)
  const [paid, setPaid] = useState<'unpaid' | 'paid'>('unpaid')
  const [hoa, setHoa] = useState('0')
  const [other, setOther] = useState('0')

  const priceNum = num(price)
  const taxDefault = priceNum != null && priceNum > 0 ? estimatedAnnualTax(priceNum) : 0
  const taxIsEstimate = taxRaw == null
  const canBePaid = taxBillCanBePaid(closingDate)
  const paidInFull = canBePaid && paid === 'paid'

  const input: NetSheetInput = {
    price: priceNum ?? Number.NaN,
    buyerAgent: { mode: agentMode, value: num(agentValue) ?? Number.NaN },
    loans: num(loans) ?? Number.NaN,
    pagesPerRelease: num(pages) ?? Number.NaN,
    payoff: payoff.trim() === '' ? null : (num(payoff) ?? Number.NaN),
    closingDate,
    annualTax: taxIsEstimate ? taxDefault : (num(taxRaw) ?? Number.NaN),
    paidInFull,
    hoaFees: num(hoa) ?? Number.NaN,
    otherCosts: num(other) ?? Number.NaN,
  }
  const errors = validateNetSheet(input)
  const ok = Object.keys(errors).length === 0
  const sheet = ok ? netSheet(input) : null

  const err = (field: NetSheetField) =>
    errors[field] ? (
      <span className="v3-net-calc__error" id={id(`${field}-error`)}>
        {errors[field]}
      </span>
    ) : null
  const described = (field: NetSheetField, hint?: unknown) =>
    [hint ? id(`${field}-hint`) : null, errors[field] ? id(`${field}-error`) : null].filter(Boolean).join(' ') || undefined

  const field = (
    name: NetSheetField,
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: { hint?: ReactNode; estimate?: boolean; inputMode?: 'numeric' | 'decimal'; type?: 'text' | 'date' } = {},
  ) => (
    <div className="v3-input">
      <label htmlFor={id(name)} className="v3-input__label">
        {label}
        {opts.estimate ? <span className="v3-net-calc__tag"> estimate</span> : null}
      </label>
      {opts.hint ? (
        <span className="v3-input__hint" id={id(`${name}-hint`)}>
          {opts.hint}
        </span>
      ) : null}
      <div className="v3-input__field">
        <input
          id={id(name)}
          name={name}
          type={opts.type ?? 'text'}
          inputMode={opts.type === 'date' ? undefined : (opts.inputMode ?? 'numeric')}
          className="v3-input__control"
          value={value}
          aria-invalid={errors[name] ? true : undefined}
          aria-describedby={described(name, opts.hint)}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {err(name)}
    </div>
  )

  const listingPct = `${Number((NET_SHEET_RATES.listingFeeRate * 100).toFixed(2))}%`
  const netLabel = sheet && sheet.payoff == null ? 'Net before loan payoff' : 'Estimated net to you'

  return (
    <div className="v3-net-calc">
      <form className="v3-net-calc__form" onSubmit={(e) => e.preventDefault()} noValidate>
        {field('price', 'Sale price', price, setPrice, { hint: 'Starts at the Bend median. Enter your own.' })}

        <div className="v3-input">
          <span className="v3-input__label">Listing fee</span>
          <span className="v3-input__hint">{`${listingPct}, Ryan Realty's listing fee`}</span>
        </div>

        <fieldset className="v3-net-calc__group">
          <legend className="v3-input__label">Buyer&apos;s agent compensation you agree to cover</legend>
          <span className="v3-input__hint" id={id('buyerAgent-hint')}>
            Negotiated in each offer. Enter what you&apos;d agree to cover, if anything.
          </span>
          <div className="v3-net-calc__toggle" role="radiogroup" aria-label="Enter as">
            {(['pct', 'usd'] as const).map((mode) => (
              <label key={mode} className="v3-net-calc__radio">
                <input
                  type="radio"
                  name="agent-mode"
                  value={mode}
                  checked={agentMode === mode}
                  onChange={() => {
                    setAgentMode(mode)
                    setAgentValue('0')
                  }}
                />
                {mode === 'pct' ? 'Percent' : 'Dollars'}
              </label>
            ))}
          </div>
          <div className="v3-input__field">
            <input
              id={id('buyerAgent')}
              aria-label={agentMode === 'pct' ? "Buyer's agent compensation, percent" : "Buyer's agent compensation, dollars"}
              className="v3-input__control"
              inputMode="decimal"
              value={agentValue}
              aria-invalid={errors.buyerAgent ? true : undefined}
              aria-describedby={described('buyerAgent', 'hint')}
              onChange={(e) => setAgentValue(e.target.value)}
            />
          </div>
          {err('buyerAgent')}
        </fieldset>

        <div className="v3-input">
          <label htmlFor={id('loans')} className="v3-input__label">
            Do you have a mortgage or HELOC?
          </label>
          <span className="v3-input__hint" id={id('loans-hint')}>
            Each loan is one recorded release.
          </span>
          <div className="v3-input__field">
            <select
              id={id('loans')}
              className="v3-input__control v3-input__control--select"
              value={loans}
              aria-describedby={described('loans', 'hint')}
              onChange={(e) => setLoans(e.target.value)}
            >
              <option value="0">No loan</option>
              <option value="1">1 loan</option>
              <option value="2">2 loans</option>
            </select>
          </div>
          {err('loans')}
        </div>

        {field(
          'pagesPerRelease',
          'Pages per release',
          pages,
          (v) => {
            setPages(v)
            setPagesTouched(true)
          },
          { hint: 'Escrow can tell you how many pages your release runs.', estimate: !pagesTouched },
        )}

        {field('payoff', 'Loan payoff amount(s)', payoff, setPayoff, { hint: "From your lender's payoff statement." })}

        {field('closingDate', 'Closing date', closingDate, setClosingDate, { type: 'date' })}

        {field('annualTax', 'Annual property tax', taxIsEstimate ? String(taxDefault) : (taxRaw ?? ''), (v) => setTaxRaw(v), {
          hint: `Enter the amount on your tax statement (DIAL). The default is an estimate at Deschutes County's ${Number((NET_SHEET_RATES.effectiveTaxRate * 100).toFixed(3))}% average effective rate.`,
          estimate: taxIsEstimate,
        })}

        <fieldset className="v3-net-calc__group">
          <legend className="v3-input__label">This year&apos;s tax bill</legend>
          {canBePaid ? null : (
            <span className="v3-input__hint">Bills go out in late October, so a closing before then hasn&apos;t paid this year&apos;s bill.</span>
          )}
          <div className="v3-net-calc__toggle">
            {(['unpaid', 'paid'] as const).map((status) => (
              <label key={status} className="v3-net-calc__radio">
                <input
                  type="radio"
                  name="tax-paid"
                  value={status}
                  checked={status === 'paid' ? paidInFull : !paidInFull}
                  disabled={status === 'paid' && !canBePaid}
                  onChange={() => setPaid(status)}
                />
                {status === 'unpaid' ? 'Not paid yet' : 'Paid in full'}
              </label>
            ))}
          </div>
        </fieldset>

        {field('hoaFees', "HOA transfer or resale fees you'll pay", hoa, setHoa, {
          hint: (
            <>
              Your association sets these. Our <Link href={NET_SHEET_LINKS.hoaGuide}>HOA guide</Link> covers what to ask for.
            </>
          ),
        })}
        {field('otherCosts', 'Credits to the buyer, repairs, other costs', other, setOther)}
      </form>

      <div className="v3-net-calc__result">
        <p className="v3-net-calc__net" aria-live="polite">
          {sheet ? (
            <>
              <span className="v3-net-calc__net-label">{netLabel}</span>
              <span className="v3-net-calc__net-value">{usd(sheet.net)}</span>
            </>
          ) : (
            <span className="v3-net-calc__net-label">Fix the highlighted fields to see your net.</span>
          )}
        </p>

        {sheet ? (
          <table className="v3-net-table">
            <caption>Your net sheet, estimated</caption>
            <thead>
              <tr>
                <th scope="col">Line</th>
                <th scope="col">Amount</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Sale price</th>
                <td>{usd(sheet.price)}</td>
                <td />
              </tr>
              <tr>
                <th scope="row">{`Listing fee (${listingPct})`}</th>
                <td>{minus(sheet.listingFee)}</td>
                <td>{NET_SHEET_ROW_SOURCES.listingFee}</td>
              </tr>
              <tr>
                <th scope="row">Buyer&apos;s agent</th>
                <td>{minus(sheet.buyerAgent)}</td>
                <td>{NET_SHEET_ROW_SOURCES.buyerAgent}</td>
              </tr>
              <tr>
                <th scope="row">Owner&apos;s title policy</th>
                <td>{minus(sheet.ownersTitlePolicy)}</td>
                <td>{NET_SHEET_ROW_SOURCES.title}</td>
              </tr>
              <tr>
                <th scope="row">Escrow (your half)</th>
                <td>{sheet.escrowIllustrative ? `${minus(sheet.escrowSeller)} (illustrative)` : minus(sheet.escrowSeller)}</td>
                <td>{sheet.price > ESCROW_CARD_MAX ? NET_SHEET_ROW_SOURCES.escrowOverCard : NET_SHEET_ROW_SOURCES.escrow}</td>
              </tr>
              <tr>
                <th scope="row">Lien search</th>
                <td>{minus(sheet.lienSearch)}</td>
                <td>{NET_SHEET_ROW_SOURCES.lienSearch}</td>
              </tr>
              <tr>
                <th scope="row">Recording (mortgage release)</th>
                <td>{minus(sheet.recording)}</td>
                <td>
                  {NET_SHEET_ROW_SOURCES.recording}
                  {pagesTouched ? null : <span className="v3-net-calc__tag"> estimate</span>}
                </td>
              </tr>
              <tr>
                <th scope="row">Transfer tax</th>
                <td>{usd(0)}</td>
                <td>{NET_SHEET_ROW_SOURCES.transferTax}</td>
              </tr>
              <tr className="v3-net-table__total">
                <th scope="row">Cost of the sale</th>
                <td>{`${minus(sheet.costOfSale)} (${pct1(sheet.costShare)})`}</td>
                <td />
              </tr>
              <tr>
                <th scope="row">{sheet.taxCredit > 0 ? 'Property tax credit' : 'Property tax, your share'}</th>
                <td>{sheet.taxCredit > 0 ? usd(sheet.taxCredit) : minus(sheet.taxDebit)}</td>
                <td>
                  {sheet.taxCredit > 0 ? NET_SHEET_ROW_SOURCES.propertyTaxCredit : NET_SHEET_ROW_SOURCES.propertyTax}
                  {taxIsEstimate ? <span className="v3-net-calc__tag"> estimate</span> : null}
                </td>
              </tr>
              <tr>
                <th scope="row">HOA fees</th>
                <td>{minus(sheet.hoaFees)}</td>
                <td />
              </tr>
              <tr>
                <th scope="row">Credits, repairs, other</th>
                <td>{minus(sheet.otherCosts)}</td>
                <td />
              </tr>
              <tr className="v3-net-table__total">
                <th scope="row">Net before loan payoff</th>
                <td>{usd(sheet.netBeforePayoff)}</td>
                <td />
              </tr>
              <tr>
                <th scope="row">Loan payoff</th>
                <td>{sheet.payoff == null ? 'Not entered' : minus(sheet.payoff)}</td>
                <td />
              </tr>
              <tr className="v3-net-table__total">
                <th scope="row">Estimated net to you</th>
                <td>{sheet.payoff == null ? `${usd(sheet.net)} before payoff` : usd(sheet.net)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        ) : null}

        <div className="v3-net-calc__actions">
          <V3Button href={NET_SHEET_LINKS.valuation} variant="primary">
            Get a written valuation with a net sheet
          </V3Button>
          <V3Button href={NET_SHEET_LINKS.contact} variant="ghost">
            Talk to Matt
          </V3Button>
        </div>
        <p className="v3-net-calc__fine">
          {`Limits: ${usd(NET_SHEET_LIMITS.priceMin)} to ${usd(NET_SHEET_LIMITS.priceMax)} sale price, 0% to ${NET_SHEET_LIMITS.buyerAgentPctMax}% buyer's agent.`}
        </p>
      </div>
    </div>
  )
}
