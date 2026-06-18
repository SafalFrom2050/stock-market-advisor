# Stock Market Advisor: Living Software Development Report

**Status:** Living engineering paper  
**Project stage:** Foundation / pre-production  
**Survey snapshot:** June 18, 2026  
**Primary user context:** Beginner investor living in Japan, using Rakuten Securities, knowledgeable in technology and AI, and seeking stronger support in biotechnology, health, and materials.

## Abstract

This project explores how coding agents such as Codex, Claude Code, Gemini CLI, and similar agent development kits can support personal public-market research without becoming an unsafe autonomous trading system.

The working hypothesis is that a useful investment agent should not attempt to predict every price movement. It should instead combine:

- deterministic portfolio-risk calculations;
- current, traceable evidence from primary sources;
- sector-specific research methods;
- adversarial review of investment theses;
- persistent decision and alert records;
- explicit human approval before any financial action.

The first implementation establishes a provider-neutral Node.js foundation with inspectable risk rules, candidate scoring, portable agent instructions, and specialist research prompts. The next stage is to add current data ingestion, evidence storage, thesis monitoring, and reliable notifications while keeping broker execution outside the automated loop.

## 1. Problem being solved

The project addresses five connected problems.

### 1.1 Information overload

Public companies continuously produce filings, earnings releases, clinical-trial updates, regulatory decisions, operational announcements, and price movements. A beginner cannot reasonably monitor all relevant information manually.

### 1.2 Uneven domain knowledge

Technology and AI businesses may be familiar to the user, while biotechnology, health, materials, mining, and manufacturing require different analytical models. A generic stock-scoring prompt can hide important sector-specific risks.

### 1.3 Narrative-driven decisions

LLMs are fluent enough to make weak evidence sound convincing. Investment research needs explicit separation between verified facts, market consensus, derived inference, and unverified hypotheses.

### 1.4 Portfolio risk is different from company quality

A good company may still be:

- too expensive;
- too concentrated in the portfolio;
- highly correlated with existing holdings;
- exposed to an upcoming binary event;
- unsuitable for the user's current risk capacity.

Company analysis and portfolio-fit analysis therefore need separate stages.

### 1.5 Alerts can create harmful urgency

Naive systems often turn price movement into immediate `BUY` or `SELL` language. This project treats price changes as investigation triggers. A severe alert requests human review and shows the evidence; it does not execute or demand a trade.

## 2. Research questions

The project is being developed around these questions:

1. Which investment tasks should remain deterministic rather than LLM-driven?
2. How can the system prove the freshness and provenance of material claims?
3. How should research methods change across technology, biotechnology, health, and materials?
4. Which events genuinely weaken an investment thesis, as opposed to merely moving the price?
5. How can alerts remain useful without creating noise or panic?
6. How can the same project work in Codex, Claude Code, Gemini CLI, and other agent runtimes?
7. How should the system measure usefulness without pretending short-term returns prove analytical quality?

## 3. Scope and non-goals

### In scope

- US-listed stock and ETF research.
- Private portfolio monitoring in JPY and USD.
- Regulatory filings, company disclosures, market data, and sector datasets.
- Company memos, watchlists, catalyst calendars, thesis reviews, and risk alerts.
- Read-only Rakuten Securities imports when a safe supported path is available.
- Human-reviewed decision support.

### Out of scope

- Unattended broker orders.
- Handling Rakuten login credentials, MFA codes, or authenticated browser sessions.
- High-frequency trading.
- Leverage, short selling, options, CFDs, or margin in the beginner workflow.
- Treating LLM confidence as a probability of future returns.
- Promising that the system can identify every profitable stock or market decline.

## 4. Similar-system survey

The survey focused on repositories with inspectable implementation or methodology rather than promotional articles.

