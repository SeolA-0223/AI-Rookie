export function buildTrace(change, impactedDocuments, risk) {
  return {
    changeId: change.id,
    evidence: {
      clauseTitle: change.title,
      before: change.beforeText,
      after: change.afterText,
      summary: change.summary
    },
    impactedDocumentIds: impactedDocuments.map((item) => item.documentId),
    risk
  };
}
