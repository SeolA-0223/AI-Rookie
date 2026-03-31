const KEYWORDS = {
  "요건": ["age", "eligibility", "requirement"],
  "서류": ["document", "proof", "file", "submit"],
  "기한": ["deadline", "close", "timeline", "date"],
  "금액": ["amount", "support", "krw", "payment"]
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
