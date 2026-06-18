const CURRENCIES = new Set(["JPY", "USD"]);
const ASSET_TYPES = new Set(["CommonStock", "ETF"]);
const MARKETS = new Set(["US", "JP"]);

export class ValidationError extends Error {
  constructor(issues) {
    super(`Validation failed:\n- ${issues.join("\n- ")}`);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function checkObject(value, path, issues) {
  if (!isObject(value)) {
    issues.push(`${path} must be an object`);
    return false;
  }
  return true;
}

function checkKeys(value, allowed, required, path, issues) {
  if (!checkObject(value, path, issues)) {
    return;
  }

  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      issues.push(`${path}.${key} is not allowed`);
    }
  }

  for (const key of required) {
    if (!(key in value)) {
      issues.push(`${path}.${key} is required`);
    }
  }
}

function checkString(value, path, issues, { nonEmpty = true } = {}) {
  if (typeof value !== "string" || (nonEmpty && value.trim() === "")) {
    issues.push(`${path} must be ${nonEmpty ? "a non-empty" : "a"} string`);
  }
}

function checkBoolean(value, path, issues) {
  if (typeof value !== "boolean") {
    issues.push(`${path} must be a boolean`);
  }
}

function checkNumber(
  value,
  path,
  issues,
  { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(`${path} must be a finite number`);
    return;
  }
  if (value < min || value > max) {
    issues.push(`${path} must be between ${min} and ${max}`);
  }
}

function checkInteger(value, path, issues, options = {}) {
  checkNumber(value, path, issues, options);
  if (typeof value === "number" && !Number.isInteger(value)) {
    issues.push(`${path} must be an integer`);
  }
}

function checkIsoDateTime(value, path, issues) {
  checkString(value, path, issues);
  if (
    typeof value === "string" &&
    (Number.isNaN(new Date(value).getTime()) || !value.includes("T"))
  ) {
    issues.push(`${path} must be a valid ISO date-time`);
  }
}

function checkIsoDate(value, path, issues) {
  checkString(value, path, issues);
  if (
    typeof value === "string" &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()))
  ) {
    issues.push(`${path} must be a valid YYYY-MM-DD date`);
  }
}

function checkEnum(value, allowed, path, issues) {
  if (!allowed.has(value)) {
    issues.push(`${path} must be one of: ${[...allowed].join(", ")}`);
  }
}

