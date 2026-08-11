# Conversion baseline — Public Site UX Overhaul

Define and capture **before** redesign so “better” is measurable.

## Primary events (track these)

| Intent | Event | Success definition |
|---|---|---|
| Seller | Valuation form start | Address (or step 1) submitted |
| Seller | Valuation form complete | CMA/valuation request fully submitted to CRM |
| Buyer | Alert subscribe | Listing alert / saved search email captured |
| Buyer | Tour / contact intent | Schedule tour, text, call, or contact with buying inquiry |
| Brokerage | Contact | Contact form or explicit “work with broker” |

## Sources (dual-source policy)

1. **First-party** — `visitor_sessions` / engagement events / form handlers  
2. **CRM** — FUB or internal lead rows by `sourceUrl` / registration source  
3. **GSC** — landing page demand (not conversion)  

GA4 supplementary until trusted.

## Baseline capture (run at end of P0 / start of P1)

- [ ] 14-day and 30-day counts for each primary event  
- [ ] Top landing paths for those events  
- [ ] Speed-to-lead (valuation / web lead → first broker touch) if available  
- [ ] Snapshot date + query notes recorded under `conversion/snapshots/`  

Until numbers are filled, redesign still proceeds on UX litmus; conversion proof required before claiming program success.
