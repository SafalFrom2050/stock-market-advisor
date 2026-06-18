import test from "node:test";
import assert from "node:assert/strict";
import { scoreCandidate } from "../src/core/research-score.js";

test("hard blocks prevent candidate escalation", () => {
  const result = scoreCandidate({
    ticker: "DEMO",
    factors: {
      financialQuality: 100,
      growthDurability: 100,
      valuation: 100,
      catalystQuality: 100,
      evidenceCoverage: 100,
      risk: 0
    },
    hardBlocks: ["Missing audited filing"]
  });

  assert.equal(result.score, 100);
  assert.equal(result.status, "RESEARCH");
  assert.equal(result.experimentalBand, "HIGH");
});

test("a high experimental score cannot escalate a candidate", () => {
  const result = scoreCandidate({
    ticker: "DEMO",
    factors: {
      financialQuality: 95,
      growthDurability: 95,
      valuation: 95,
      catalystQuality: 95,
      evidenceCoverage: 95,
      risk: 5
    },
    hardBlocks: []
  });

  assert.equal(result.status, "RESEARCH");
  assert.equal(result.experimentalBand, "HIGH");
});

test("factor values are clamped to the zero-to-one-hundred range", () => {
  const result = scoreCandidate({
    ticker: "DEMO",
    factors: {
      financialQuality: 999,
      growthDurability: -20,
      valuation: 50,
      catalystQuality: 50,
      evidenceCoverage: 50,
      risk: 200
    },
    hardBlocks: []
  });

  assert.equal(result.contributions.financialQuality.raw, 100);
  assert.equal(result.contributions.growthDurability.raw, 0);
  assert.equal(result.contributions.risk.raw, 100);
});