function checkStringArray(value, path, issues, { allowEmpty = true } = {}) {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array`);
    return;
  }
  if (!allowEmpty && value.length === 0) {
    issues.push(`${path} must not be empty`);
  }
  value.forEach((item, index) =>
    checkString(item, `${path}[${index}]`, issues)
  );
  if (new Set(value).size !== value.length) {
    issues.push(`${path} must not contain duplicates`);
  }
}

function throwIfIssues(issues) {
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
}

export function validatePolicy(policy) {
  const issues = [];
  if (!isObject(policy)) {
    throw new ValidationError(["policy must be an object"]);
  }
  checkKeys(
    policy,
    [
      "version",
      "baseCurrency",
      "timezone",
      "mode",
      "humanApprovalRequired",
      "allowLeverage",
      "allowOptions",
      "allowShortSelling",
      "japanSingleStocks",
      "limits",
      "alerts"
    ],
    [
      "version",
      "baseCurrency",
      "timezone",
      "mode",
      "humanApprovalRequired",
      "allowLeverage",
      "allowOptions",
      "allowShortSelling",
      "japanSingleStocks",
      "limits",
      "alerts"
    ],
    "policy",
    issues
  );

  checkInteger(policy.version, "policy.version", issues, { min: 1 });
  checkEnum(policy.baseCurrency, CURRENCIES, "policy.baseCurrency", issues);
  checkString(policy.timezone, "policy.timezone", issues);
  if (typeof policy.timezone === "string") {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: policy.timezone }).format();
    } catch {
      issues.push("policy.timezone must be a valid IANA timezone");
    }
  }
  if (policy.mode !== "research_only") {
    issues.push('policy.mode must be "research_only"');
  }
  checkBoolean(
    policy.humanApprovalRequired,
    "policy.humanApprovalRequired",
    issues
  );
  checkBoolean(policy.allowLeverage, "policy.allowLeverage", issues);
  checkBoolean(policy.allowOptions, "policy.allowOptions", issues);
  checkBoolean(
    policy.allowShortSelling,
    "policy.allowShortSelling",
    issues
  );
  if (!["opt_in", "disabled"].includes(policy.japanSingleStocks)) {
    issues.push('policy.japanSingleStocks must be "opt_in" or "disabled"');
  }

  checkKeys(
    policy.limits,
    [
      "maxSinglePositionPct",
      "maxDiversifiedFundPct",
      "maxSectorPct",
      "maxSpeculativePct",
      "minimumCashPct",
      "maxForeignCurrencyPct",
      "riskGroupLimitsPct"
    ],
    [
      "maxSinglePositionPct",
      "maxDiversifiedFundPct",
      "maxSectorPct",
      "maxSpeculativePct",
      "minimumCashPct",
      "maxForeignCurrencyPct",
      "riskGroupLimitsPct"
    ],
    "policy.limits",
    issues
  );

  for (const key of [
    "maxSinglePositionPct",
    "maxDiversifiedFundPct",
    "maxSectorPct",
    "maxSpeculativePct",
    "minimumCashPct",
    "maxForeignCurrencyPct"
  ]) {
    checkNumber(policy.limits?.[key], `policy.limits.${key}`, issues, {
      min: 0,
      max: 100
    });
  }

  if (isObject(policy.limits?.riskGroupLimitsPct)) {
    for (const [group, limit] of Object.entries(
      policy.limits.riskGroupLimitsPct
    )) {
      checkString(group, "policy.limits.riskGroupLimitsPct key", issues);
      checkNumber(
        limit,
        `policy.limits.riskGroupLimitsPct.${group}`,
        issues,
        { min: 0, max: 100 }
      );
    }
  } else {
    issues.push("policy.limits.riskGroupLimitsPct must be an object");
  }

  if (
    Number.isFinite(policy.limits?.maxSinglePositionPct) &&
    Number.isFinite(policy.limits?.maxDiversifiedFundPct) &&
    policy.limits.maxSinglePositionPct > policy.limits.maxDiversifiedFundPct
  ) {
    issues.push(
      "policy.limits.maxSinglePositionPct must not exceed maxDiversifiedFundPct"
    );
  }

  checkKeys(
    policy.alerts,
    [
      "warnDrawdownPct",
      "criticalDrawdownPct",
      "costBasisLossReviewPct",
      "stalePriceHours",
      "reviewDueSoonDays",
      "reviewOverdueGraceDays"
    ],
    [
      "warnDrawdownPct",
      "criticalDrawdownPct",
      "costBasisLossReviewPct",
      "stalePriceHours",
      "reviewDueSoonDays",
      "reviewOverdueGraceDays"
    ],
    "policy.alerts",
    issues
  );

  for (const key of [
    "warnDrawdownPct",
    "criticalDrawdownPct",
    "costBasisLossReviewPct"
  ]) {
    checkNumber(policy.alerts?.[key], `policy.alerts.${key}`, issues, {
      min: 0,
      max: 100
    });
  }
  checkNumber(
    policy.alerts?.stalePriceHours,
    "policy.alerts.stalePriceHours",
    issues,
    { min: 1 }
  );
  checkInteger(
    policy.alerts?.reviewDueSoonDays,
    "policy.alerts.reviewDueSoonDays",
    issues,
    { min: 0 }
  );
  checkInteger(
    policy.alerts?.reviewOverdueGraceDays,
    "policy.alerts.reviewOverdueGraceDays",
    issues,
    { min: 0 }
  );

  if (
    Number.isFinite(policy.alerts?.warnDrawdownPct) &&
    Number.isFinite(policy.alerts?.criticalDrawdownPct) &&
    policy.alerts.warnDrawdownPct >= policy.alerts.criticalDrawdownPct
  ) {
    issues.push(
      "policy.alerts.warnDrawdownPct must be less than criticalDrawdownPct"
    );
  }

  throwIfIssues(issues);
  return policy;
}

export function validateHoldings(holdings) {
  const issues = [];
  if (!isObject(holdings)) {
    throw new ValidationError(["holdings must be an object"]);
  }
  checkKeys(
    holdings,
    ["version", "asOf", "baseCurrency", "cashBaseValue", "positions"],
    ["version", "asOf", "baseCurrency", "cashBaseValue", "positions"],
    "holdings",
    issues
  );
  checkInteger(holdings.version, "holdings.version", issues, { min: 1 });
  checkIsoDateTime(holdings.asOf, "holdings.asOf", issues);
  checkEnum(
    holdings.baseCurrency,
    CURRENCIES,
    "holdings.baseCurrency",
    issues
  );
  checkNumber(holdings.cashBaseValue, "holdings.cashBaseValue", issues, {
    min: 0
  });

  if (!Array.isArray(holdings.positions)) {
    issues.push("holdings.positions must be an array");
  } else {
    const ids = new Set();
    holdings.positions.forEach((position, index) => {
      const path = `holdings.positions[${index}]`;
      checkKeys(
        position,
        [
          "id",
          "ticker",
          "name",
          "market",
          "sector",
          "assetType",
          "quantity",
          "instrumentCurrency",
          "costBasisBase",
          "speculative",
          "riskGroups"
        ],
        [
          "id",
          "ticker",
          "name",
          "market",
          "sector",
          "assetType",
          "quantity",
          "instrumentCurrency",
          "costBasisBase",
          "speculative",
          "riskGroups"
        ],
        path,
        issues
      );
      checkString(position.id, `${path}.id`, issues);
      checkString(position.ticker, `${path}.ticker`, issues);
      checkString(position.name, `${path}.name`, issues);
      checkEnum(position.market, MARKETS, `${path}.market`, issues);
      checkString(position.sector, `${path}.sector`, issues);
      checkEnum(
        position.assetType,
        ASSET_TYPES,
        `${path}.assetType`,
        issues
      );
      checkNumber(position.quantity, `${path}.quantity`, issues, { min: 0 });
      if (position.quantity === 0) {
        issues.push(`${path}.quantity must be greater than 0`);
      }
      checkEnum(
        position.instrumentCurrency,
        CURRENCIES,
        `${path}.instrumentCurrency`,
        issues
      );
      checkNumber(position.costBasisBase, `${path}.costBasisBase`, issues, {
        min: 0
      });
      checkBoolean(position.speculative, `${path}.speculative`, issues);
      checkStringArray(position.riskGroups, `${path}.riskGroups`, issues);

      if (ids.has(position.id)) {
        issues.push(`${path}.id duplicates ${position.id}`);
      }
      ids.add(position.id);
    });
  }

  if (
    typeof holdings.cashBaseValue === "number" &&
    holdings.cashBaseValue === 0 &&
    Array.isArray(holdings.positions) &&
    holdings.positions.length === 0
  ) {
    issues.push("holdings must contain cash or at least one position");
  }

  throwIfIssues(issues);
  return holdings;
}

export function validateTheses(theses) {
  const issues = [];
  if (!isObject(theses)) {
    throw new ValidationError(["theses must be an object"]);
  }
  checkKeys(
    theses,
    ["version", "asOf", "theses"],
    ["version", "asOf", "theses"],
    "theses",
    issues
  );
  checkInteger(theses.version, "theses.version", issues, { min: 1 });
  checkIsoDateTime(theses.asOf, "theses.asOf", issues);

  if (!Array.isArray(theses.theses)) {
    issues.push("theses.theses must be an array");
  } else {
    const ids = new Set();
    theses.theses.forEach((thesis, index) => {
      const path = `theses.theses[${index}]`;
      checkKeys(
        thesis,
        [
          "positionId",
          "ticker",
          "status",
          "summary",
          "lastReviewedAt",
          "nextReviewDueAt",
          "killCriteria"
        ],
        [
          "positionId",
          "ticker",
          "status",
          "summary",
          "lastReviewedAt",
          "nextReviewDueAt",
          "killCriteria"
        ],
        path,
        issues
      );
      checkString(thesis.positionId, `${path}.positionId`, issues);
      checkString(thesis.ticker, `${path}.ticker`, issues);
      if (!["ACTIVE", "WATCH", "BROKEN"].includes(thesis.status)) {
        issues.push(`${path}.status must be ACTIVE, WATCH, or BROKEN`);
      }
      checkString(thesis.summary, `${path}.summary`, issues);
      checkIsoDate(thesis.lastReviewedAt, `${path}.lastReviewedAt`, issues);
      checkIsoDate(thesis.nextReviewDueAt, `${path}.nextReviewDueAt`, issues);
      checkStringArray(thesis.killCriteria, `${path}.killCriteria`, issues, {
        allowEmpty: false
      });

      if (
        typeof thesis.lastReviewedAt === "string" &&
        typeof thesis.nextReviewDueAt === "string" &&
        thesis.lastReviewedAt > thesis.nextReviewDueAt
      ) {
        issues.push(
          `${path}.nextReviewDueAt must not be before lastReviewedAt`
        );
      }

      if (ids.has(thesis.positionId)) {
        issues.push(`${path}.positionId duplicates ${thesis.positionId}`);
      }
      ids.add(thesis.positionId);
    });
  }

  throwIfIssues(issues);
  return theses;
}

export function validateMarketSnapshot(snapshot) {
  const issues = [];
  if (!isObject(snapshot)) {
    throw new ValidationError(["market must be an object"]);
  }
  checkKeys(
    snapshot,
    ["version", "asOf", "baseCurrency", "fxRates", "quotes"],
    ["version", "asOf", "baseCurrency", "fxRates", "quotes"],
    "market",
    issues
  );
  checkInteger(snapshot.version, "market.version", issues, { min: 1 });
  checkIsoDateTime(snapshot.asOf, "market.asOf", issues);
  checkEnum(
    snapshot.baseCurrency,
    CURRENCIES,
    "market.baseCurrency",
    issues
  );

  if (!Array.isArray(snapshot.fxRates)) {
    issues.push("market.fxRates must be an array");
  } else {
    const pairs = new Set();
    snapshot.fxRates.forEach((rate, index) => {
      const path = `market.fxRates[${index}]`;
      checkKeys(
        rate,
        ["pair", "rate", "observedAt", "source"],
        ["pair", "rate", "observedAt", "source"],
        path,
        issues
      );
      checkString(rate.pair, `${path}.pair`, issues);
      checkNumber(rate.rate, `${path}.rate`, issues, { min: 0 });
      if (rate.rate === 0) {
        issues.push(`${path}.rate must be greater than 0`);
      }
      checkIsoDateTime(rate.observedAt, `${path}.observedAt`, issues);
      checkString(rate.source, `${path}.source`, issues);
      if (pairs.has(rate.pair)) {
        issues.push(`${path}.pair duplicates ${rate.pair}`);
      }
      pairs.add(rate.pair);
    });
  }

  if (!Array.isArray(snapshot.quotes)) {
    issues.push("market.quotes must be an array");
  } else {
    const ids = new Set();
    snapshot.quotes.forEach((quote, index) => {
      const path = `market.quotes[${index}]`;
      checkKeys(
        quote,
        [
          "positionId",
          "ticker",
          "currency",
          "currentPrice",
          "peakPriceSinceEntry",
          "observedAt",
          "source"
        ],
        [
          "positionId",
          "ticker",
          "currency",
          "currentPrice",
          "peakPriceSinceEntry",
          "observedAt",
          "source"
        ],
        path,
        issues
      );
      checkString(quote.positionId, `${path}.positionId`, issues);
      checkString(quote.ticker, `${path}.ticker`, issues);
      checkEnum(quote.currency, CURRENCIES, `${path}.currency`, issues);
      checkNumber(quote.currentPrice, `${path}.currentPrice`, issues, {
        min: 0
      });
      if (quote.currentPrice === 0) {
        issues.push(`${path}.currentPrice must be greater than 0`);
      }
      checkNumber(
        quote.peakPriceSinceEntry,
        `${path}.peakPriceSinceEntry`,
        issues,
        { min: 0 }
      );
      if (quote.peakPriceSinceEntry < quote.currentPrice) {
        issues.push(
          `${path}.peakPriceSinceEntry must not be below currentPrice`
        );
      }
      checkIsoDateTime(quote.observedAt, `${path}.observedAt`, issues);
      checkString(quote.source, `${path}.source`, issues);
      if (ids.has(quote.positionId)) {
        issues.push(`${path}.positionId duplicates ${quote.positionId}`);
      }
      ids.add(quote.positionId);
    });
  }

  throwIfIssues(issues);
  return snapshot;
}
