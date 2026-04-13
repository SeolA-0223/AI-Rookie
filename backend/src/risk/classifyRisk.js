export function classifyRisk(changeType, impactedDocuments) {
  const hasGuideOrFaq = impactedDocuments.some(
    (item) => item.type === "guide" || item.type === "faq"
  );

  if ((changeType === "요건" || changeType === "기한") && hasGuideOrFaq) {
    return {
      level: "빨강",
      reason: "대민 안내에 직접 노출되는 자격·기한 정보라서 미반영 시 잘못된 안내로 이어질 수 있습니다."
    };
  }

  if (changeType === "서류") {
    return {
      level: "노랑",
      reason: "제출 서류 변경이 누락되면 반려나 보완 요청이 늘어날 수 있습니다."
    };
  }

  return {
    level: "파랑",
    reason: "주로 문구 또는 금액 기준 조정으로, 상대적으로 운영 리스크가 낮습니다."
  };
}
