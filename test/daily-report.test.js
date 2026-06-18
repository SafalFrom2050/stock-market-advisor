import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateDailyReport } from "../src/core/daily-report.js";
import { reconcileFindingState } from "../src/core/finding-state.js";
import { assemblePortfolio } from "../src/core/portfolio-assembler.js";
import { evaluatePortfolio } from "../src/core/risk-engine.js";

async function fixture(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

test("generates a readable daily report with persistent and new findings", async () => {
  const [holdings, theses, market, policy] = await Promise.all([
    fixture("data/holdings.example.json"),
    fixture("data/theses.example.json"),
    fixture("data/market-snapshot.example.json"),
    fixture("config/investment-policy.example.json")
  ]);
  const portfolio = assemblePortfolio({ holdings, theses, market, policy });
  const riskResult = evaluatePortfolio(
    portfolio,
    policy,
    new Date("2026-06-18T00:00:00Z")
  );
  const { notificationCandidates } = reconcileFindingState(
    riskResult.alerts,
    undefined,
    new Date("2026-06-18T00:00:00Z")
  );
  const report = generateDailyReport({
    portfolio,
    riskResult,
    notificationCandidates
  });

  assert.match(report, /# Daily Portfolio Risk Report/);
  assert.match(report, /## Currency exposure/);
  assert.match(report, /BIO-DEMO/);
  assert.match(report, /Notification candidates/);
  assert.match(report, /\*\*NEW ·/);
  assert.match(report, /Tax consequences are not calculated/);
});

