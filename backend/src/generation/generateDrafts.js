function lineForChange(change) {
  return `- [${change.changeType}] ${change.title}: ${change.beforeText ?? "(none)"} -> ${change.afterText ?? "(none)"}`;
}

function buildComparisonTable(changes) {
  const header = "| Type | Clause | Before | After |\n|---|---|---|---|";
  const rows = changes.map((change) => `| ${change.changeType} | ${change.title} | ${change.beforeText ?? ""} | ${change.afterText ?? ""} |`);
  return [header, ...rows].join("\n");
}

export function generateDrafts(changes, riskRows) {
  const changeLines = changes.map(lineForChange).join("\n");
  const highRisk = riskRows.filter((item) => item.risk.level === "빨강");

  const internalNoticeDraft = [
    "[Internal Notice Draft]",
    "",
    "The following policy changes were detected:",
    changeLines,
    "",
    `High risk items: ${highRisk.length}`
  ].join("\n");

  const citizenGuideDraft = [
    "[Citizen Guide Update Draft]",
    "",
    "Please review and apply these updates:",
    changeLines
  ].join("\n");

  const faqDraft = [
    "[FAQ Update Draft]",
    "",
    "Q: What changed?",
    "A: See summarized changes below.",
    changeLines
  ].join("\n");

  return {
    internalNoticeDraft,
    citizenGuideDraft,
    faqDraft,
    comparisonTable: buildComparisonTable(changes)
  };
}
