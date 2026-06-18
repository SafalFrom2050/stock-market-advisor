import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateDailyReport } from "./core/daily-report.js";
import { reconcileFindingState } from "./core/finding-state.js";
import { assemblePortfolio } from "./core/portfolio-assembler.js";
import { evaluatePortfolio } from "./core/risk-engine.js";
import { scoreCandidate } from "./core/research-score.js";

function valueAfter(flag, args, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function dateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [
      part.type,
      part.value
    ])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

async function readJson(path) {
  const absolutePath = resolve(path);
  try {
    return JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Unable to read JSON from ${absolutePath}: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}

async function readOptionalJson(path, fallback) {
  return existsSync(resolve(path)) ? readJson(path) : fallback;
}

async function writeText(path, content) {
  const absolutePath = resolve(path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
  return absolutePath;
}

async function writeJson(path, value) {
  return writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function initializePrivateFiles() {
  const copies = [
    ["data/holdings.example.json", "data/private/holdings.json"],
    ["data/theses.example.json", "data/private/theses.json"],
    ["data/market-snapshot.example.json", "data/private/market-snapshot.json"],
    ["config/investment-policy.example.json", "data/private/policy.json"]
  ];
  const created = [];
  const skipped = [];

  for (const [source, destination] of copies) {
    const absoluteDestination = resolve(destination);
    if (existsSync(absoluteDestination)) {
      skipped.push(absoluteDestination);
      continue;
    }
    await mkdir(dirname(absoluteDestination), { recursive: true });
    await copyFile(resolve(source), absoluteDestination);
    created.push(absoluteDestination);
  }

  return { created, skipped };
}

function inputPaths(args) {
  return {
    holdings: valueAfter(
      "--holdings",
      args,
      "data/holdings.example.json"
    ),
    theses: valueAfter("--theses", args, "data/theses.example.json"),
    market: valueAfter(
      "--market",
      args,
      "data/market-snapshot.example.json"
    ),
    policy: valueAfter(
      "--policy",
      args,
      "config/investment-policy.example.json"
    )
  };
}

async function loadPortfolioInputs(args) {
  const paths = inputPaths(args);
  const [holdings, theses, market, policy] = await Promise.all([
    readJson(paths.holdings),
    readJson(paths.theses),
    readJson(paths.market),
    readJson(paths.policy)
  ]);
  return {
    paths,
    holdings,
    theses,
    market,
    policy,
    portfolio: assemblePortfolio({ holdings, theses, market, policy })
  };
}

function printUsage() {
  console.log(`
Stock Market Advisor

Commands:
  init
  validate --holdings <path> --theses <path> --market <path> --policy <path>
  risk     --holdings <path> --theses <path> --market <path> --policy <path> [--now <ISO timestamp>]
  report   --holdings <path> --theses <path> --market <path> --policy <path>
           [--output <path>] [--findings <path>] [--state <path>] [--now <ISO timestamp>]
  score --candidate <path>

Examples:
  node src/cli.js init
  node src/cli.js validate
  node src/cli.js risk --now 2026-06-18T09:00:00+09:00
  node src/cli.js report --now 2026-06-18T09:00:00+09:00
  node src/cli.js score --candidate data/candidate.example.json
`.trim());
}

async function main() {
  const [, , command, ...args] = process.argv;

  if (command === "init") {
    console.log(JSON.stringify(await initializePrivateFiles(), null, 2));
    return;
  }

  if (command === "validate") {
    const { paths, portfolio } = await loadPortfolioInputs(args);
    console.log(
      JSON.stringify(
        {
          status: "VALID",
          inputs: paths,
          positionCount: portfolio.positions.length,
          baseCurrency: portfolio.baseCurrency,
          portfolioAsOf: portfolio.asOf
        },
        null,
        2
      )
    );
    return;
  }

  if (command === "risk" || command === "report") {
    const nowValue = valueAfter("--now", args, null);
    const now = nowValue ? new Date(nowValue) : new Date();
    if (Number.isNaN(now.getTime())) {
      throw new Error("--now must be a valid ISO date-time.");
    }
    const { portfolio, policy } = await loadPortfolioInputs(args);
    const riskResult = evaluatePortfolio(portfolio, policy, now);

    if (command === "risk") {
      console.log(JSON.stringify(riskResult, null, 2));
      return;
    }

    const date = dateInTimeZone(now, policy.timezone);
    const outputPath = valueAfter(
      "--output",
      args,
      `reports/private/daily/${date}.md`
    );
    const findingsPath = valueAfter(
      "--findings",
      args,
      "reports/private/risk-findings.json"
    );
    const statePath = valueAfter(
      "--state",
      args,
      "reports/private/finding-state.json"
    );
    const previousState = await readOptionalJson(statePath, {
      version: 1,
      updatedAt: null,
      findings: {}
    });
    const { state, notificationCandidates } = reconcileFindingState(
      riskResult.alerts,
      previousState,
      now
    );
    const report = generateDailyReport({
      portfolio,
      riskResult,
      notificationCandidates
    });
    const [writtenReport, writtenFindings, writtenState] = await Promise.all([
      writeText(outputPath, report),
      writeJson(findingsPath, riskResult),
      writeJson(statePath, state)
    ]);
    console.log(
      JSON.stringify(
        {
          status: riskResult.status,
          report: writtenReport,
          findings: writtenFindings,
          state: writtenState,
          notificationCandidates: notificationCandidates.length
        },
        null,
        2
      )
    );
    return;
  }

  if (command === "score") {
    const candidatePath = valueAfter(
      "--candidate",
      args,
      "data/candidate.example.json"
    );
    console.log(
      JSON.stringify(scoreCandidate(await readJson(candidatePath)), null, 2)
    );
    return;
  }

  printUsage();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
