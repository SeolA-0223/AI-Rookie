import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline } from "../backend/src/pipeline/runPipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_PATH = path.join(ROOT_DIR, "data", "eval", "metrics.json");

function readJson(relativePath) {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, ""));
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function divide(numerator, denominator) {
  if (!denominator) {
    return 0;
  }
  return numerator / denominator;
}

function resolveOutputPath(argv) {
  const outIndex = argv.indexOf("--out");
  if (outIndex >= 0 && argv[outIndex + 1]) {
    return path.resolve(ROOT_DIR, argv[outIndex + 1]);
  }
  return DEFAULT_OUTPUT_PATH;
}

function collectChangedClauseIds(beforeDoc, afterDoc) {
  const beforeMap = new Map(beforeDoc.clauses.map((clause) => [clause.id, clause.text]));
  const afterMap = new Map(afterDoc.clauses.map((clause) => [clause.id, clause.text]));
  const allIds = [...new Set([...beforeMap.keys(), ...afterMap.keys()])];

  return allIds.filter((id) => beforeMap.get(id) !== afterMap.get(id)).sort();
}

function normalizeAnalyzeResponse(result = {}) {
  const analysis = result.analysis ?? {};
  return {
    changes: analysis.changes ?? result.changes ?? [],
    mapped: analysis.impactedDocuments ?? result.mapped ?? [],
    risks: analysis.risks ?? result.risks ?? [],
    traces: analysis.traces ?? result.traces ?? [],
    drafts: result.drafts ?? {}
  };
}

function buildReport(result, beforeDoc, afterDoc, outputPath, runtimeMs) {
  const normalized = normalizeAnalyzeResponse(result);
  const expectedChangedIds = collectChangedClauseIds(beforeDoc, afterDoc);
  const predictedChangedIds = normalized.changes.map((change) => change.id).sort();
  const truePositiveCount = predictedChangedIds.filter((id) => expectedChangedIds.includes(id)).length;

  const precision = divide(truePositiveCount, predictedChangedIds.length);
  const recall = divide(truePositiveCount, expectedChangedIds.length);
  const f1 = divide(2 * precision * recall, precision + recall);

  const mappingCounts = normalized.mapped.map((row) => (row.impactedDocuments ?? row.docs ?? []).length);
  const mappedRowsWithDocs = mappingCounts.filter((count) => count > 0).length;
  const mappingCoverage = divide(mappedRowsWithDocs, normalized.mapped.length);
  const averageImpactedDocs = divide(mappingCounts.reduce((sum, count) => sum + count, 0), normalized.mapped.length);

  const riskDistribution = normalized.risks.reduce((acc, row) => {
    const level = row.risk?.level ?? row.level ?? "unknown";
    acc[level] = (acc[level] ?? 0) + 1;
    return acc;
  }, {});

  const completeTraceCount = normalized.traces.filter((trace) => {
    const hasEvidence = Boolean(trace.evidence?.summary);
    const hasImpactedDocuments = Array.isArray(trace.impactedDocumentIds) && trace.impactedDocumentIds.length > 0;
    const hasRisk = Boolean(trace.risk?.level);
    return hasEvidence && hasImpactedDocuments && hasRisk;
  }).length;
  const traceCompletenessRate = divide(completeTraceCount, normalized.traces.length);

  const requiredDraftKeys = ["internalNoticeDraft", "citizenGuideDraft", "faqDraft", "comparisonTable"];
  const generatedDraftCount = requiredDraftKeys.filter((key) => {
    const value = normalized.drafts[key];
    return typeof value === "string" && value.trim().length > 0;
  }).length;
  const draftCompletenessRate = divide(generatedDraftCount, requiredDraftKeys.length);

  return {
    evaluatedAt: new Date().toISOString(),
    sampleData: {
      before: "data/samples/regulation_before.json",
      after: "data/samples/regulation_after.json",
      internalDocs: "data/samples/internal_docs.json"
    },
    artifact: path.relative(ROOT_DIR, outputPath).replace(/\\/g, "/"),
    runtimeMs,
    metrics: {
      changeDetection: {
        expectedChangedClauses: expectedChangedIds.length,
        predictedChangedClauses: predictedChangedIds.length,
        truePositives: truePositiveCount,
        precision: round(precision),
        recall: round(recall),
        f1: round(f1)
      },
      mapping: {
        rows: normalized.mapped.length,
        rowsWithImpactedDocuments: mappedRowsWithDocs,
        coverageRate: round(mappingCoverage),
        avgImpactedDocumentsPerChange: round(averageImpactedDocs)
      },
      risk: {
        rows: normalized.risks.length,
        distribution: riskDistribution,
        highRiskRate: round(divide(riskDistribution["빨강"] ?? 0, normalized.risks.length))
      },
      traceability: {
        traces: normalized.traces.length,
        completeTraces: completeTraceCount,
        completenessRate: round(traceCompletenessRate)
      },
      drafts: {
        requiredSections: requiredDraftKeys.length,
        generatedSections: generatedDraftCount,
        completenessRate: round(draftCompletenessRate)
      }
    },
    checks: {
      noMissingChanges: expectedChangedIds.length === predictedChangedIds.length,
      noMissingMappings: round(mappingCoverage) === 1,
      allTracesComplete: round(traceCompletenessRate) === 1,
      allDraftSectionsGenerated: round(draftCompletenessRate) === 1
    }
  };
}

function main() {
  const beforeDoc = readJson("data/samples/regulation_before.json");
  const afterDoc = readJson("data/samples/regulation_after.json");
  const internalDocs = readJson("data/samples/internal_docs.json");

  const outputPath = resolveOutputPath(process.argv);
  const startedAt = Date.now();
  const result = runPipeline({ beforeDoc, afterDoc, internalDocs });
  const runtimeMs = Date.now() - startedAt;
  const report = buildReport(result, beforeDoc, afterDoc, outputPath, runtimeMs);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main();
