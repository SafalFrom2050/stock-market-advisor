$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$requiredFiles = @(
  "data\private\holdings.json",
  "data\private\theses.json",
  "data\private\market-snapshot.json",
  "data\private\policy.json"
)

foreach ($file in $requiredFiles) {
  if (-not (Test-Path $file)) {
    throw "Missing $file. Run 'npm.cmd run init' and replace the examples with your private data."
  }
}

node src\cli.js report `
  --holdings data\private\holdings.json `
  --theses data\private\theses.json `
  --market data\private\market-snapshot.json `
  --policy data\private\policy.json `
  --findings reports\private\risk-findings.json `
  --state reports\private\finding-state.json

if ($LASTEXITCODE -ne 0) {
  throw "Daily report failed with exit code $LASTEXITCODE."
}
