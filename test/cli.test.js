import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cwd = fileURLToPath(new URL("..", import.meta.url));
const nodeCommand = process.platform === "win32" ? "node.exe" : "node";

test("validate command accepts the example inputs", async () => {
  const { stdout } = await execFileAsync(
    nodeCommand,
    ["src/cli.js", "validate"],
    { cwd }
  );
  const output = JSON.parse(stdout);

  assert.equal(output.status, "VALID");
  assert.equal(output.positionCount, 2);
});

test("report command writes report, findings, and state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stock-advisor-"));
  const reportPath = join(directory, "daily.md");
  const findingsPath = join(directory, "findings.json");
  const statePath = join(directory, "state.json");

  const { stdout } = await execFileAsync(
    nodeCommand,
    [
      "src/cli.js",
      "report",
      "--now",
      "2026-06-18T09:00:00+09:00",
      "--output",
      reportPath,
      "--findings",
      findingsPath,
      "--state",
      statePath
    ],
    { cwd }
  );
  const output = JSON.parse(stdout);
  const report = await readFile(reportPath, "utf8");
  const findings = JSON.parse(await readFile(findingsPath, "utf8"));
  const state = JSON.parse(await readFile(statePath, "utf8"));

  assert.equal(output.notificationCandidates > 0, true);
  assert.match(report, /Daily Portfolio Risk Report/);
  assert.equal(findings.summary.positionCount, 2);
  assert.equal(state.version, 1);
});
