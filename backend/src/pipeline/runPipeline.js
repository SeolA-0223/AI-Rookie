import { parseDocument } from "../ingest/parseDocument.js";
import { detectChanges } from "../changeDetection/detectChanges.js";
import { mapImpactDocuments } from "../mapping/mapImpactDocuments.js";
import { classifyRisk } from "../risk/classifyRisk.js";
import { buildTrace } from "../trace/buildTrace.js";
import { generateDrafts } from "../generation/generateDrafts.js";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateRequiredString(value, path, details) {
  if (typeof value !== "string" || value.trim() === "") {
    details.push({ path, message: "must be a non-empty string" });
  }
}

function validateRegulationDocument(document, path, details) {
  if (!isPlainObject(document)) {
    details.push({ path, message: "must be an object" });
    return;
  }

  if (!Array.isArray(document.clauses)) {
    details.push({ path: `${path}.clauses`, message: "must be an array" });
    return;
  }

  if (document.clauses.length === 0) {
    details.push({ path: `${path}.clauses`, message: "must include at least one clause" });
    return;
  }

  document.clauses.forEach((clause, index) => {
    const clausePath = `${path}.clauses[${index}]`;
    if (!isPlainObject(clause)) {
      details.push({ path: clausePath, message: "must be an object" });
      return;
    }

    validateRequiredString(clause.id, `${clausePath}.id`, details);
    validateRequiredString(clause.title, `${clausePath}.title`, details);
    validateRequiredString(clause.text, `${clausePath}.text`, details);
  });
}

function validateInternalDocuments(internalDocs, path, details) {
  if (!Array.isArray(internalDocs)) {
    details.push({ path, message: "must be an array" });
    return;
  }

  if (internalDocs.length === 0) {
    details.push({ path, message: "must include at least one document" });
    return;
  }

  internalDocs.forEach((document, index) => {
    const documentPath = `${path}[${index}]`;
    if (!isPlainObject(document)) {
      details.push({ path: documentPath, message: "must be an object" });
      return;
    }

    validateRequiredString(document.id, `${documentPath}.id`, details);
    validateRequiredString(document.type, `${documentPath}.type`, details);
    validateRequiredString(document.title, `${documentPath}.title`, details);
    validateRequiredString(document.text, `${documentPath}.text`, details);
  });
}

function buildChangeTypeBreakdown(changes) {
  return changes.reduce((accumulator, change) => {
    accumulator[change.changeType] = (accumulator[change.changeType] ?? 0) + 1;
    return accumulator;
  }, {});
}

export class PipelineValidationError extends Error {
  constructor(details) {
    super("Pipeline input validation failed");
    this.name = "PipelineValidationError";
    this.code = "PIPELINE_VALIDATION_ERROR";
    this.details = details;
  }
}

export function validatePipelineInput(input) {
  const details = [];
  if (!isPlainObject(input)) {
    throw new PipelineValidationError([{ path: "root", message: "must be an object" }]);
  }

  validateRegulationDocument(input.beforeDoc, "beforeDoc", details);
  validateRegulationDocument(input.afterDoc, "afterDoc", details);
  validateInternalDocuments(input.internalDocs, "internalDocs", details);

  if (details.length > 0) {
    throw new PipelineValidationError(details);
  }
}

export function runPipeline({ beforeDoc, afterDoc, internalDocs }) {
  validatePipelineInput({ beforeDoc, afterDoc, internalDocs });

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
  const highRiskChangeCount = risks.filter((row) => row.risk.level === "빨강").length;
  const analysis = {
    changes,
    impactedDocuments: mapped,
    risks,
    traces
  };

  return {
    meta: {
      schemaVersion: "1.0.0",
      generatedAt: new Date().toISOString(),
      totalChanges: changes.length,
      highRiskChangeCount,
      changeTypeBreakdown: buildChangeTypeBreakdown(changes)
    },
    analysis,
    // Keep legacy top-level fields for existing clients/tests.
    changes,
    mapped,
    risks,
    traces,
    drafts
  };
}
