function classifyChangeType(clause) {
  const text = `${clause.title} ${clause.beforeText ?? ""} ${clause.afterText ?? ""}`.toLowerCase();

  if (text.includes("age") || text.includes("year")) {
    return "요건";
  }
  if (text.includes("document") || text.includes("proof") || text.includes("submit")) {
    return "서류";
  }
  if (text.includes("deadline") || text.includes("close") || text.includes("date") || text.includes("april") || text.includes("march")) {
    return "기한";
  }
  if (text.includes("amount") || text.includes("krw") || text.includes("support")) {
    return "금액";
  }

  return "기타";
}

function summarizeChange(clause, changeType) {
  const before = clause.beforeText ?? "";
  const after = clause.afterText ?? "";

  if (changeType === "요건") {
    return `Eligibility requirement changed: ${before} -> ${after}`;
  }
  if (changeType === "서류") {
    return `Required document condition changed: ${before} -> ${after}`;
  }
  if (changeType === "기한") {
    return `Deadline changed: ${before} -> ${after}`;
  }
  if (changeType === "금액") {
    return `Support amount changed: ${before} -> ${after}`;
  }
  return `Clause changed: ${before} -> ${after}`;
}

export function detectChanges(beforeClauses, afterClauses) {
  const beforeMap = new Map(beforeClauses.map((item) => [item.id, item]));
  const afterMap = new Map(afterClauses.map((item) => [item.id, item]));

  const allIds = [...new Set([...beforeMap.keys(), ...afterMap.keys()])];

  const changes = [];
  for (const id of allIds) {
    const before = beforeMap.get(id);
    const after = afterMap.get(id);

    if (!before && after) {
      const merged = {
        id,
        title: after.title,
        beforeText: null,
        afterText: after.text,
        operation: "added"
      };
      const changeType = classifyChangeType(merged);
      changes.push({
        ...merged,
        changeType,
        summary: summarizeChange(merged, changeType)
      });
      continue;
    }

    if (before && !after) {
      const merged = {
        id,
        title: before.title,
        beforeText: before.text,
        afterText: null,
        operation: "removed"
      };
      const changeType = classifyChangeType(merged);
      changes.push({
        ...merged,
        changeType,
        summary: summarizeChange(merged, changeType)
      });
      continue;
    }

    if (before?.text !== after?.text) {
      const merged = {
        id,
        title: after.title,
        beforeText: before.text,
        afterText: after.text,
        operation: "updated"
      };
      const changeType = classifyChangeType(merged);
      changes.push({
        ...merged,
        changeType,
        summary: summarizeChange(merged, changeType)
      });
    }
  }

  return changes;
}
