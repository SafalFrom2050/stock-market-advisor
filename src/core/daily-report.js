function money(value, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

function pct(value) {
  return `${Number(value).toFixed(2)}%`;
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function findingScope(finding) {
  return (
    finding.details.ticker ??
    finding.details.sector ??
    finding.details.currency ??
    finding.details.riskGroup ??
    "Portfolio"
  );
}

export function generateDailyReport({
  portfolio,
  riskResult,
  notificationCandidates = []
}) {
  const lines = [];
  const { summary } = riskResult;

  lines.push("# Daily Portfolio Risk Report", "");
  lines.push(`**Generated:** ${riskResult.generatedAt}  `);
  lines.push(`**Reporting timezone:** ${riskResult.timezone}  `);
  lines.push(`**Portfolio valuation:** ${portfolio.asOf}  `);
  lines.push(`**Holdings snapshot:** ${portfolio.metadata.holdingsAsOf}  `);
  lines.push(`**Status:** ${riskResult.status}`, "");

  lines.push("## Portfolio summary", "");
  lines.push(
    `- Total value: ${money(summary.totalValue, portfolio.baseCurrency)}`
  );
  lines.push(`- Cash: ${pct(summary.cashPct)}`);
  lines.push(`- Speculative exposure: ${pct(summary.speculativePct)}`);
  lines.push(
    `- Unrealized P&L: ${money(
      summary.unrealizedPnlValue,
      portfolio.baseCurrency
    )} (${pct(summary.unrealizedPnlPct)})`
  );
  lines.push(`- Active findings: ${summary.alertCount}`, "");

  lines.push("## Currency exposure", "");
  lines.push("| Currency | Portfolio exposure |");
  lines.push("|---|---:|");
  for (const [currency, exposurePct] of Object.entries(
    summary.currencyExposurePct
  )) {
    lines.push(`| ${escapeCell(currency)} | ${pct(exposurePct)} |`);
  }
  lines.push("");

  lines.push("## Positions", "");
  lines.push(
    "| Ticker | Type | Sector | Value | Weight | P&L | Quote | Review due |"
  );
  lines.push("|---|---|---|---:|---:|---:|---:|---|");
  for (const position of riskResult.positions) {
    lines.push(
      `| ${escapeCell(position.ticker)} | ${escapeCell(
        position.assetType
      )} | ${escapeCell(position.sector)} | ${money(
        position.value,
        portfolio.baseCurrency
      )} | ${pct(position.weightPct)} | ${money(
        position.unrealizedPnlValue,
        portfolio.baseCurrency
      )} (${pct(position.unrealizedPnlPct)}) | ${position.currentPrice.toFixed(
        2
      )} ${position.currency} | ${escapeCell(position.nextReviewDueAt)} |`
    );
  }
  lines.push("");

  lines.push("## Risk findings", "");
  if (riskResult.alerts.length === 0) {
    lines.push("No policy or data-quality findings.", "");
  } else {
    lines.push("| Severity | Scope | Finding | Action | ID |");
    lines.push("|---|---|---|---|---|");
    for (const finding of riskResult.alerts) {
      lines.push(
        `| ${finding.severity} | ${escapeCell(
          findingScope(finding)
        )} | ${escapeCell(finding.message)} | ${escapeCell(
          finding.details.action
        )} | \`${finding.id}\` |`
      );
    }
    lines.push("");
  }

  lines.push("## Notification candidates", "");
  if (notificationCandidates.length === 0) {
    lines.push(
      "No new, reopened, or escalated findings. Persistent findings remain visible above.",
      ""
    );
  } else {
    for (const finding of notificationCandidates) {
      lines.push(
        `- **${finding.change} · ${finding.severity} · ${findingScope(
          finding
        )}:** ${finding.message}`
      );
    }
    lines.push("");
  }

  lines.push("## Review notes", "");
  lines.push(
    "- A price decline is an investigation trigger, not an automatic sale."
  );
  lines.push(
    "- Tax consequences are not calculated; account type and Japan tax treatment require separate review."
  );
  lines.push(
    "- Findings use the supplied snapshots. Stale or incorrect source data can invalidate the report."
  );
  lines.push("");

  return `${lines.join("\n")}\n`;
}
