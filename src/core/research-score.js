const FACTOR_WEIGHTS = {
  financialQuality: 0.22,
  growthDurability: 0.18,
  valuation: 0.18,
  catalystQuality: 0.12,
  evidenceCoverage: 0.2,
  risk: 0.1
};

function clamp(value) {
  return Math.min(100, Math.max(0, Number(value ?? 0)));
}

export function scoreCandidate(candidate) {
  const factors = candidate.factors ?? {};
  const hardBlocks = candidate.hardBlocks ?? [];
  const contributions = {};
  let score = 0;

  for (const [name, weight] of Object.entries(FACTOR_WEIGHTS)) {
    const raw = clamp(factors[name]);
    const adjusted = name === "risk" ? 100 - raw : raw;
    const contribution = adjusted * weight;
    contributions[name] = {
      raw,
      adjusted,
      weight,
      contribution: Math.round(contribution * 100) / 100
    };
    score += contribution;
  }

  score = Math.round(score * 100) / 100;

  const experimentalBand =
    score >= 75 ? "HIGH" : score >= 60 ? "MEDIUM" : "LOW";

  return {
    ticker: candidate.ticker,
    status: "RESEARCH",
    score,
    experimentalBand,
    hardBlocks,
    contributions,
    disclaimer:
      "Experimental diagnostic only. It cannot escalate a candidate until factor inputs are evidence-backed and calibrated."
  };
}
