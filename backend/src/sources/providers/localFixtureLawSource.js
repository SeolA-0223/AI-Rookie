import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSourceStatus, normalizeEnvValue, SourceResolutionError } from "../shared.js";

const DATA_ROOT = fileURLToPath(new URL("../../../../data", import.meta.url));
const CASES_ROOT = path.join(DATA_ROOT, "cases");
const CASE_CATALOG_FILE = path.join(CASES_ROOT, "case_catalog.json");
const SAMPLE_BEFORE_FILE = path.join(DATA_ROOT, "samples", "regulation_before.json");
const SAMPLE_AFTER_FILE = path.join(DATA_ROOT, "samples", "regulation_after.json");
const SAMPLE_INTERNAL_DOCS_FILE = path.join(DATA_ROOT, "samples", "internal_docs.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function buildLocalFixtureInputError(details) {
  return new SourceResolutionError({
    code: "SOURCE_INPUT_INVALID",
    message: "Source request is invalid.",
    details,
    statusCode: 400
  });
}

function readCaseCatalog() {
  return readJson(CASE_CATALOG_FILE);
}

export function listLocalFixtureCases() {
  return readCaseCatalog().map((entry) => ({
    caseId: normalizeEnvValue(entry.caseId),
    title: normalizeEnvValue(entry.title),
    municipality: normalizeEnvValue(entry.municipality),
    domain: normalizeEnvValue(entry.domain),
    effectiveDate: normalizeEnvValue(entry.effectiveDate),
    ordinanceNo: normalizeEnvValue(entry.ordinanceNo),
    officialUrl: normalizeEnvValue(entry.officialUrl),
    normalizedDemoExcerpts: entry.normalizedDemoExcerpts === true,
    defaultSample: entry.defaultSample === true
  }));
}

export function getLocalFixtureDefaultCaseId() {
  const defaultEntry = listLocalFixtureCases().find((entry) => entry.defaultSample);
  return defaultEntry?.caseId ?? "";
}

export function readLocalFixtureCasePack(caseId) {
  const normalizedCaseId = normalizeEnvValue(caseId);
  const catalogEntry = listLocalFixtureCases().find((entry) => entry.caseId === normalizedCaseId);

  if (!catalogEntry) {
    throw buildLocalFixtureInputError([
      {
        path: "source.caseId",
        message: `must reference one of the bundled case packs (${listLocalFixtureCases()
          .map((entry) => entry.caseId)
          .join(", ")})`
      }
    ]);
  }

  const caseRoot = path.join(CASES_ROOT, normalizedCaseId);
  const meta = readJson(path.join(caseRoot, "meta.json"));

  return {
    caseId: normalizedCaseId,
    catalogEntry,
    meta,
    beforeDoc: readJson(path.join(caseRoot, "before.json")),
    afterDoc: readJson(path.join(caseRoot, "after.json")),
    internalDocs: readJson(path.join(caseRoot, "internal_docs.json"))
  };
}

export function createLocalFixtureLawSource({
  beforeDoc = readJson(SAMPLE_BEFORE_FILE),
  afterDoc = readJson(SAMPLE_AFTER_FILE)
} = {}) {
  const bundledCases = listLocalFixtureCases();
  const status = buildSourceStatus({
    provider: "local-fixture",
    enabled: true,
    mode: "sample",
    caseCount: bundledCases.length,
    defaultCaseId: getLocalFixtureDefaultCaseId()
  });

  return {
    getSourceStatus() {
      return status;
    },
    async searchRegulations() {
      return {
        results: [],
        meta: {
          provider: "local-fixture",
          mode: "sample"
        }
      };
    },
    async resolveRegulationPair(input = {}) {
      const caseId = normalizeEnvValue(input.caseId);

      if (caseId) {
        const casePack = readLocalFixtureCasePack(caseId);
        return {
          beforeDoc: casePack.beforeDoc,
          afterDoc: casePack.afterDoc,
          meta: {
            provider: "local-fixture",
            mode: "case-pack",
            caseId: casePack.caseId,
            caseTitle: casePack.catalogEntry.title,
            municipality: casePack.catalogEntry.municipality,
            officialUrl: casePack.catalogEntry.officialUrl
          }
        };
      }

      return {
        beforeDoc,
        afterDoc,
        meta: {
          provider: "local-fixture",
          mode: "sample"
        }
      };
    }
  };
}

export function readSampleInternalDocs() {
  return readJson(SAMPLE_INTERNAL_DOCS_FILE);
}