| System | Useful pattern | Limitation or risk | Lesson adopted here |
|---|---|---|---|
| [TradingAgents](https://github.com/TauricResearch/TradingAgents) | Specialized analysts, bull/bear debate, risk roles, structured output, checkpoints, persistent decision memory | LLM outputs remain non-deterministic; simulated trading orientation is more aggressive than this project needs | Preserve disagreement, checkpoints, and decision history; avoid making debate the final safety mechanism |
| [AI Hedge Fund](https://github.com/virattt/ai-hedge-fund) | Deterministic volatility and correlation limits constrain an LLM portfolio manager | Many investor personas can increase cost without adding independent evidence | Keep deterministic limits, but use a smaller evidence-oriented research committee |
| [XVARY Stock Research](https://github.com/xvary-research/claude-code-stock-analysis-skill) | SEC-backed facts, data-quality gates, evidence-gap analysis, adversarial challenge, and thesis kill criteria | Primarily an analysis workflow rather than a complete private portfolio monitor | Add evidence gates and machine-readable thesis invalidators |
| [Investor Harness](https://github.com/joansongjr/investor-harness) | Cross-agent prompt stack, evidence labels, explicit unknowns, fixed archives, checkpoints, and acceptance checks | Prompt instructions alone cannot enforce all numerical or safety constraints | Add evidence classes and completion checks, enforced by code where possible |
| [Claude Investment Skills](https://github.com/ssurmic/claude-investment-skills) | Deterministic cron jobs, idempotent alerts, append-only history, and Telegram delivery | Unofficial data dependencies and public alert state can create reliability and privacy problems | Separate continuous monitoring from LLM analysis; keep holdings and alert thresholds private |
| [OpenBB](https://github.com/OpenBB-finance/OpenBB) | Typed provider adapters that expose data to Python, REST, dashboards, and MCP clients | A large dependency for a small personal project; license and operational complexity require review | Use its “connect once, consume everywhere” idea in a smaller provider-neutral adapter layer |
| [FinRobot](https://github.com/AI4Finance-Foundation/FinRobot) | Financial calculations, specialized agents, valuation workflows, and professional reports | Heavy setup and multiple paid API dependencies | Keep report generation modular and put calculations before interpretation |
| [InvestSkill](https://github.com/yennanliu/InvestSkill) | Portable prompt frameworks and cross-platform packaging with automated tests | Prompt-only analysis depends heavily on the quality of supplied data | Maintain Codex, Claude, and Gemini entry points backed by shared code and schemas |

The most important result of this survey is architectural: **continuous monitoring should be deterministic and inexpensive; LLM research should be invoked selectively when a material event or user question justifies it.**

## 5. Proposed system

```text
Market, filing, regulatory, and sector sources
                      |
               Provider adapters
                      |
          Normalized evidence records
                      |
       Deterministic monitors and risk rules
                      |
             Material-change trigger
                      |
    Analyst + sector specialist + skeptical review
                      |
          Evidence and portfolio policy gate
                      |
         Report / watch item / risk alert
                      |
              Human decision in Rakuten
```

### 5.1 Deterministic layer

This layer should calculate or enforce:

- position and sector weights;
- cash allocation;
- drawdowns and volatility;
- correlated exposures;
- speculative exposure;
- stale-data checks;
- filing and event detection;
- alert deduplication and cooldowns;
- position ceilings and prohibited products.

The LLM may explain these outputs but cannot override them.

### 5.2 Evidence layer

Each material evidence record should eventually contain:

```json
{
  "subject": "DEMO",
  "claim": "Cash and equivalents declined during the quarter.",
  "evidenceClass": "REGULATORY_FILING",
  "source": "SEC 10-Q",
  "sourceUrl": "https://www.sec.gov/...",
  "publishedAt": "2026-05-01T00:00:00Z",
  "retrievedAt": "2026-05-01T01:00:00Z",
  "value": 420000000,
  "unit": "USD",
  "confidence": "HIGH",
  "conflictStatus": "NONE"
}
```

Planned evidence classes:

- `REGULATORY_FILING`
- `COMPANY_DISCLOSURE`
- `GOVERNMENT_DATA`
- `LICENSED_MARKET_DATA`
- `MARKET_CONSENSUS`
- `DERIVED_INFERENCE`
- `UNVERIFIED_HYPOTHESIS`

An unverified hypothesis must never be sufficient for a high-severity portfolio alert.

### 5.3 Research committee

The proposed committee is intentionally small:

- **General analyst:** business, financials, valuation, and catalysts.
- **Sector specialist:** domain-specific scientific, regulatory, or industrial analysis.
- **Skeptic:** strongest counterarguments and evidence conflicts.
- **Risk officer:** portfolio fit, event risk, liquidity, concentration, and FX.

Unlike persona-heavy systems, each role has a distinct information responsibility.

### 5.4 Thesis lifecycle

Each holding should have a written thesis with:

- entry rationale;
- expected holding horizon;
- key value drivers;
- catalysts and review dates;
- assumptions;
- missing evidence;
- explicit kill criteria.

Example:

```json
{
  "ticker": "BIO-DEMO",
  "killCriteria": [
    "primary endpoint failure",
    "material safety signal",
    "cash runway below 12 months before the next catalyst",
    "unexpected financing that changes the per-share valuation"
  ]
}
```

A kill criterion becoming true produces `THESIS_BROKEN`, which still means human review rather than automatic sale.

## 6. Implementation progress

### Completed foundation

- Provider-neutral Node.js CLI.
- Strict validators for policy, holdings, theses, and market snapshots.
- Separate sources of truth for ownership, research state, and market observations.
- JPY portfolio normalization using explicit native prices and FX rates.
- Deterministic portfolio risk engine.
- Separate concentration limits for single securities and diversified funds.
- Explicit economic risk-group concentration limits.
- Drawdown investigation thresholds.
- Cost-basis P&L context without tax conclusions.
- Stale-price, due-soon, and overdue-thesis checks.
- Stable finding IDs and state reconciliation for new, reopened, escalated, and resolved findings.
- Private daily Markdown report generation.
- PowerShell entry point suitable for later Windows Task Scheduler use.
- Speculative-exposure and cash-reserve checks.
- Experimental candidate scoring demoted so it cannot escalate beyond `RESEARCH`.
- Conservative example investment policy.
- Specialist prompts for general equities, biotech/health, materials, and risk.
- Shared operating contract for Codex and other agents.
- Claude Code and Gemini/Antigravity entry files.
- Automated tests for validation, assembly, risk, finding state, reporting, CLI behavior, and scoring.

### Current validation

At the time of this report:

- 20 automated tests pass.
- Missing or stale price data blocks actionable conclusions.
- High numerical research scores cannot escalate candidates while inputs remain manually assigned.
- A diversified core fund is not incorrectly treated as equivalent to one concentrated company position.
- Unknown safety-relevant fields, negative values, missing FX, and unmatched theses are rejected.
- Persistent findings remain in the daily report but do not become repeated notification candidates.

### Not yet implemented

- Live or delayed market-data adapter.
- SEC EDGAR ingestion.
- Evidence store and citation validator.
- Private real-portfolio import.
- Decision journal.
- Automated kill-criterion evaluation.
- Registered scheduled job.
- Notification cooldown controls and email/Telegram delivery.
- Biotech FDA/ClinicalTrials.gov adapters.
- Materials and critical-minerals datasets.
- Rakuten CSV normalization.

## 7. Problems encountered and lessons learned

### 7.1 “Real-time” is not one product

Free quotes, delayed quotes, exchange-entitled real-time data, broker display data, and WebSocket feeds have different licensing and freshness. The system must record quote provenance and timestamp rather than merely storing a price.

**Decision:** Treat data freshness as part of the data model and block actions when the source does not satisfy the policy.

### 7.2 LLM API access is separate from coding-agent access

A user can interact with Codex or Claude Code without possessing an API key usable by unattended scripts.

**Decision:** Core monitoring must work without an LLM. Automated interpretation becomes an optional adapter using an API model or a locally hosted model.

### 7.3 Price decline is not a sell thesis

The first risk prototype intentionally flags drawdown as an investigation threshold. It does not infer that a lower price means a broken business.

**Decision:** Combine price triggers with thesis evidence, market context, and event checks before raising `THESIS_BROKEN`.

### 7.4 Asset type changes concentration meaning

The first sample run treated a diversified ETF like a concentrated single stock. That was mathematically consistent but economically wrong.

**Decision:** Risk rules must use exposure semantics—not ticker count alone. Funds, individual companies, sectors, factors, and currencies require different limits.

### 7.5 More agents do not automatically produce better analysis

Comparable projects often use many investor personas. Their conclusions may be correlated because they consume the same underlying data and model.

**Decision:** Add a new role only when it has distinct evidence, a distinct method, or authority to enforce a specific gate.

### 7.6 Alert infrastructure and research intelligence are separate

GitHub Actions, Windows Task Scheduler, email, and Telegram can check thresholds without an LLM. LLM calls should occur only after a trigger or during a scheduled report.

**Decision:** Design alert delivery as a replaceable infrastructure adapter, independent from research reasoning.

### 7.7 Ownership and observations need separate sources of truth

The original portfolio example mixed quantities, cost basis, current prices, price timestamps, and thesis-review dates in one object. That made manual ownership data vulnerable to being rewritten by future market refreshes and prevented clean JPY/USD reconciliation.

**Decision:** Store holdings, theses, and market snapshots independently, then assemble a validated normalized portfolio in memory before running deterministic checks.

### 7.8 Persistent findings are not repeated notifications

A concentration breach should remain visible until resolved, but sending the same push alert every day creates alert fatigue.

**Decision:** Keep the risk engine stateless and retain unresolved findings in every daily report. Use a separate state layer to identify only new, reopened, or escalated findings as notification candidates.

## 8. Evaluation strategy

Investment returns alone are a weak development metric because they mix system quality with market luck and time horizon.

The project should track:

### Data quality

- Percentage of material claims with primary-source citations.
- Missing, stale, or conflicting evidence detected.
- Data-provider failures and fallback frequency.

### Risk quality

- Policy breaches identified.
- False-positive and missed-risk events.
- Alert precision by severity.
- Time from material filing/event to notification.

### Research quality

- Whether bear cases materially differ from the main thesis.
- Whether kill criteria are measurable.
- Whether later evidence confirms or weakens the original thesis.
- Frequency of unsupported numerical claims.

### Operational quality

- Job reliability.
- Duplicate-alert rate.
- Mean cost per monitored ticker and analyzed event.
- Recovery from interrupted runs.
- Portability across supported agent runtimes.

### Decision quality

- Whether the user followed the written policy.
- Whether the decision journal captured the reason and uncertainty.
- Whether hindsight reviews identify process improvements rather than simply rewarding profitable outcomes.

## 9. Near-term development plan

### Iteration 1: personal policy and private state

- Complete a risk-capacity questionnaire.
- Reconcile the validated private holdings, thesis, and market schemas against real Rakuten data.
- Add a decision journal.
- Review the local daily risk report manually until its outputs are trusted.

### Iteration 2: trusted US-market evidence

- Add SEC submissions and XBRL adapters.
- Add a market-data interface with explicit freshness metadata.
- Store normalized evidence locally.
- Generate a cited company-change report.

### Iteration 3: thesis monitoring and alerts

- Add measurable kill criteria.
- Add idempotent alert state and append-only delivery history.
- Implement email or Telegram delivery.
- Add scheduled monitoring without LLM dependency.

### Iteration 4: selective LLM investigation

- Invoke the research committee only for material events or explicit user requests.
- Validate structured outputs.
- Preserve disagreement and missing evidence.
- Measure analysis cost and usefulness.

### Iteration 5: specialist datasets

- Add ClinicalTrials.gov and FDA event monitoring.
- Add cash-runway and dilution analysis.
- Add USGS and materials supply-chain data.
- Backtest specialist alert rules against known historical events.

## 10. Living-report protocol

This report should be updated when a change affects one or more of:

- the problem definition;
- system architecture;
- safety boundary;
- data-source strategy;
- risk methodology;
- material implementation status;
- evaluation results;
- a lesson learned from a real failure or experiment.

Routine refactors and cosmetic changes do not require a report update.

For each meaningful update:

1. Update the affected section rather than appending a diary entry.
2. Add one short row to the revision log.
3. Link the relevant implementation, test, issue, or external source.
4. State whether the evidence is measured, observed, inferred, or planned.
5. Preserve failed approaches and why they were rejected when the lesson may prevent repetition.

## 11. Revision log

| Date | Revision | Evidence |
|---|---|---|
| 2026-06-18 | Delivered the first validated daily-report vertical slice with split private inputs, FX normalization, risk-group exposure, P&L context, finding state, timezone-safe reporting, and CLI integration | 20 passing tests and generated Markdown report with deduplicated notification candidates |
| 2026-06-18 | Established the project problem, safety boundary, comparative-system survey, first architecture, implementation baseline, and evaluation plan | Initial repository scaffold, 4 passing tests, and linked project survey |

## References

### Comparable systems

- [TradingAgents repository](https://github.com/TauricResearch/TradingAgents)
- [TradingAgents paper](https://arxiv.org/abs/2412.20138)
- [AI Hedge Fund](https://github.com/virattt/ai-hedge-fund)
- [XVARY Stock Research](https://github.com/xvary-research/claude-code-stock-analysis-skill)
- [Investor Harness](https://github.com/joansongjr/investor-harness)
- [Claude Investment Skills](https://github.com/ssurmic/claude-investment-skills)
- [OpenBB](https://github.com/OpenBB-finance/OpenBB)
- [FinRobot repository](https://github.com/AI4Finance-Foundation/FinRobot)
- [FinRobot paper](https://arxiv.org/abs/2405.14767)
- [InvestSkill](https://github.com/yennanliu/InvestSkill)

### Primary data and regulatory sources planned for this project

- [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [ClinicalTrials.gov API](https://clinicaltrials.gov/data-api/about-api)
- [openFDA APIs](https://open.fda.gov/apis/)
- [USGS Mineral Commodity Summaries](https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries)
- [Japan FSA NISA information](https://www.fsa.go.jp/policy/nisa2/know/index.html)
- [Rakuten Securities US stocks](https://www.rakuten-sec.co.jp/web/us/stock/)
