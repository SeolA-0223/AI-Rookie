import { localizeClauseTitle } from "../shared/localizeDemoText.js";

const CHANGE_TYPES = {
  eligibility: "\uC694\uAC74",
  document: "\uC11C\uB958",
  deadline: "\uAE30\uD55C",
  amount: "\uAE08\uC561",
  generic: "\uAE30\uD0C0"
};

const CHANGE_KEYWORDS = [
  {
    type: CHANGE_TYPES.deadline,
    keywords: [
      "deadline",
      "close",
      "closing",
      "timeline",
      "date",
      "march",
      "april",
      "\uAE30\uD55C",
      "\uB9C8\uAC10",
      "\uC811\uC218",
      "\uACF5\uACE0",
      "\uAE30\uAC04"
    ]
  },
  {
    type: CHANGE_TYPES.document,
    keywords: [
      "document",
      "proof",
      "submit",
      "file",
      "\uC11C\uB958",
      "\uC99D\uBE59",
      "\uC81C\uCD9C",
      "\uD655\uC778\uC11C",
      "\uB4F1\uBCF8"
    ]
  },
  {
    type: CHANGE_TYPES.amount,
    keywords: [
      "amount",
      "support",
      "krw",
      "payment",
      "\uAE08\uC561",
      "\uC9C0\uC6D0\uAE08",
      "\uC9C0\uC6D0\uC561",
      "\uC774\uC790",
      "\uC6D0"
    ]
  },
  {
    type: CHANGE_TYPES.eligibility,
    keywords: [
      "age",
      "eligibility",
      "requirement",
      "graduate",
      "\uC5F0\uB839",
      "\uB098\uC774",
      "\uB300\uC0C1",
      "\uC694\uAC74",
      "\uC790\uACA9"
    ]
  }
];

function hasKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function classifyChangeType(clause) {
  const text = `${clause.title} ${clause.beforeText ?? ""} ${clause.afterText ?? ""}`.toLowerCase();

  for (const entry of CHANGE_KEYWORDS) {
    if (hasKeyword(text, entry.keywords)) {
      return entry.type;
    }
  }

  return CHANGE_TYPES.generic;
}

function summarizeChange(clause, changeType) {
  const before = clause.beforeText ?? "";
  const after = clause.afterText ?? "";

  if (changeType === CHANGE_TYPES.eligibility) {
    return `자격 요건이 변경되었습니다. 변경 전: ${before} / 변경 후: ${after}`;
  }
  if (changeType === CHANGE_TYPES.document) {
    return `제출 서류 기준이 변경되었습니다. 변경 전: ${before} / 변경 후: ${after}`;
  }
  if (changeType === CHANGE_TYPES.deadline) {
    return `신청 기한이 변경되었습니다. 변경 전: ${before} / 변경 후: ${after}`;
  }
  if (changeType === CHANGE_TYPES.amount) {
    return `지원 금액 기준이 변경되었습니다. 변경 전: ${before} / 변경 후: ${after}`;
  }
  return `조문 내용이 변경되었습니다. 변경 전: ${before} / 변경 후: ${after}`;
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
        title: localizeClauseTitle(after.title),
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
        title: localizeClauseTitle(before.title),
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
        title: localizeClauseTitle(after.title),
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
