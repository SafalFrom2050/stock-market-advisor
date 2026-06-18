import { createHash } from "node:crypto";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function pct(part, whole) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function findingId(code, details) {
  const scope =
    details.ticker ??
    details.sector ??
    details.currency ??
    details.riskGroup ??
    "portfolio";
  const digest = createHash("sha256")
    .update(`${code}:${scope}`)
    .digest("hex")
    .slice(0, 10);
  return `${code.toLowerCase()}:${digest}`;
}

function alert(severity, code, message, details = {}) {
  return { id: findingId(code, details), severity, code, message, details };
}

function dateAtEndOfUtcDay(value) {
  return new Date(`${value}T23:59:59.999Z`);
}

function daysBetween(later, earlier) {
  return (later.getTime() - earlier.getTime()) / DAY_MS;
}

export function evaluatePortfolio(portfolio, policy, now = new Date()) {
  const positions = portfolio.positions ?? [];
  const cashValue = Number(portfolio.cashValue ?? 0);
  const positionsValue = positions.reduce(
    (sum, position) => sum + Number(position.value ?? 0),
    0
  );
  const totalValue = cashValue + positionsValue;
  if (!Number.isFinite(totalValue) || totalValue <= 0) {
    throw new TypeError("Portfolio total value must be a positive finite number.");
  }
  if (!policy?.limits || !policy?.alerts) {
    throw new TypeError("Policy limits and alerts are required.");
  }

  const alerts = [];
  const sectorValues = new Map();
  const currencyValues = new Map([[portfolio.baseCurrency, cashValue]]);
  const riskGroupValues = new Map();
  let speculativeValue = 0;
  let totalCostBasisValue = 0;
  const positionSummaries = [];

  if (!policy.humanApprovalRequired || policy.mode !== "research_only") {
    alerts.push(
      alert(
        "CRITICAL",
        "UNSAFE_MODE",
        "Policy must remain research-only with human approval required."
      )
    );
  }

  if (policy.allowLeverage || policy.allowOptions || policy.allowShortSelling) {
    alerts.push(
      alert(
        "CRITICAL",
        "COMPLEX_PRODUCTS_ENABLED",
        "Leverage, options, and short selling must remain disabled in the beginner policy."
      )
    );
  }

  for (const position of positions) {
    const value = Number(position.value ?? 0);
    const costBasisValue = Number(position.costBasisValue ?? 0);
    const weightPct = pct(value, totalValue);
    const sector = position.sector || "Unknown";
    const isDiversifiedFund =
      position.assetType === "ETF" && sector === "Diversified";
    const unrealizedPnlValue = value - costBasisValue;
    const unrealizedPnlPct =
      costBasisValue > 0 ? (unrealizedPnlValue / costBasisValue) * 100 : 0;

    totalCostBasisValue += costBasisValue;
    currencyValues.set(
      position.currency,
      (currencyValues.get(position.currency) ?? 0) + value
    );
    for (const riskGroup of position.riskGroups ?? []) {
      riskGroupValues.set(
        riskGroup,
        (riskGroupValues.get(riskGroup) ?? 0) + value
      );
    }

    if (!isDiversifiedFund) {
      sectorValues.set(sector, (sectorValues.get(sector) ?? 0) + value);
    }

    if (position.speculative) {
      speculativeValue += value;
    }

    const positionLimitPct = isDiversifiedFund
      ? policy.limits.maxDiversifiedFundPct
      : policy.limits.maxSinglePositionPct;

    if (weightPct > positionLimitPct) {
      alerts.push(
        alert(
          "HIGH",
          "POSITION_CONCENTRATION",
          `${position.ticker} exceeds its position policy limit.`,
          {
            ticker: position.ticker,
            weightPct: round(weightPct),
            limitPct: positionLimitPct,
            category: isDiversifiedFund
              ? "diversified_fund"
              : "single_security",
            action: "RISK_REVIEW"
          }
        )
      );
    }

    if (
      costBasisValue > 0 &&
      unrealizedPnlPct <= -policy.alerts.costBasisLossReviewPct
    ) {
      alerts.push(
        alert(
          "WATCH",
          "COST_BASIS_LOSS_REVIEW",
          `${position.ticker} has crossed the cost-basis loss review threshold.`,
          {
            ticker: position.ticker,
            unrealizedPnlPct: round(unrealizedPnlPct),
            thresholdPct: policy.alerts.costBasisLossReviewPct,
            action: "THESIS_REVIEW",
            note: "Cost basis is context, not a reason to hold or sell."
          }
        )
      );
    }

    const currentPrice = Number(position.currentPrice ?? 0);
    const peakPrice = Number(position.peakPriceSinceEntry ?? 0);
    if (currentPrice > 0 && peakPrice > 0) {
      const drawdownPct = ((peakPrice - currentPrice) / peakPrice) * 100;
      if (drawdownPct >= policy.alerts.criticalDrawdownPct) {
        alerts.push(
          alert(
            "CRITICAL",
            "CRITICAL_DRAWDOWN",
            `${position.ticker} crossed the critical drawdown investigation threshold.`,
            {
              ticker: position.ticker,
              drawdownPct: round(drawdownPct),
              action: "THESIS_REVIEW",
              note: "A drawdown triggers investigation, not an automatic sale."
            }
          )
        );
      } else if (drawdownPct >= policy.alerts.warnDrawdownPct) {
        alerts.push(
          alert(
            "WATCH",
            "DRAWDOWN",
            `${position.ticker} crossed the drawdown investigation threshold.`,
            {
              ticker: position.ticker,
              drawdownPct: round(drawdownPct),
              action: "RISK_REVIEW"
            }
          )
        );
      }
    }

    const priceAsOf = new Date(position.priceAsOf);
    if (
      !position.priceAsOf ||
      Number.isNaN(priceAsOf.getTime()) ||
      now.getTime() - priceAsOf.getTime() >
        policy.alerts.stalePriceHours * HOUR_MS
    ) {
      alerts.push(
        alert(
          "HIGH",
          "STALE_PRICE",
          `${position.ticker} has stale or missing price data; actionable conclusions are blocked.`,
          {
            ticker: position.ticker,
            priceAsOf: position.priceAsOf ?? null,
            action: "REFRESH_DATA"
          }
        )
      );
    }

    const reviewDate = dateAtEndOfUtcDay(position.nextReviewDueAt);
    const reviewOverdueDays = daysBetween(now, reviewDate);
    if (
      !position.nextReviewDueAt ||
      Number.isNaN(reviewDate.getTime()) ||
      reviewOverdueDays > policy.alerts.reviewOverdueGraceDays
    ) {
      alerts.push(
        alert(
          "HIGH",
          "THESIS_REVIEW_OVERDUE",
          `${position.ticker} needs a current written thesis review.`,
          {
            ticker: position.ticker,
            nextReviewDueAt: position.nextReviewDueAt ?? null,
            action: "RISK_REVIEW"
          }
        )
      );
    } else {
      const daysUntilDue = daysBetween(reviewDate, now);
      if (daysUntilDue <= policy.alerts.reviewDueSoonDays) {
        alerts.push(
          alert(
            "WATCH",
            "THESIS_REVIEW_DUE_SOON",
            `${position.ticker} has a thesis review due soon.`,
            {
              ticker: position.ticker,
              nextReviewDueAt: position.nextReviewDueAt,
              daysUntilDue: Math.max(0, Math.ceil(daysUntilDue)),
              action: "SCHEDULE_REVIEW"
            }
          )
        );
      }
    }

    if (position.thesisStatus === "BROKEN") {
      alerts.push(
        alert(
          "CRITICAL",
          "THESIS_MARKED_BROKEN",
          `${position.ticker} is explicitly marked as having a broken thesis.`,
          {
            ticker: position.ticker,
            action: "HUMAN_REVIEW"
          }
        )
      );
    }

    positionSummaries.push({
      id: position.id,
      ticker: position.ticker,
      name: position.name,
      assetType: position.assetType,
      sector: position.sector,
      currency: position.currency,
      quantity: position.quantity,
      currentPrice: position.currentPrice,
      value: round(value),
      costBasisValue: round(costBasisValue),
      unrealizedPnlValue: round(unrealizedPnlValue),
      unrealizedPnlPct: round(unrealizedPnlPct),
      weightPct: round(weightPct),
      riskGroups: position.riskGroups ?? [],
      nextReviewDueAt: position.nextReviewDueAt
    });
  }

  for (const [sector, value] of sectorValues) {
    const weightPct = pct(value, totalValue);
    if (weightPct > policy.limits.maxSectorPct) {
      alerts.push(
        alert(
          "HIGH",
          "SECTOR_CONCENTRATION",
          `${sector} exposure exceeds the sector policy limit.`,
          {
            sector,
            weightPct: round(weightPct),
            limitPct: policy.limits.maxSectorPct,
            action: "RISK_REVIEW"
          }
        )
      );
    }
  }

  const riskGroupExposurePct = {};
  for (const [riskGroup, value] of riskGroupValues) {
    const weightPct = pct(value, totalValue);
    riskGroupExposurePct[riskGroup] = round(weightPct);
    const limitPct = policy.limits.riskGroupLimitsPct[riskGroup];
    if (limitPct !== undefined && weightPct > limitPct) {
      alerts.push(
        alert(
          "HIGH",
          "RISK_GROUP_CONCENTRATION",
          `${riskGroup} exposure exceeds its policy limit.`,
          {
            riskGroup,
            weightPct: round(weightPct),
            limitPct,
            action: "RISK_REVIEW"
          }
        )
      );
    }
  }

  const speculativePct = pct(speculativeValue, totalValue);
  if (speculativePct > policy.limits.maxSpeculativePct) {
    alerts.push(
      alert(
        "HIGH",
        "SPECULATIVE_CONCENTRATION",
        "Speculative holdings exceed the portfolio policy limit.",
        {
          weightPct: round(speculativePct),
          limitPct: policy.limits.maxSpeculativePct,
          action: "RISK_REVIEW"
        }
      )
    );
  }

  const cashPct = pct(cashValue, totalValue);
  if (cashPct < policy.limits.minimumCashPct) {
    alerts.push(
      alert(
        "WATCH",
        "LOW_CASH",
        "Cash allocation is below the policy reserve.",
        {
          cashPct: round(cashPct),
          minimumCashPct: policy.limits.minimumCashPct,
          action: "REVIEW"
        }
      )
    );
  }

  const currencyExposurePct = {};
  let foreignCurrencyValue = 0;
  for (const [currency, value] of currencyValues) {
    currencyExposurePct[currency] = round(pct(value, totalValue));
    if (currency !== portfolio.baseCurrency) {
      foreignCurrencyValue += value;
    }
  }
  const foreignCurrencyPct = pct(foreignCurrencyValue, totalValue);
  if (foreignCurrencyPct > policy.limits.maxForeignCurrencyPct) {
    alerts.push(
      alert(
        "HIGH",
        "FOREIGN_CURRENCY_CONCENTRATION",
        "Foreign-currency exposure exceeds the portfolio policy limit.",
        {
          currency: `NON_${portfolio.baseCurrency}`,
          weightPct: round(foreignCurrencyPct),
          limitPct: policy.limits.maxForeignCurrencyPct,
          action: "RISK_REVIEW"
        }
      )
    );
  }

  const severityRank = { CRITICAL: 0, HIGH: 1, WATCH: 2, INFO: 3 };
  alerts.sort(
    (left, right) =>
      severityRank[left.severity] - severityRank[right.severity]
  );

  const unrealizedPnlValue = positionsValue - totalCostBasisValue;
  const unrealizedPnlPct =
    totalCostBasisValue > 0
      ? (unrealizedPnlValue / totalCostBasisValue) * 100
      : 0;

  return {
    generatedAt: now.toISOString(),
    timezone: policy.timezone,
    status: alerts.some((item) => item.severity === "CRITICAL")
      ? "RISK_REVIEW"
      : alerts.length
        ? "WATCH"
        : "OK",
    summary: {
      totalValue: round(totalValue),
      cashPct: round(cashPct),
      speculativePct: round(speculativePct),
      foreignCurrencyPct: round(foreignCurrencyPct),
      currencyExposurePct,
      riskGroupExposurePct,
      totalCostBasisValue: round(totalCostBasisValue),
      unrealizedPnlValue: round(unrealizedPnlValue),
      unrealizedPnlPct: round(unrealizedPnlPct),
      positionCount: positions.length,
      alertCount: alerts.length
    },
    positions: positionSummaries,
    alerts
  };
}
