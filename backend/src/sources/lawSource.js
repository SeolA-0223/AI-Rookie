import { createKoreaLawMcpSource } from "./providers/koreaLawMcpSource.js";
import { createLocalFixtureLawSource } from "./providers/localFixtureLawSource.js";
import { createUnavailableLawSource, normalizeEnvValue, SourceResolutionError } from "./shared.js";

export { SourceResolutionError };

const SEARCH_STOP_WORDS = new Set([
  "ordinance",
  "ordinances",
  "law",
  "laws",
  "local",
  "the",
  "\uC870\uB840",
  "\uBC95\uADDC",
  "\uBC95"
]);

function normalizeSearchText(value) {
  return normalizeEnvValue(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function tokenizeSearchText(value) {
  return normalizeSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token && !SEARCH_STOP_WORDS.has(token));
}

function parseDateValue(value) {
  const normalizedValue = normalizeEnvValue(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return null;
  }

  const timestamp = Date.parse(`${normalizedValue}T00:00:00Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function scoreSearchResult(result, queryTokens, normalizedQuery) {
  const normalizedTitle = normalizeSearchText(result.title);
  const normalizedJurisdiction = normalizeSearchText(result.jurisdiction);
  let score = 0;

  if (normalizedQuery && normalizedTitle === normalizedQuery) {
    score += 6;
  } else if (normalizedQuery && (normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle))) {
    score += 4;
  }

  for (const token of queryTokens) {
    if (normalizedTitle.includes(token)) {
      score += 1.5;
    } else if (normalizedJurisdiction.includes(token)) {
      score += 1;
    }
  }

  if (parseDateValue(result.effectiveDate)) {
    score += 1.5;
  }
  if (parseDateValue(result.promulgationDate)) {
    score += 0.5;
  }

  return score;
}

function buildRecommendationReason({ title, jurisdiction, datedPairCount, matchCount }) {
  const scope = jurisdiction ? `${title} in ${jurisdiction}` : title;
  if (datedPairCount >= 2) {
    return `Matched ${scope} and found ${matchCount} timeline candidate(s) with usable ordinance dates.`;
  }
  return `Matched ${scope} and selected the best available timeline pair from ${matchCount} candidate(s).`;
}

export function recommendLawSourcePair(results = [], query = "") {
  if (!Array.isArray(results) || results.length < 2) {
    return null;
  }

  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenizeSearchText(query);
  const groups = new Map();

  for (const result of results) {
    if (!result?.id || !result?.title) {
      continue;
    }

    const normalizedTitle = normalizeSearchText(result.title);
    const normalizedJurisdiction = normalizeSearchText(result.jurisdiction);
    const groupKey = `${normalizedTitle}::${normalizedJurisdiction}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        title: result.title,
        jurisdiction: result.jurisdiction ?? "",
        results: []
      });
    }

    groups.get(groupKey).results.push({
      ...result,
      _score: scoreSearchResult(result, queryTokens, normalizedQuery),
      _effectiveTs: parseDateValue(result.effectiveDate),
      _promulgationTs: parseDateValue(result.promulgationDate)
    });
  }

  const rankedGroups = [...groups.values()]
    .map((group) => {
      const uniqueResults = group.results
        .filter((result, index, array) => array.findIndex((item) => item.id === result.id) === index)
        .sort((left, right) => {
          const leftTimeline = left._effectiveTs ?? left._promulgationTs ?? 0;
          const rightTimeline = right._effectiveTs ?? right._promulgationTs ?? 0;

          if (leftTimeline !== rightTimeline) {
            return leftTimeline - rightTimeline;
          }

          return left.id.localeCompare(right.id);
        });

      if (uniqueResults.length < 2) {
        return null;
      }

      const datedResultCount = uniqueResults.filter((item) => item._effectiveTs || item._promulgationTs).length;
      const topScore = Math.max(...uniqueResults.map((item) => item._score));

      return {
        title: group.title,
        jurisdiction: group.jurisdiction,
        results: uniqueResults,
        topScore,
        datedResultCount,
        recommendationScore: topScore + uniqueResults.length + datedResultCount
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.recommendationScore !== right.recommendationScore) {
        return right.recommendationScore - left.recommendationScore;
      }

      const leftLatest = left.results[left.results.length - 1]._effectiveTs ?? left.results[left.results.length - 1]._promulgationTs ?? 0;
      const rightLatest = right.results[right.results.length - 1]._effectiveTs ?? right.results[right.results.length - 1]._promulgationTs ?? 0;

      return rightLatest - leftLatest;
    });

  const selectedGroup = rankedGroups[0];
  if (!selectedGroup) {
    return null;
  }

  const beforeCandidate = selectedGroup.results[selectedGroup.results.length - 2];
  const afterCandidate = selectedGroup.results[selectedGroup.results.length - 1];
  const confidence =
    selectedGroup.datedResultCount >= 2 ? "high" : selectedGroup.datedResultCount === 1 ? "medium" : "low";

  return {
    before: {
      id: beforeCandidate.id,
      title: beforeCandidate.title,
      jurisdiction: beforeCandidate.jurisdiction ?? "",
      effectiveDate: beforeCandidate.effectiveDate ?? "",
      promulgationDate: beforeCandidate.promulgationDate ?? ""
    },
    after: {
      id: afterCandidate.id,
      title: afterCandidate.title,
      jurisdiction: afterCandidate.jurisdiction ?? "",
      effectiveDate: afterCandidate.effectiveDate ?? "",
      promulgationDate: afterCandidate.promulgationDate ?? ""
    },
    confidence,
    matchCount: selectedGroup.results.length,
    reason: buildRecommendationReason({
      title: selectedGroup.title,
      jurisdiction: selectedGroup.jurisdiction,
      datedPairCount: selectedGroup.datedResultCount,
      matchCount: selectedGroup.results.length
    }),
    strategy: "timeline-heuristic"
  };
}

