# cfo.ai business plan — Greenlight

Built live at cfo.ai (Ari) from the real benchmark numbers in `unit-economics.md`. Model pages: `Greenlight · Decision dashboard`, `Assumptions`, `Pricing & growth`, `Team & cash`.

## Pricing recommendation

Test **$3 per verified fix** (usage) alongside a **$79/repo/month** subscription. Don't launch with genuinely unlimited compute.

- At 10 attempts/repo/month and the real 88.9% benchmark success rate, usage billing earns **$26.67/repo/month**.
- The $79 subscription becomes cheaper for the customer above **26.33 successful fixes/month**.
- Subscription looks better financially if customers will buy it — that willingness to pay is unproven and is the real open risk, not LLM cost.

## Unit economics (modeled, not just the raw $0.0165 LLM cost)

| Metric | Value |
|---|---|
| Measured LLM cost per successful fix | $0.0165 |
| Variable delivery cost per successful fix (3x LLM buffer + failed attempts + sandbox + hosting) | $0.1682 |
| Variable delivery cost per repo/month | $1.495 |
| Contribution margin — $79 subscription | 95.1% |
| Contribution margin — $3/fix usage | 91.4% |

(Margins exclude founder pay and fixed spending — not net profit.)

## Year-one revenue (straight-line ramp from 0 to year-end repo count, Oct 2026–Sep 2027)

| Paying repos at year-end | Subscription revenue | Usage revenue | Ending subscription MRR |
|---:|---:|---:|---:|
| 50 | $25,675 | $8,667 | $3,950 |
| 200 | $102,700 | $34,667 | $15,800 |
| 1,000 | $513,500 | $173,333 | $79,000 |

## Runway (two founders, $1,500/mo each, $25,000 opening cash, $3,850/mo fixed spend)

- **No sales:** ~6.5 months of cash.
- **50-repo case:** usage pricing exhausts cash in **May 2027** (shortfall); subscription stays positive through Sep 2028 but bottoms near $3,201.
- **200-repo case:** both strategies stay positive through Sep 2028. Year-one ending cash: $76,476 (subscription) / $10,483 (usage).
- **1,000-repo case:** comfortably positive, but needs a realistic support/staffing budget before treating as a real operating plan.
- **Breakeven:** 52 repos (subscription) / 158 repos (usage).

## Honest caveats Ari flagged (kept, not edited out)

- The $0.0165 LLM figure is cost-per-fix, not cost-per-customer; the model correctly adds failed-attempt cost, sandbox runs, and hosting on top.
- Customer willingness-to-pay at either price point is unproven — this is a forecast, not validated demand.
- The 1,000-repo case needs a real support/acquisition/staffing budget to be credible.
- Recommended next refinement: real repo usage data (failures/month, test-running cost, verified-fix-to-accepted-PR rate) to decide between usage, subscription, or a hybrid.
