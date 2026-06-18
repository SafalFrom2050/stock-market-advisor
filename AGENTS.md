# Agent Operating Contract

All coding and AI agents working in this repository must follow these rules.

## Mission

Help the user make calmer, better-evidenced investment decisions. Do not maximize trading frequency, excitement, or prediction confidence.

## Non-negotiable safety rules

- Never place, simulate placing, or prepare an executable broker order unless the user explicitly requests a later, separately reviewed integration.
- Never request or store Rakuten Securities passwords, MFA codes, cookies, account numbers, My Number data, or browser sessions.
- Never scrape an authenticated broker page.
- Treat missing, conflicting, or stale evidence as a reason to lower confidence or block action.
- Separate facts, calculations, assumptions, and opinions.
- Cite the source and publication/filing date for every material claim.
- Do not label an output `BUY` or `SELL`. Use:
  - `RESEARCH`
  - `WATCH`
  - `HUMAN_REVIEW`
  - `RISK_REVIEW`
  - `THESIS_BROKEN`
- A `THESIS_BROKEN` result is still a human review request, not an automatic trade.

## Source hierarchy

Prefer, in order:

1. Regulatory filings and government datasets.
2. Company investor-relations releases and earnings calls.
3. Exchange and broker documentation.
4. Reputable licensed financial data/news.
5. Secondary commentary.

Social posts, newsletters, and forums may suggest questions but cannot establish a material fact.

## Research requirements

Every company memo must include:

- What the company sells and who pays.
- Revenue quality, margins, cash flow, balance sheet, and dilution risk.
- Valuation assumptions and a range, not a single magic price.
- Catalysts with dates or windows.
- Three strongest counterarguments.
- Thesis invalidators.
- Data freshness and missing evidence.
- Sector-specific checklist from `prompts/`.
- Position-size ceiling from the policy file.

## Portfolio rules

- Run deterministic policy checks before LLM interpretation.
- Do not recommend adding to a position already over its policy limit.
- Never hide concentration by treating highly correlated stocks as diversified.
- Include JPY/USD currency exposure for US holdings.
- Japanese single stocks require explicit opt-in and verifiable primary-source coverage.

## Repository conventions

- Keep the core provider-neutral.
- Put provider adapters under `src/adapters/`.
- Put deterministic calculations under `src/core/`.
- Keep private holdings under ignored `data/private/`.
- Validate all external or user-maintained data before risk calculations.
- Keep ownership, thesis, and market-observation data as separate sources of truth.
- Keep deterministic findings separate from notification-delivery state.
- Add tests for every risk rule.
- Update `docs/SYSTEM_PLAN.md` when architecture or safety behavior changes.
- Update `docs/DEVELOPMENT_REPORT.md` when work materially changes the problem definition, architecture, safety boundary, data strategy, evaluation results, implementation status, or lessons learned. Do not update it for routine refactors or cosmetic changes.
