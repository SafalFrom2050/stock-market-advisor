import test from "node:test";
import assert from "node:assert/strict";
import { reconcileFindingState } from "../src/core/finding-state.js";

const watchFinding = {
  id: "drawdown:abc",
  severity: "WATCH",
  code: "DRAWDOWN",
  message: "Review drawdown.",
  details: { ticker: "DEMO" }
};

test("new findings become notification candidates only once", () => {
  const first = reconcileFindingState(
    [watchFinding],
    undefined,
    new Date("2026-06-18T00:00:00Z")
  );
  const second = reconcileFindingState(
    [watchFinding],
    first.state,
    new Date("2026-06-19T00:00:00Z")
  );

  assert.equal(first.notificationCandidates[0].change, "NEW");
  assert.equal(second.notificationCandidates.length, 0);
  assert.equal(second.state.findings[watchFinding.id].status, "ACTIVE");
});

test("severity escalation and reopening create notification candidates", () => {
  const first = reconcileFindingState(
    [watchFinding],
    undefined,
    new Date("2026-06-18T00:00:00Z")
  );
  const escalated = reconcileFindingState(
    [{ ...watchFinding, severity: "CRITICAL" }],
    first.state,
    new Date("2026-06-19T00:00:00Z")
  );
  const resolved = reconcileFindingState(
    [],
    escalated.state,
    new Date("2026-06-20T00:00:00Z")
  );
  const reopened = reconcileFindingState(
    [watchFinding],
    resolved.state,
    new Date("2026-06-21T00:00:00Z")
  );

  assert.equal(escalated.notificationCandidates[0].change, "ESCALATED");
  assert.equal(
    resolved.state.findings[watchFinding.id].status,
    "RESOLVED"
  );
  assert.equal(reopened.notificationCandidates[0].change, "REOPENED");
});

