import { parseDocument } from "../ingest/parseDocument.js";
import { detectChanges } from "../changeDetection/detectChanges.js";
import { mapImpactDocuments } from "../mapping/mapImpactDocuments.js";
import { classifyRisk } from "../risk/classifyRisk.js";
import { buildTrace } from "../trace/buildTrace.js";
import { generateDrafts } from "../generation/generateDrafts.js";

export function runPipeline({ beforeDoc, afterDoc, internalDocs }) {
  const beforeClauses = parseDocument(beforeDoc);
  const afterClauses = parseDocument(afterDoc);

  const changes = detectChanges(beforeClauses, afterClauses);
  const mapped = mapImpactDocuments(changes, internalDocs);

  const risks = mapped.map((item) => {
    const risk = classifyRisk(item.changeType, item.impactedDocuments);
    return {
      changeId: item.changeId,
      risk
    };
  });

  const traces = mapped.map((item) => {
    const change = changes.find((row) => row.id === item.changeId);
    const risk = risks.find((row) => row.changeId === item.changeId)?.risk;
    return buildTrace(change, item.impactedDocuments, risk);
  });

  const drafts = generateDrafts(changes, risks);

  return {
    changes,
    mapped,
    risks,
    traces,
    drafts
  };
}
