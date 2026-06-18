import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assemblePortfolio } from "../src/core/portfolio-assembler.js";
import {
  validateHoldings,
  ValidationError
} from "../src/core/validation.js";

async function fixture(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

async function validInputs() {
  const [holdings, theses, market, policy] = await Promise.all([
    fixture("data/holdings.example.json"),
    fixture("data/theses.example.json"),
    fixture("data/market-snapshot.example.json"),
    fixture("config/investment-policy.example.json")
  ]);
  return { holdings, theses, market, policy };
}

test("assembles validated holdings, theses, quotes, and FX", async () => {
  const portfolio = assemblePortfolio(await validInputs());

  assert.equal(portfolio.baseCurrency, "JPY");
  assert.equal(portfolio.positions.length, 2);
  assert.equal(portfolio.positions[0].value, 1200000);
  assert.equal(portfolio.positions[1].currency, "USD");
  assert.equal(portfolio.positions[1].nextReviewDueAt, "2026-06-01");
});

test("rejects an unknown safety-relevant field", async () => {
  const { holdings } = await validInputs();
  const invalid = structuredClone(holdings);
  invalid.positions[0].specualtive = false;

  assert.throws(
    () => validateHoldings(invalid),
    (error) =>
      error instanceof ValidationError &&
      error.message.includes("specualtive is not allowed")
  );
});

test("rejects negative monetary values", async () => {
  const { holdings } = await validInputs();
  const invalid = structuredClone(holdings);
  invalid.cashBaseValue = -1;

  assert.throws(
    () => validateHoldings(invalid),
    (error) =>
      error instanceof ValidationError &&
      error.message.includes("holdings.cashBaseValue")
  );
});

test("rejects an invalid reporting timezone", async () => {
  const inputs = await validInputs();
  inputs.policy.timezone = "Tokyo-ish";

  assert.throws(
    () => assemblePortfolio(inputs),
    (error) =>
      error instanceof ValidationError &&
      error.message.includes("valid IANA timezone")
  );
});

test("rejects a holding without a matching FX rate", async () => {
  const inputs = await validInputs();
  inputs.market.fxRates = [];

  assert.throws(
    () => assemblePortfolio(inputs),
    (error) =>
      error instanceof ValidationError &&
      error.message.includes("has no FX rate")
  );
});

test("rejects a missing thesis for an active holding", async () => {
  const inputs = await validInputs();
  inputs.theses.theses = inputs.theses.theses.slice(0, 1);

  assert.throws(
    () => assemblePortfolio(inputs),
    (error) =>
      error instanceof ValidationError &&
      error.message.includes("is missing a thesis")
  );
});
