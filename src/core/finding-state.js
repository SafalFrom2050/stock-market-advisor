const SEVERITY_RANK = { INFO: 0, WATCH: 1, HIGH: 2, CRITICAL: 3 };

function defaultState() {
  return { version: 1, updatedAt: null, findings: {} };
}

export function reconcileFindingState(
  currentFindings,
  previousState = defaultState(),
  now = new Date()
) {
  const timestamp = now.toISOString();
  const previousFindings = previousState?.findings ?? {};
  const nextFindings = {};
  const notificationCandidates = [];

  for (const finding of currentFindings) {
    const previous = previousFindings[finding.id];
    let change = "UNCHANGED";

    if (!previous) {
      change = "NEW";
    } else if (previous.status === "RESOLVED") {
      change = "REOPENED";
    } else if (
      SEVERITY_RANK[finding.severity] > SEVERITY_RANK[previous.severity]
    ) {
      change = "ESCALATED";
    }

    nextFindings[finding.id] = {
      status: "ACTIVE",
      severity: finding.severity,
      code: finding.code,
      firstSeenAt: previous?.firstSeenAt ?? timestamp,
      lastSeenAt: timestamp,
      lastChange: change
    };

    if (change !== "UNCHANGED") {
      notificationCandidates.push({ ...finding, change });
    }
  }

  const currentIds = new Set(currentFindings.map((finding) => finding.id));
  for (const [id, previous] of Object.entries(previousFindings)) {
    if (!currentIds.has(id)) {
      nextFindings[id] = {
        ...previous,
        status: "RESOLVED",
        resolvedAt: previous.resolvedAt ?? timestamp,
        lastChange: previous.status === "RESOLVED" ? "UNCHANGED" : "RESOLVED"
      };
    }
  }

  return {
    state: {
      version: 1,
      updatedAt: timestamp,
      findings: nextFindings
    },
    notificationCandidates
  };
}

