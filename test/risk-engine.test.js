import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePortfolio } from "../src/core/risk-engine.js";

const policy = {
  timezone: "Asia/Tokyo",
  mode: "research_only",
  humanApprovalRequired: true,
  allowLeverage: false,
  allowOptions: false,
  allowShortSelling: false,
  limits: {
    maxSinglePositionPct: 8,
    maxDiversifiedFundPct: 80,
    maxSectorPct: 25,
    maxSpeculativePct: 10,
    minimumCashPct: 5,
    maxForeignCurrencyPct: 85,
    riskGroupLimitsPct: {
      SPECULATIVE_BIOTECH: 10
    }
  },
  alerts: {
    warnDrawdownPct: 15,
    criticalDrawdownPct: 25,
    costBasisLossReviewPct: 20,
    stalePriceHours: 36,
    reviewDueSoonDays: 14,
    reviewOverdueGraceDays: 0
  }
};

test("flags concentration, critical drawdown, and speculative exposure", () => {
  const result = evaluatePortfolio(
    {
      baseCurrency: "JPY",
      cashValue: 100,
      positions: [
        {
          ticker: "BIO",
          sector: "Biotechnology",
          value: 900,
          costBasisValue: 1200,
          speculative: true,
          currency: "USD",
          riskGroups: ["SPECULATIVE_BIOTECH"],
          currentPrice: 50,
          peakPriceSinceEntry: 100,
          priceAsOf: "2026-06-18T00:00:00Z",
          nextReviewDueAt: "2026-12-31"
        }
      ]
    },
    policy,
    new Date("2026-06-18T01:00:00Z")
  );

  const codes = result.alerts.map((item) => item.code);
  assert.equal(result.status, "RISK_REVIEW");
  assert.ok(codes.includes("POSITION_CONCENTRATION"));
  assert.ok(codes.includes("SECTOR_CONCENTRATION"));
  assert.ok(codes.includes("SPECULATIVE_CONCENTRATION"));
  assert.ok(codes.includes("CRITICAL_DRAWDOWN"));
  assert.ok(codes.includes("RISK_GROUP_CONCENTRATION"));
  assert.ok(codes.includes("COST_BASIS_LOSS_REVIEW"));
});

test("blocks conclusions when prices are stale", () => {
  const result = evaluatePortfolio(
    {
      baseCurrency: "JPY",
      cashValue: 950,
      positions: [
        {
          ticker: "SMALL",
          sector: "Technology",
          value: 50,
          costBasisValue: 50,
          speculative: false,
          currency: "JPY",
          riskGroups: [],
          currentPrice: 10,
          peakPriceSinceEntry: 10,
          priceAsOf: "2026-06-01T00:00:00Z",
          nextReviewDueAt: "2026-12-31"
        }
      ]
    },
    policy,
    new Date("2026-06-18T01:00:00Z")
  );

  assert.ok(result.alerts.some((item) => item.code === "STALE_PRICE"));
});

test("uses a separate concentration limit for a diversified core fund", () => {
  const result = evaluatePortfolio(
    {
      baseCurrency: "JPY",
      cashValue: 200,
      positions: [
        {
          ticker: "CORE",
          sector: "Diversified",
          assetType: "ETF",
          value: 800,
          costBasisValue: 750,
          speculative: false,
          currency: "USD",
          riskGroups: ["DIVERSIFIED_CORE"],
          currentPrice: 10,
          peakPriceSinceEntry: 10,
          priceAsOf: "2026-06-18T00:00:00Z",
          nextReviewDueAt: "2026-12-31"
        }
      ]
    },
    policy,
    new Date("2026-06-18T01:00:00Z")
  );

  assert.ok(
    !result.alerts.some((item) => item.code === "POSITION_CONCENTRATION")
  );
  assert.ok(
    !result.alerts.some((item) => item.code === "SECTOR_CONCENTRATION")
  );
});

test("reports currency exposure and unrealized P&L", () => {
  const result = evaluatePortfolio(
    {
      baseCurrency: "JPY",
      cashValue: 500,
      positions: [
        {
          ticker: "US",
          sector: "Technology",
          assetType: "CommonStock",
          value: 500,
          costBasisValue: 400,
          speculative: false,
          currency: "USD",
          riskGroups: [],
          currentPrice: 10,
          peakPriceSinceEntry: 10,
          priceAsOf: "2026-06-18T00:00:00Z",
          nextReviewDueAt: "2026-12-31"
        }
      ]
    },
    policy,
    new Date("2026-06-18T01:00:00Z")
  );

  assert.equal(result.summary.currencyExposurePct.JPY, 50);
  assert.equal(result.summary.currencyExposurePct.USD, 50);
  assert.equal(result.summary.unrealizedPnlValue, 100);
  assert.equal(result.summary.unrealizedPnlPct, 25);
});

test("distinguishes due-soon and overdue thesis reviews", () => {
  const result = evaluatePortfolio(
    {
      baseCurrency: "JPY",
      cashValue: 900,
      positions: [
        {
          ticker: "SOON",
          sector: "Technology",
          assetType: "CommonStock",
          value: 50,
          costBasisValue: 50,
          speculative: false,
          currency: "JPY",
          riskGroups: [],
          currentPrice: 10,
          peakPriceSinceEntry: 10,
          priceAsOf: "2026-06-18T00:00:00Z",
          nextReviewDueAt: "2026-06-25"
        },
        {
          ticker: "LATE",
          sector: "Health Care",
          assetType: "CommonStock",
          value: 50,
          costBasisValue: 50,
          speculative: false,
          currency: "JPY",
          riskGroups: [],
          currentPrice: 10,
          peakPriceSinceEntry: 10,
          priceAsOf: "2026-06-18T00:00:00Z",
          nextReviewDueAt: "2026-06-01"
        }
      ]
    },
    policy,
    new Date("2026-06-18T01:00:00Z")
  );

  const byTicker = new Map(
    result.alerts.map((item) => [item.details.ticker, item.code])
  );
  assert.equal(byTicker.get("SOON"), "THESIS_REVIEW_DUE_SOON");
  assert.equal(byTicker.get("LATE"), "THESIS_REVIEW_OVERDUE");
});

test("rejects a non-positive portfolio total", () => {
  assert.throws(
    () =>
      evaluatePortfolio(
        { baseCurrency: "JPY", cashValue: 0, positions: [] },
        policy
      ),
    /positive finite number/
  );
});
