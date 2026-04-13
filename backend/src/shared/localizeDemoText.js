const CLAUSE_TITLE_TRANSLATIONS = {
  "Age Requirement": "연령 요건",
  "Eligibility Age Requirement": "자격 연령 요건",
  "Required Documents": "제출 서류",
  "Application Deadline": "신청 기한",
  "Support Amount": "지원 금액",
  "Required Documents for Survey": "실태조사 제출 서류",
  "Support Amount Standard": "지원 금액 기준",
  "Required Documents for Participation Programs": "참여사업 제출 서류",
  "Project Support Amount Standard": "사업 지원금 기준"
};

export function localizeClauseTitle(title) {
  if (typeof title !== "string" || title.trim() === "") {
    return title;
  }

  return CLAUSE_TITLE_TRANSLATIONS[title] ?? title;
}
