export function classifyRisk(changeType, impactedDocuments) {
  const hasGuideOrFaq = impactedDocuments.some(
    (item) => item.type === "guide" || item.type === "faq"
  );

  if ((changeType === "요건" || changeType === "기한") && hasGuideOrFaq) {
    return {
      level: "빨강",
      reason: "Citizen-facing eligibility/deadline information can cause misguidance if outdated."
    };
  }

  if (changeType === "서류") {
    return {
      level: "노랑",
      reason: "Missing document updates can increase rejection or resubmission rate."
    };
  }

  return {
    level: "파랑",
    reason: "Mostly wording or amount updates with lower operational risk."
  };
}
