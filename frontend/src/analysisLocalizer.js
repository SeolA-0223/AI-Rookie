const CLAUSE_TITLE_TO_EN = {
  "연령 요건": "Eligibility Age Requirement",
  "자격 연령 요건": "Eligibility Age Requirement",
  "제출 서류": "Required Documents",
  "신청 기한": "Application Deadline",
  "지원 금액": "Support Amount",
  "실태조사 제출 서류": "Required Documents for Survey",
  "시행계획 공표 기한": "Plan Publication Deadline",
  "지원 금액 기준": "Support Amount Standard",
  "참여사업 제출 서류": "Required Documents for Participation Programs",
  "연간 시행계획 공표 기한": "Annual Implementation Plan Deadline",
  "사업 지원금 기준": "Project Support Amount Standard"
};

const CHANGE_TYPE_TO_EN = {
  요건: "Eligibility",
  서류: "Documents",
  기한: "Deadline",
  금액: "Amount",
  기타: "Other"
};

const RISK_REASON_TO_EN = {
  "대민 안내에 직접 노출되는 자격·기한 정보라서 미반영 시 잘못된 안내로 이어질 수 있습니다.":
    "This item directly affects public-facing eligibility or deadline guidance, so missing it can lead to incorrect instructions.",
  "제출 서류 변경이 누락되면 반려나 보완 요청이 늘어날 수 있습니다.":
    "If the required-document change is missed, rejected applications or follow-up correction requests can increase.",
  "주로 문구 또는 금액 기준 조정으로, 상대적으로 운영 리스크가 낮습니다.":
    "This is mainly a wording or amount adjustment, so the operational risk is relatively low."
};

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function translateClauseTitle(title, locale) {
  const normalizedTitle = asText(title);
  if (locale !== "en") {
    return normalizedTitle;
  }

  return CLAUSE_TITLE_TO_EN[normalizedTitle] ?? normalizedTitle;
}

function translateChangeType(changeType, locale) {
  const normalizedType = asText(changeType);
  if (locale !== "en") {
    return normalizedType;
  }

  return CHANGE_TYPE_TO_EN[normalizedType] ?? normalizedType;
}

function buildEnglishChangeSummary(change = {}) {
  const before = asText(change.beforeText) || "N/A";
  const after = asText(change.afterText) || "N/A";
  const changeType = translateChangeType(change.changeType, "en") || "Clause";

  if (change.operation === "added") {
    return `${changeType} clause was added. New text: ${after}`;
  }

  if (change.operation === "removed") {
    return `${changeType} clause was removed. Previous text: ${before}`;
  }

  return `${changeType} criteria changed. Before: ${before} / After: ${after}`;
}

function buildEnglishRiskReason(riskRow = {}, change = {}) {
  const originalReason = asText(riskRow.risk?.reason ?? riskRow.reason);
  if (RISK_REASON_TO_EN[originalReason]) {
    return RISK_REASON_TO_EN[originalReason];
  }

  const normalizedType = asText(change.changeType);
  if (normalizedType === "요건" || normalizedType === "기한") {
    return "This item affects public-facing eligibility or deadline guidance and should be updated first.";
  }
  if (normalizedType === "서류") {
    return "A document requirement changed, so forms and guidance should be reviewed carefully.";
  }
  return "This item has a relatively lower operational risk than eligibility or deadline changes.";
}

function buildEnglishDrafts(changes = [], risks = []) {
  const changeLines = changes
    .map((change) => `- [${translateChangeType(change.changeType, "en")}] ${translateClauseTitle(change.title, "en")}: ${buildEnglishChangeSummary(change)}`)
    .join("\n");
  const highRiskCount = risks.filter((item) => {
    const level = asText(item.risk?.level ?? item.level).toLowerCase();
    return level === "빨강" || level === "red" || level === "high";
  }).length;

  const internalNoticeDraft = [
    "[Internal Notice Draft]",
    "",
    "The following ordinance changes were detected.",
    changeLines,
    "",
    `High-risk items: ${highRiskCount}`
  ].join("\n");

  const citizenGuideDraft = [
    "[Citizen Guide Draft]",
    "",
    "Please review the following changes and reflect them in the public guidance.",
    changeLines
  ].join("\n");

  const faqDraft = [
    "[FAQ Draft]",
    "",
    "Q. What changed?",
    "A. Please review the change summary below.",
    changeLines
  ].join("\n");

  const comparisonTable = [
    "| Type | Clause | Change Summary |",
    "|---|---|---|",
    ...changes.map((change) =>
      `| ${translateChangeType(change.changeType, "en")} | ${translateClauseTitle(change.title, "en")} | ${buildEnglishChangeSummary(change)} |`
    )
  ].join("\n");

  return {
    internalNoticeDraft,
    citizenGuideDraft,
    faqDraft,
    comparisonTable
  };
}

export function localizeAnalysisForUi(result = {}, locale = "ko") {
  if (locale !== "en") {
    return result;
  }

  const changes = Array.isArray(result.analysis?.changes ?? result.changes)
    ? (result.analysis?.changes ?? result.changes).map((change) => ({
        ...change,
        title: translateClauseTitle(change.title, "en"),
        summary: buildEnglishChangeSummary(change)
      }))
    : [];

  const risksSource = Array.isArray(result.analysis?.risks ?? result.risks) ? (result.analysis?.risks ?? result.risks) : [];
  const changeMap = new Map(changes.map((change) => [change.id, change]));
  const risks = risksSource.map((row) => ({
    ...row,
    risk: {
      ...(row.risk ?? {}),
      reason: buildEnglishRiskReason(row, changeMap.get(row.changeId))
    }
  }));

  const drafts = buildEnglishDrafts(changes, risks);

  return {
    ...result,
    analysis: {
      ...(result.analysis ?? {}),
      changes,
      risks
    },
    changes,
    risks,
    drafts
  };
}
