# System Plan

## Recommended product shape

Build a **personal investment research desk**, not a stock-picking oracle.

The system should answer four different questions:

1. **Discovery:** Which companies deserve deeper research?
2. **Understanding:** What drives this company and what can break the thesis?
3. **Portfolio fit:** Is the opportunity worth its concentration, sector, currency, and event risk?
4. **Monitoring:** Has new evidence materially weakened the original thesis?

These questions need separate stages because a promising company can still be a poor purchase at the current valuation or a poor fit for the existing portfolio.

## Architecture

### 1. Data and evidence layer

Use adapters so data providers can be changed without rewriting the agent:

- `sec-edgar`: US filings and XBRL fundamentals.
- `company-ir`: earnings releases, presentations, and transcripts.
- `market-data`: licensed price, volume, corporate-action, and FX data.
- `clinical-trials`: trial status and endpoint data.
- `fda`: approvals, labels, recalls, safety, and adverse-event datasets.
- `usgs-materials`: mineral supply, production, import dependence, and commodity context.
- `edinet-tdnet`: Japanese disclosures, only after an opt-in workflow is designed.
- `portfolio-import`: manually maintained JSON first; broker CSV import later.

Every evidence record should retain:

- source URL or filing identifier;
- publisher;
- published/filing date;
- retrieval time;
- raw excerpt or normalized fact;
- unit and currency;
- confidence and conflict status.

### 2. Research roles

Use several small roles rather than one giant prompt:

- **General analyst:** business, financial quality, valuation, catalysts.
- **Sector specialist:** biotech/health, materials, or technology-specific checks.
- **Skeptic:** strongest bear case, accounting concerns, competitive threats.
- **Risk officer:** position size, correlation, drawdown, liquidity, event and FX risk.
- **Committee:** creates the final memo without erasing disagreements.

The deterministic risk engine runs before and after these roles. The language model explains evidence; it does not get to override portfolio limits.

### 3. Decision artifacts

Produce stable files that humans and other agents can inspect:

```text
reports/
  daily/YYYY-MM-DD.md
  companies/TICKER/YYYY-MM-DD.md
  alerts/YYYY-MM-DD-HHMM-TICKER.md
  decisions/decision-journal.jsonl
```

A company memo should end in one of:

- `RESEARCH`: insufficient evidence.
- `WATCH`: good enough to monitor, not ready for portfolio review.
- `HUMAN_REVIEW`: evidence and portfolio rules permit a manual decision.
- `RISK_REVIEW`: an existing holding needs attention.
- `THESIS_BROKEN`: a predefined invalidator appears to have occurred.

### 4. Notification layer

Start with local Markdown and terminal summaries. Add email, Slack, Discord, or LINE only after alert quality is measured.

Alerts need severity and cooldowns:

- `INFO`: routine filing or catalyst update.
- `WATCH`: meaningful change, no immediate action.
- `HIGH`: concentration, event, or thesis risk requiring review.
- `CRITICAL`: severe evidence-backed change or portfolio-policy breach.

Never alert solely because a price moved. A price move can trigger investigation, but the message must identify whether fundamentals, news, liquidity, or market-wide factors explain it.

## Sector playbooks

### Biotech and health

Do not score biotech like profitable software. Track:

- trial phase, design, comparator, endpoint, enrollment, and statistical power;
- regulatory status and upcoming decision dates;
- safety signals and adverse events;
- cash runway to the next value-creating milestone;
- dilution, debt, partnerships, and milestone obligations;
- patent/exclusivity window;
- probability-weighted pipeline value;
- competing therapies and standard of care.

Pre-revenue biotech belongs in the speculative sleeve, with a much smaller position ceiling.

### Materials and critical minerals

Track:

- commodity exposure and price sensitivity;
- reserve/resource quality and jurisdiction;
- extraction/refining process and technical scalability;
- capex, operating cost curve, permitting, and ramp timeline;
- customer qualification and offtake agreements;
- supply-chain concentration and geopolitical risk;
- substitution and recycling risk;
- dilution and project-financing requirements.

A laboratory breakthrough is not the same as a manufacturable, qualified product.

### Technology and AI

Your domain knowledge is useful, but familiarity can create overconfidence. Track:

- revenue concentration and customer retention;
- gross-margin durability and inference/compute costs;
- capex and stock-based compensation;
- moat versus open-source or platform bundling;
- regulatory and export-control exposure;
- valuation sensitivity to growth deceleration.

## Beginner-safe portfolio policy

The initial policy should be intentionally boring:

- Maintain a diversified core before funding individual-stock experiments.
- Keep single-company and speculative-sector limits low.
- Do not use leverage, options, short selling, CFDs, or margin.
- Treat pre-revenue biotech and early-stage materials as speculative.
- Track JPY/USD exposure separately from company risk.
- Define thesis invalidators when entering, not after a loss.
- Review on a schedule and after material filings; avoid reacting to every headline.

The example limits in `config/investment-policy.example.json` are conservative starting assumptions, not personal financial advice. They should be adjusted only after the user defines time horizon, emergency savings, income stability, maximum tolerable drawdown, and investable capital.

## Rakuten Securities integration

### Phase 1: no direct integration

- Maintain holdings in a local private JSON file.
- Place all orders manually in Rakuten.
- Record the reason, expected holding period, and thesis invalidators in the decision journal.

### Phase 2: read-only import

- Import a user-exported holdings/transaction CSV if Rakuten provides a suitable export.
- Normalize JPY and USD values.
- Reconcile imported positions against the decision journal.

### Phase 3: supported local tools

- Investigate MarketSpeed/RSS capabilities and terms for the exact products used.
- Use only documented, permitted interfaces.
- Keep credentials outside the repository and prefer OS credential storage.

### Phase 4: guarded execution, only if explicitly requested

Even if a supported order interface exists, require:

- paper-trading validation;
- an order preview;
- explicit per-order human approval;
- price/size/slippage limits;
- duplicate-order protection;
- an emergency kill switch;
- an immutable audit log.

Unattended autonomous execution is out of scope.

## Delivery roadmap

### Milestone 1 — Personal policy and local risk monitor

- **Foundation status:** implemented with validated split inputs, normalized JPY valuation, daily Markdown reporting, stable finding IDs, and local finding state.
- Finalize risk questionnaire and policy.
- Import and reconcile a real private portfolio.
- Generate and manually review daily risk and concentration reports.
- Add a decision journal.

### Milestone 2 — US company research

- Add SEC EDGAR ingestion.
- Add a licensed market-data adapter.
- Generate cited company memos and earnings-change reports.
- Build an initial watchlist, not a buy list.

### Milestone 3 — Biotech, health, and materials intelligence

- Add ClinicalTrials.gov, FDA, and USGS adapters.
- Add catalyst calendars and cash-runway models.
- Backtest alert rules against historical events.

### Milestone 4 — Notifications and portfolio monitoring

- Schedule daily and event-driven runs.
- Add alert deduplication and cooldowns.
- Track false positives, missed events, and user decisions.

### Milestone 5 — Rakuten read-only workflow

- Add broker CSV normalization.
- Confirm product availability, fees, FX handling, and account type before surfacing an actionable idea.
- Keep order placement manual.

## Success metrics

Do not judge the agent by short-term returns alone. Track:

- percentage of material claims with primary-source citations;
- stale-data and conflicting-data blocks;
- alert precision and false-positive rate;
- maximum portfolio concentration;
- decisions that followed the written policy;
- thesis changes detected before or at the next scheduled review;
- avoided trades where evidence was incomplete.