export function resolveLawSourceProvider({
  provider = process.env.LAW_SOURCE_PROVIDER
} = {}) {
  const normalizedProvider = normalizeEnvValue(provider).toLowerCase();
  return normalizedProvider || "local-fixture";
}

export function createLawSource({
  provider = process.env.LAW_SOURCE_PROVIDER,
  koreaLawMcpBaseUrl = process.env.KOREA_LAW_MCP_BASE_URL,
  koreaLawMcpToolName = process.env.KOREA_LAW_MCP_DETAIL_TOOL_NAME,
  koreaLawMcpIdArgumentName = process.env.KOREA_LAW_MCP_ID_ARGUMENT_NAME,
  koreaLawMcpSearchToolName = process.env.KOREA_LAW_MCP_SEARCH_TOOL_NAME,
  koreaLawMcpSearchQueryArgumentName = process.env.KOREA_LAW_MCP_SEARCH_QUERY_ARGUMENT_NAME
} = {}) {
  const resolvedProvider = resolveLawSourceProvider({ provider });

  if (resolvedProvider === "local-fixture") {
    return createLocalFixtureLawSource();
  }

  if (resolvedProvider === "korea-law-mcp") {
    return createKoreaLawMcpSource({
      baseUrl: koreaLawMcpBaseUrl,
      toolName: koreaLawMcpToolName,
      idArgumentName: koreaLawMcpIdArgumentName,
      searchToolName: koreaLawMcpSearchToolName,
      searchQueryArgumentName: koreaLawMcpSearchQueryArgumentName
    });
  }

  return createUnavailableLawSource({
    provider: "unsupported",
    reason: "unsupported_provider"
  });
}

export function getLawSourceStatus(options = {}) {
  return createLawSource(options).getSourceStatus();
}

export async function searchLawSource(options = {}) {
  return createLawSource(options).searchRegulations({
    query: options.query,
    limit: options.limit
  });
}
