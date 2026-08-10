# EDA Findings — Central Oregon closed sales

**Date:** 2026-08-10  
**Artifacts:**  
- `EDA_MARKET_WAREHOUSE_2026-08-10.json` (feed-wide, provisional)  
- `EDA_MARKET_WAREHOUSE_CO_2024_2026-08-10.json` (**authoritative for CO product**)  

**Methodology (locked for public “Central Oregon” claims):**  
- Closed: `StandardStatus` ILIKE `%Closed%`, `ClosePrice >= 1000`, `CloseDate` set  
- Geo: `City` ∈ `CENTRAL_OREGON_CITY_SLUGS` proper-case (`lib/central-oregon.ts` / service-area)  
- 2024 office ranks: full population via Range pagination (n = count)

---

## Headline numbers

| Metric | Feed-wide | **Central Oregon service area** |
|--------|-----------|----------------------------------|
| Closed + priced (all years) | 377,073 | **192,567** |
| Closed 2024 | 12,069 | **5,707** |
| **2024 $ volume** | ~$6.52B | **~$3.93B** |
| Active (approx) | — | **3,409** |
| Median close 2024 | (polluted sample) | **$570,000** |
| Closed 1998 CO | — | **5,179** |
| Closed 2016 CO | — | **8,038** |
| Closed 2020 CO | — | **9,098** |

**Implication:** Never publish “CO market size” from unfiltered feed. Medford/etc. inflated earlier probes.

---

## 2024 CO composition (PropertyType)

| Type | n |
|------|--:|
| A | 4,850 |
| D (land-class) | 600 |
| B | 124 |
| C | 54 |
| F | 51 |
| other | small |

**Implication:** SFR-only and all-type stories both required; land is material volume of units.

---

## 2024 CO city structure ($ volume)

Bend dominates (~$2.34B / 2,709 closes), then Redmond, Prineville, Sisters, La Pine, Sunriver, Powell Butte, Terrebonne.

---

## 2024 CO list-side office share (top 5 by $)

| Office | n | $ vol | share $ | share n |
|--------|--:|------:|--------:|--------:|
| Cascade Hasson SIR | 766 | $705M | **17.9%** | 13.4% |
| Stellar Realty Northwest | 285 | $227M | 5.8% | 5.0% |
| RE/MAX Key Properties | 259 | $204M | 5.2% | 4.5% |
| Bend Premier Real Estate LLC | 183 | $161M | 4.1% | 3.2% |
| Keller Williams Realty Central Oregon | 247 | $159M | 4.0% | 4.3% |

- **Distinct list offices:** see JSON  
- **Dual office (same list/buy office string):** **20.5%**  
- **Dual agent:** **5.1%**  
- **Ryan Realty LLC (exact string):** 5 list-side closes, **~$1.28M**, **0.03%** volume share (list-side only; buy-side + aliases not yet resolved)

**Implication:** Competitive desk is immediately valuable. Entity resolution still required (Cascade Hasson SIR vs Sotheby’s variants, etc.). Ryan share needs buy-side + alias map before strategy use.

---

## Decisions locked from this EDA

1. **Default geo for all public market analytics** = service-area city allowlist.  
2. **2024 CO market size (all types, closed)** ≈ **$3.93B / 5,707** under methodology above.  
3. **Competitive list-side rankings** are publishable to **admin** with string-level offices now; **dim_office** before treating brand families as single entities.  
4. **Feed-wide $6.5B** is not a CO claim.  
5. Continue R1: buy-side office ranks, multi-year CO volume series, Ryan identity resolution.

---

*Expert executes next units without waiting for Matt confirmation.*
