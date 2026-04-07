import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline } from "../backend/src/pipeline/runPipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_PATH = path.join(ROOT_DIR, "data", "eval", "metrics.json");
const CASES_DIR = path.join(ROOT_DIR, "data", "cases");
const REQUIRED_DRAFT_KEYS = ["internalNoticeDraft", "citizenGuideDraft", "faqDraft", "comparisonTable"];

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function readJson(relativePath) {
  return readJsonFile(path.join(ROOT_DIR, relativePath));
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

function buildMetricsBundle(result, beforeDoc, afterDoc) {
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

  const generatedDraftCount = REQUIRED_DRAFT_KEYS.filter((key) => {
    const value = normalized.drafts[key];
    return typeof value === "string" && value.trim().length > 0;
  }).length;
  const draftCompletenessRate = divide(generatedDraftCount, REQUIRED_DRAFT_KEYS.length);

  return {
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
        requiredSections: REQUIRED_DRAFT_KEYS.length,
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

export function buildDatasetReport({
  beforeDoc,
  afterDoc,
  internalDocs,
  sampleData,
  metadata = {}
}) {
  const startedAt = Date.now();
  const result = runPipeline({ beforeDoc, afterDoc, internalDocs });
  const runtimeMs = Date.now() - startedAt;
  const { metrics, checks } = buildMetricsBundle(result, beforeDoc, afterDoc);

  return {
    ...metadata,
    sampleData,
    runtimeMs,
    metrics,
    checks
  };
}

function listCaseDirectories() {
  return fs.readdirSync(CASES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(CASES_DIR, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export function buildCaseSuiteReport() {
  const caseDirectories = listCaseDirectories();
  const startedAt = Date.now();

  const cases = caseDirectories.map((caseDirectory) => {
    const metaPath = path.join(caseDirectory, "meta.json");
    const beforePath = path.join(caseDirectory, "before.json");
    const afterPath = path.join(caseDirectory, "after.json");
    const internalDocsPath = path.join(caseDirectory, "internal_docs.json");

    const meta = readJsonFile(metaPath);
    const beforeDoc = readJsonFile(beforePath);
    const afterDoc = readJsonFile(afterPath);
    const internalDocs = readJsonFile(internalDocsPath);

    return buildDatasetReport({
      beforeDoc,
      afterDoc,
      internalDocs,
      sampleData: {
        before: path.relative(ROOT_DIR, beforePath).replace(/\\/g, "/"),
        after: path.relative(ROOT_DIR, afterPath).replace(/\\/g, "/"),
        internalDocs: path.relative(ROOT_DIR, internalDocsPath).replace(/\\/g, "/")
      },
      metadata: {
        caseId: meta.caseId,
        title: meta.officialTitle,
        municipality: meta.municipality,
        domain: meta.domain,
        officialSource: meta.officialSource,
        normalizationNote: meta.normalizationNote
      }
    });
  });

  const summary = {
    evaluatedCaseCount: cases.length,
    passedCaseCount: cases.filter((item) => Object.values(item.checks).every(Boolean)).length,
    suiteRuntimeMs: Date.now() - startedAt,
    averageF1: round(divide(cases.reduce((sum, item) => sum + item.metrics.changeDetection.f1, 0), cases.length)),
    averageMappingCoverage: round(divide(cases.reduce((sum, item) => sum + item.metrics.mapping.coverageRate, 0), cases.length)),
    averageTraceCompleteness: round(divide(cases.reduce((sum, item) => sum + item.metrics.traceability.completenessRate, 0), cases.length)),
    averageDraftCompleteness: round(divide(cases.reduce((sum, item) => sum + item.metrics.drafts.completenessRate, 0), cases.length)),
    averageHighRiskRate: round(divide(cases.reduce((sum, item) => sum + item.metrics.risk.highRiskRate, 0), cases.length)),
    allCasesPassed: cases.length > 0 && cases.every((item) => Object.values(item.checks).every(Boolean)),
    failingCases: cases
      .filter((item) => Object.values(item.checks).some((value) => !value))
      .map((item) => ({
        caseId: item.caseId,
        failedChecks: Object.entries(item.checks)
          .filter(([, passed]) => !passed)
          .map(([name]) => name)
      }))
  };

  return {
    summary,
    cases
  };
}

export function buildReport(outputPath) {
  const sampleReport = buildDatasetReport({
    beforeDoc: readJson("data/samples/regulation_before.json"),
    afterDoc: readJson("data/samples/regulation_after.json"),
    internalDocs: readJson("data/samples/internal_docs.json"),
    sampleData: {
      before: "data/samples/regulation_before.json",
      after: "data/samples/regulation_after.json",
      internalDocs: "data/samples/internal_docs.json"
    }
  });

  return {
    evaluatedAt: new Date().toISOString(),
    sampleData: sampleReport.sampleData,
    artifact: path.relative(ROOT_DIR, outputPath).replace(/\\/g, "/"),
    runtimeMs: sampleReport.runtimeMs,
    metrics: sampleReport.metrics,
    checks: sampleReport.checks,
    caseSuite: buildCaseSuiteReport()
  };
}

function main() {
  const outputPath = resolveOutputPath(process.argv);
  const report = buildReport(outputPath);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
