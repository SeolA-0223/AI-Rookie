import { requestGeminiJson } from "../ai/geminiJson.js";
import { buildTrace } from "../trace/buildTrace.js";

const CHANGE_TYPES = {
  eligibility: "\uC694\uAC74",
  document: "\uC11C\uB958",
  deadline: "\uAE30\uD55C",
  amount: "\uAE08\uC561",
  generic: "\uAE30\uD0C0"
};

const RISK_LEVELS = {
  high: "\uBE68\uAC15",
  medium: "\uB178\uB791",
  low: "\uD30C\uB791"
};

const CHANGE_TYPE_ALIASES = new Map([
  ["eligibility", CHANGE_TYPES.eligibility],
  ["requirement", CHANGE_TYPES.eligibility],
  ["requirements", CHANGE_TYPES.eligibility],
  ["\uC694\uAC74", CHANGE_TYPES.eligibility],
  ["\uC790\uACA9", CHANGE_TYPES.eligibility],
  ["\uB300\uC0C1", CHANGE_TYPES.eligibility],
  ["document", CHANGE_TYPES.document],
  ["documents", CHANGE_TYPES.document],
  ["file", CHANGE_TYPES.document],
  ["\uC11C\uB958", CHANGE_TYPES.document],
  ["deadline", CHANGE_TYPES.deadline],
  ["date", CHANGE_TYPES.deadline],
  ["timeline", CHANGE_TYPES.deadline],
  ["\uAE30\uD55C", CHANGE_TYPES.deadline],
  ["\uB9C8\uAC10", CHANGE_TYPES.deadline],
  ["amount", CHANGE_TYPES.amount],
  ["payment", CHANGE_TYPES.amount],
  ["money", CHANGE_TYPES.amount],
  ["\uAE08\uC561", CHANGE_TYPES.amount],
  ["\uC9C0\uC6D0\uAE08", CHANGE_TYPES.amount],
  ["generic", CHANGE_TYPES.generic],
  ["other", CHANGE_TYPES.generic],
  ["misc", CHANGE_TYPES.generic],
  ["\uAE30\uD0C0", CHANGE_TYPES.generic]
]);

