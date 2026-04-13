const KEYWORDS = {
  "\uC694\uAC74": [
    "age",
    "eligibility",
    "requirement",
    "graduate",
    "\uC5F0\uB839",
    "\uB300\uC0C1",
    "\uC694\uAC74",
    "\uC790\uACA9"
  ],
  "\uC11C\uB958": [
    "document",
    "proof",
    "file",
    "submit",
    "\uC11C\uB958",
    "\uC99D\uBE59",
    "\uC81C\uCD9C",
    "\uD655\uC778\uC11C",
    "\uB4F1\uBCF8"
  ],
  "\uAE30\uD55C": [
    "deadline",
    "close",
    "closing",
    "timeline",
    "date",
    "\uAE30\uD55C",
    "\uB9C8\uAC10",
    "\uC811\uC218",
    "\uACF5\uACE0",
    "\uAE30\uAC04"
  ],
  "\uAE08\uC561": [
    "amount",
    "krw",
    "payment",
    "\uAE08\uC561",
    "\uC9C0\uC6D0\uAE08",
    "\uC9C0\uC6D0\uC561",
    "\uC774\uC790",
    "\uC608\uC0B0"
  ]
};

function scoreDocument(change, document) {
  const tokens = KEYWORDS[change.changeType] ?? [];
  const haystack = `${document.title} ${document.text}`.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }

  return tokens.length ? score / tokens.length : 0;
}

export function mapImpactDocuments(changes, documents) {
  return changes.map((change) => {
    const ranked = documents
      .map((document) => ({
        documentId: document.id,
        title: document.title,
        type: document.type,
        score: Number(scoreDocument(change, document).toFixed(2))
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return {
      changeId: change.id,
      changeType: change.changeType,
      impactedDocuments: ranked
    };
  });
}
