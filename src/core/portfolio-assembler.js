import {
  validateHoldings,
  validateMarketSnapshot,
  validatePolicy,
  validateTheses,
  ValidationError
} from "./validation.js";

function mapBy(items, key) {
  return new Map(items.map((item) => [item[key], item]));
}

function fxRateFor(currency, baseCurrency, fxRates) {
  if (currency === baseCurrency) {
    return 1;
  }

  const direct = fxRates.find(
    (item) => item.pair === `${currency}${baseCurrency}`
  );
  if (direct) {
    return direct.rate;
  }

  const inverse = fxRates.find(
    (item) => item.pair === `${baseCurrency}${currency}`
  );
  if (inverse) {
    return 1 / inverse.rate;
  }

  return null;
}

export function assemblePortfolio({ holdings, theses, market, policy }) {
  validateHoldings(holdings);
  validateTheses(theses);
  validateMarketSnapshot(market);
  validatePolicy(policy);

  const issues = [];
  if (holdings.baseCurrency !== policy.baseCurrency) {
    issues.push("holdings.baseCurrency must match policy.baseCurrency");
  }
  if (market.baseCurrency !== policy.baseCurrency) {
    issues.push("market.baseCurrency must match policy.baseCurrency");
  }

  const thesisByPosition = mapBy(theses.theses, "positionId");
  const quoteByPosition = mapBy(market.quotes, "positionId");
  const holdingIds = new Set(holdings.positions.map((item) => item.id));

  for (const thesis of theses.theses) {
    if (!holdingIds.has(thesis.positionId)) {
      issues.push(
        `thesis ${thesis.positionId} does not match an active holding`
      );
    }
  }
  for (const quote of market.quotes) {
    if (!holdingIds.has(quote.positionId)) {
      issues.push(`quote ${quote.positionId} does not match an active holding`);
    }
  }

  const positions = holdings.positions.map((holding) => {
    const thesis = thesisByPosition.get(holding.id);
    const quote = quoteByPosition.get(holding.id);
    if (!thesis) {
      issues.push(`holding ${holding.id} is missing a thesis`);
    }
    if (!quote) {
      issues.push(`holding ${holding.id} is missing a market quote`);
    }
    if (!thesis || !quote) {
      return null;
    }
    if (thesis.ticker !== holding.ticker) {
      issues.push(`thesis ticker does not match holding ${holding.id}`);
    }
    if (
      quote.ticker !== holding.ticker ||
      quote.currency !== holding.instrumentCurrency
    ) {
      issues.push(`quote identity or currency does not match holding ${holding.id}`);
    }

    const fxRate = fxRateFor(
      holding.instrumentCurrency,
      holdings.baseCurrency,
      market.fxRates
    );
    if (fxRate === null) {
      issues.push(
        `holding ${holding.id} has no FX rate from ${holding.instrumentCurrency} to ${holdings.baseCurrency}`
      );
      return null;
    }

    return {
      id: holding.id,
      ticker: holding.ticker,
      name: holding.name,
      market: holding.market,
      sector: holding.sector,
      assetType: holding.assetType,
      quantity: holding.quantity,
      currency: holding.instrumentCurrency,
      fxRate,
      value: holding.quantity * quote.currentPrice * fxRate,
      costBasisValue: holding.costBasisBase,
      currentPrice: quote.currentPrice,
      peakPriceSinceEntry: quote.peakPriceSinceEntry,
      priceAsOf: quote.observedAt,
      priceSource: quote.source,
      speculative: holding.speculative,
      riskGroups: holding.riskGroups,
      thesisStatus: thesis.status,
      thesisSummary: thesis.summary,
      lastReviewedAt: thesis.lastReviewedAt,
      nextReviewDueAt: thesis.nextReviewDueAt,
      killCriteria: thesis.killCriteria
    };
  });

  if (issues.length > 0) {
    throw new ValidationError(issues);
  }

  return {
    asOf: market.asOf,
    baseCurrency: holdings.baseCurrency,
    cashValue: holdings.cashBaseValue,
    positions,
    metadata: {
      holdingsAsOf: holdings.asOf,
      thesesAsOf: theses.asOf,
      marketAsOf: market.asOf,
      fxRates: market.fxRates
    }
  };
}