const RISK_LEVEL_ALIASES = new Map([
  ["high", RISK_LEVELS.high],
  ["red", RISK_LEVELS.high],
  ["\uBE68\uAC15", RISK_LEVELS.high],
  ["medium", RISK_LEVELS.medium],
  ["yellow", RISK_LEVELS.medium],
  ["\uB178\uB791", RISK_LEVELS.medium],
  ["low", RISK_LEVELS.low],
  ["blue", RISK_LEVELS.low],
  ["\uD30C\uB791", RISK_LEVELS.low]
]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLookupText(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function buildChangeTypeBreakdown(changes) {
  return changes.reduce((accumulator, change) => {
    accumulator[change.changeType] = (accumulator[change.changeType] ?? 0) + 1;
    return accumulator;
  }, {});
}

function clipText(value, maxLength = 400) {
  const text = normalizeText(value).replace(/\s+/g, " ");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1))}\u2026`;
}

function sanitizeClause(clause = {}) {
  return {
    id: normalizeText(clause.id),
    title: normalizeText(clause.title),
    text: clipText(clause.text, 700)
  };
}

function sanitizeInternalDocument(document = {}) {
  return {
    id: normalizeText(document.id),
    type: normalizeText(document.type),
    title: normalizeText(document.title),
    text: clipText(document.text, 700)
  };
}

function buildPrompt({ beforeDoc, afterDoc, internalDocs, fallbackAnalysis }) {
  return [
    "You are reviewing municipal ordinance changes and internal-document impact.",
    "Return JSON only with these keys:",
    "changes, impactedDocuments, risks",
    "",
    "Schema requirements:",
    '- changes: array of objects with keys id, title, operation, changeType, summary, beforeText, afterText',
    '- impactedDocuments: array of objects with keys changeId, changeType, impactedDocuments',
    '- each impactedDocuments item must be an array of objects with keys documentId, score, reason',
    '- risks: array of objects with keys changeId, risk',
    '- each risk object must contain level and reason',
    "",
    "Allowed values:",
    `- operation: updated, added, removed`,
    `- changeType: ${Object.values(CHANGE_TYPES).join(", ")}`,
    `- risk.level: ${Object.values(RISK_LEVELS).join(", ")}`,
    "",
    "Instructions:",
    "- Compare the before/after clauses directly to decide what changed.",
    "- Use the internal-document titles and text to decide impact mapping.",
    "- Keep summaries and reasons in Korean.",
    "- Reuse provided clause ids and internal document ids whenever possible.",
    "- If uncertain, stay conservative and close to the baseline analysis instead of inventing facts.",
    "",
    "Before ordinance clauses:",
    JSON.stringify((beforeDoc?.clauses ?? []).map(sanitizeClause), null, 2),
    "",
    "After ordinance clauses:",
    JSON.stringify((afterDoc?.clauses ?? []).map(sanitizeClause), null, 2),
    "",
    "Internal documents:",
    JSON.stringify((internalDocs ?? []).map(sanitizeInternalDocument), null, 2),
    "",
    "Baseline analysis for reference:",
    JSON.stringify(fallbackAnalysis, null, 2)
  ].join("\n");
}

function mapClausesById(document = {}) {
  return new Map(
    (Array.isArray(document?.clauses) ? document.clauses : [])
      .map((clause) => sanitizeClause(clause))
      .filter((clause) => clause.id)
      .map((clause) => [clause.id, clause])
  );
}

function mapDocumentsById(documents = []) {
  return new Map(
    (Array.isArray(documents) ? documents : [])
      .map((document) => sanitizeInternalDocument(document))
      .filter((document) => document.id)
      .map((document) => [document.id, document])
  );
}

function mapDocumentsByTitle(documentsById) {
  const map = new Map();
  for (const document of documentsById.values()) {
    const normalizedTitle = normalizeLookupText(document.title);
    if (normalizedTitle) {
      map.set(normalizedTitle, document);
    }
  }
  return map;
}

function detectOperation(beforeClause, afterClause) {
  if (!beforeClause && afterClause) {
    return "added";
  }
  if (beforeClause && !afterClause) {
    return "removed";
  }
  if (beforeClause && afterClause && beforeClause.text !== afterClause.text) {
    return "updated";
  }
  return "";
}

function summarizeFallbackChange({ operation, beforeText, afterText }) {
  if (operation === "added") {
    return `\uC2E0\uADDC \uC870\uD56D\uC774 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4. ${afterText ? `\uCD94\uAC00 \uB0B4\uC6A9: ${clipText(afterText, 180)}` : ""}`.trim();
  }
  if (operation === "removed") {
    return `\uAE30\uC874 \uC870\uD56D\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4. ${beforeText ? `\uC774\uC804 \uB0B4\uC6A9: ${clipText(beforeText, 180)}` : ""}`.trim();
  }
  return `\uC870\uD56D \uB0B4\uC6A9\uC774 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4. \uC774\uC804: ${clipText(beforeText, 120)} / \uC774\uD6C4: ${clipText(afterText, 120)}`.trim();
}

function normalizeOperation(value, beforeClause, afterClause) {
  const normalizedValue = normalizeText(value).toLowerCase();
  if (normalizedValue === "added" || normalizedValue === "removed" || normalizedValue === "updated") {
    return normalizedValue;
  }
  return detectOperation(beforeClause, afterClause);
}

function normalizeChangeType(value, fallbackValue = CHANGE_TYPES.generic) {
  const normalizedValue = normalizeLookupText(value);
  return CHANGE_TYPE_ALIASES.get(normalizedValue) ?? fallbackValue;
}

function normalizeRiskLevel(value, fallbackValue = RISK_LEVELS.low) {
  const normalizedValue = normalizeLookupText(value);
  return RISK_LEVEL_ALIASES.get(normalizedValue) ?? fallbackValue;
}

function normalizeScore(value, fallbackScore = 0.5) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1) {
      return Number(Math.min(Math.max(value / 100, 0), 1).toFixed(2));
    }
    return Number(Math.min(Math.max(value, 0), 1).toFixed(2));
  }
  return Number(Math.min(Math.max(fallbackScore, 0), 1).toFixed(2));
}

function createFallbackMeta(aiMeta = {}, overrides = {}) {
  return {
    ...aiMeta,
    applied: false,
    overriddenChangeCount: 0,
    overriddenImpactCount: 0,
    overriddenRiskCount: 0,
    ...overrides
  };
}

function mergeChanges({ payloadChanges, fallbackChanges, beforeMap, afterMap }) {
  const fallbackById = new Map((fallbackChanges ?? []).map((change) => [change.id, change]));
  const aiById = new Map();

  for (const change of Array.isArray(payloadChanges) ? payloadChanges : []) {
    const id = normalizeText(change?.id);
    if (!id) {
      continue;
    }
    aiById.set(id, change);
  }

  const orderedIds = unique([
    ...(fallbackChanges ?? []).map((change) => change.id),
    ...aiById.keys()
  ]);

  const changes = [];
  let overriddenChangeCount = 0;

  for (const id of orderedIds) {
    const beforeClause = beforeMap.get(id);
    const afterClause = afterMap.get(id);
    const fallback = fallbackById.get(id);
    const ai = aiById.get(id);
    const operation = normalizeOperation(ai?.operation, beforeClause, afterClause) || fallback?.operation;

    if (!operation) {
      continue;
    }

    const beforeText = normalizeText(ai?.beforeText) || beforeClause?.text || fallback?.beforeText || "";
    const afterText = normalizeText(ai?.afterText) || afterClause?.text || fallback?.afterText || "";
    const title = normalizeText(ai?.title) || fallback?.title || afterClause?.title || beforeClause?.title || id;
    const changeType = normalizeChangeType(ai?.changeType, fallback?.changeType ?? CHANGE_TYPES.generic);
    const summary = normalizeText(ai?.summary) || fallback?.summary || summarizeFallbackChange({ operation, beforeText, afterText });

    changes.push({
      id,
      title,
      beforeText: beforeText || null,
      afterText: afterText || null,
      operation,
      changeType,
      summary
    });

    if (ai && fallback && (
      changeType !== fallback.changeType ||
      summary !== fallback.summary ||
      title !== fallback.title ||
      operation !== fallback.operation
    )) {
      overriddenChangeCount += 1;
    }
  }

  return {
    changes,
    overriddenChangeCount
  };
}

function resolveDocumentReference(candidate, documentsById, documentsByTitle) {
  const candidateId = normalizeText(candidate?.documentId);
  if (candidateId && documentsById.has(candidateId)) {
    return documentsById.get(candidateId);
  }

  const candidateTitle = normalizeLookupText(candidate?.title);
  if (candidateTitle && documentsByTitle.has(candidateTitle)) {
    return documentsByTitle.get(candidateTitle);
  }

  return null;
}

function mergeImpactedDocuments({
  payloadImpactedDocuments,
  fallbackImpactedDocuments,
  finalChanges,
  internalDocs
}) {
  const fallbackById = new Map((fallbackImpactedDocuments ?? []).map((item) => [item.changeId, item]));
  const aiById = new Map();
  const documentsById = mapDocumentsById(internalDocs);
  const documentsByTitle = mapDocumentsByTitle(documentsById);

  for (const item of Array.isArray(payloadImpactedDocuments) ? payloadImpactedDocuments : []) {
    const changeId = normalizeText(item?.changeId);
    if (!changeId) {
      continue;
    }
    aiById.set(changeId, item);
  }

  const merged = [];
  let overriddenImpactCount = 0;

  for (const change of finalChanges) {
    const fallback = fallbackById.get(change.id);
    const ai = aiById.get(change.id);

    if (!ai) {
      merged.push({
        changeId: change.id,
        changeType: change.changeType,
        impactedDocuments: fallback?.impactedDocuments ?? []
      });
      continue;
    }

    const impactedDocuments = [];
    for (const item of Array.isArray(ai.impactedDocuments) ? ai.impactedDocuments : []) {
      const resolvedDocument = resolveDocumentReference(item, documentsById, documentsByTitle);
      if (!resolvedDocument) {
        continue;
      }

      const fallbackDocument = (fallback?.impactedDocuments ?? []).find((entry) => entry.documentId === resolvedDocument.id);
      impactedDocuments.push({
        documentId: resolvedDocument.id,
        title: resolvedDocument.title,
        type: resolvedDocument.type,
        score: normalizeScore(item.score, fallbackDocument?.score ?? 0.5),
        reason: normalizeText(item.reason)
      });
    }

    merged.push({
      changeId: change.id,
      changeType: change.changeType,
      impactedDocuments
    });

    const fallbackIds = JSON.stringify((fallback?.impactedDocuments ?? []).map((entry) => entry.documentId));
    const aiIds = JSON.stringify(impactedDocuments.map((entry) => entry.documentId));
    if (fallbackIds !== aiIds) {
      overriddenImpactCount += 1;
    }
  }

  return {
    impactedDocuments: merged,
    overriddenImpactCount
  };
}

function mergeRisks({ payloadRisks, fallbackRisks, finalChanges }) {
  const fallbackById = new Map((fallbackRisks ?? []).map((item) => [item.changeId, item]));
  const aiById = new Map();

  for (const item of Array.isArray(payloadRisks) ? payloadRisks : []) {
    const changeId = normalizeText(item?.changeId);
    if (!changeId) {
      continue;
    }
    aiById.set(changeId, item);
  }

  const risks = [];
  let overriddenRiskCount = 0;

  for (const change of finalChanges) {
    const fallback = fallbackById.get(change.id);
    const ai = aiById.get(change.id);
    const fallbackRisk = fallback?.risk ?? {};

    const risk = {
      level: normalizeRiskLevel(ai?.risk?.level, fallbackRisk.level ?? RISK_LEVELS.low),
      reason:
        normalizeText(ai?.risk?.reason) ||
        normalizeText(fallbackRisk.reason) ||
        "\uC6B4\uC601 \uB9AC\uC2A4\uD06C \uBC0F \uB300\uBBFC \uC548\uB0B4 \uC601\uD5A5\uC744 \uCD94\uAC00 \uD655\uC778\uD574 \uC8FC\uC138\uC694."
    };

    risks.push({
      changeId: change.id,
      risk
    });

    if (ai && (risk.level !== fallbackRisk.level || risk.reason !== fallbackRisk.reason)) {
      overriddenRiskCount += 1;
    }
  }

  return {
    risks,
    overriddenRiskCount
  };
}

function buildTraces(changes, impactedDocuments, risks) {
  return impactedDocuments.map((item) => {
    const change = changes.find((entry) => entry.id === item.changeId);
    const risk = risks.find((entry) => entry.changeId === item.changeId)?.risk;
    return buildTrace(change, item.impactedDocuments, risk);
  });
}

function buildFallbackAnalysis(result = {}) {
  return {
    changes: result.analysis?.changes ?? result.changes ?? [],
    impactedDocuments: result.analysis?.impactedDocuments ?? result.mapped ?? [],
    risks: result.analysis?.risks ?? result.risks ?? []
  };
}

export async function enhancePipelineResultWithConfiguredAI(
  {
    beforeDoc,
    afterDoc,
    internalDocs,
    result
  },
  {
    env = process.env,
    fetchImpl = globalThis.fetch
  } = {}
) {
  const fallbackAnalysis = buildFallbackAnalysis(result);
  const beforeMap = mapClausesById(beforeDoc);
  const afterMap = mapClausesById(afterDoc);
  const aiResult = await requestGeminiJson(
    buildPrompt({
      beforeDoc,
      afterDoc,
      internalDocs,
      fallbackAnalysis
    }),
    {
      env,
      fetchImpl,
      temperature: 0.1
    }
  );

  const payload = aiResult.value && typeof aiResult.value === "object" ? aiResult.value : {};
  const { changes, overriddenChangeCount } = mergeChanges({
    payloadChanges: payload.changes,
    fallbackChanges: fallbackAnalysis.changes,
    beforeMap,
    afterMap
  });

  if (!changes.length) {
    return {
      result,
      meta: createFallbackMeta(aiResult.meta, {
        reason: aiResult.meta?.reason ?? "empty_changes"
      })
    };
  }

  const { impactedDocuments, overriddenImpactCount } = mergeImpactedDocuments({
    payloadImpactedDocuments: payload.impactedDocuments,
    fallbackImpactedDocuments: fallbackAnalysis.impactedDocuments,
    finalChanges: changes,
    internalDocs
  });
  const { risks, overriddenRiskCount } = mergeRisks({
    payloadRisks: payload.risks,
    fallbackRisks: fallbackAnalysis.risks,
    finalChanges: changes
  });
  const traces = buildTraces(changes, impactedDocuments, risks);
  const highRiskChangeCount = risks.filter((entry) => entry.risk?.level === RISK_LEVELS.high).length;

  return {
    result: {
      ...result,
      meta: {
        ...result.meta,
        totalChanges: changes.length,
        highRiskChangeCount,
        changeTypeBreakdown: buildChangeTypeBreakdown(changes)
      },
      analysis: {
        changes,
        impactedDocuments,
        risks,
        traces
      },
      changes,
      mapped: impactedDocuments,
      risks,
      traces
    },
    meta: {
      ...aiResult.meta,
      applied: Boolean(aiResult.meta?.usedAI),
      overriddenChangeCount,
      overriddenImpactCount,
      overriddenRiskCount,
      baselineChangeCount: fallbackAnalysis.changes.length,
      finalChangeCount: changes.length
    }
  };
}
