# Private Portfolio Setup

The daily report uses four ignored local files. No broker credentials are needed.

## 1. Create private files

```powershell
npm.cmd run init
```

This creates:

```text
data/private/holdings.json
data/private/theses.json
data/private/market-snapshot.json
data/private/policy.json
```

Existing private files are never overwritten.

## 2. Replace the examples

### `holdings.json`

Contains ownership data:

- stable position ID;
- ticker and instrument identity;
- quantity;
- instrument currency;
- cost basis expressed in the base currency;
- speculative classification;
- explicit economic risk groups.

### `theses.json`

Contains human research state:

- short thesis summary;
- last completed review date;
- next review due date;
- status;
- measurable kill criteria.

### `market-snapshot.json`

Contains replaceable observations:

- current native-currency prices;
- peak price since entry;
- quote timestamps and sources;
- FX rates and timestamps.

This file is manual for now. A market-data adapter will eventually refresh it.

### `policy.json`

Contains portfolio limits, review thresholds, and the explicit reporting timezone (`Asia/Tokyo` by default). The defaults are conservative examples, not personalized financial advice.

## 3. Validate before reporting

```powershell
node src\cli.js validate `
  --holdings data\private\holdings.json `
  --theses data\private\theses.json `
  --market data\private\market-snapshot.json `
  --policy data\private\policy.json
```

Unknown fields, duplicate IDs, missing theses or quotes, invalid dates, negative values, currency mismatches, and missing FX rates are rejected.

## 4. Generate the report

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\run-daily-report.ps1
```

Outputs are written under ignored `reports/private/`:

- daily Markdown report;
- current risk findings;
- finding state used to identify new, reopened, and escalated findings.

Persistent risks remain visible in every report. They become notification candidates only when materially changed.

## 5. Scheduling

After the report is useful manually, schedule `scripts/run-daily-report.ps1` with Windows Task Scheduler. Run it under your own account from this project directory.

Do not schedule it until:

- private inputs validate;
- the report values reconcile with Rakuten;
- timestamps and FX rates are understood;
- you have reviewed the policy limits.

Scheduling does not refresh market data yet. Until a data adapter exists, update `market-snapshot.json` before relying on the result.
