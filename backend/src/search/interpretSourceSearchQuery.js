import { requestGeminiJson } from "../ai/geminiJson.js";
import { getMunicipalityNames, normalizeMunicipalityCodes } from "../sources/providers/lawGoMunicipalities.js";

const KOREAN_WORDS = {
  ordinance: "\uC870\uB840",
  municipalOrdinance: "\uC790\uCE58\uBC95\uADDC",
  rule: "\uADDC\uCE59",
  latest: "\uCD5C\uC2E0",
  basic: "\uAE30\uBCF8",
  youth: "\uCCAD\uB144",
  support: "\uC9C0\uC6D0"
};

const SEARCH_STOP_WORDS = new Set([
  KOREAN_WORDS.ordinance,
  KOREAN_WORDS.municipalOrdinance,
  KOREAN_WORDS.rule,
  KOREAN_WORDS.latest,
  "\uC2E4\uC2DC\uAC04",
  "\uC5C5\uB370\uC774\uD2B8",
  "\uAC80\uC0C9",
  "\uCC3E\uC544\uC918",
  "\uCC3E\uAE30",
  "\uBCF4\uC5EC\uC918",
  "\uBE44\uAD50",
  "\uAD00\uB828",
  "\uBB38\uC758",
  "\uB3C4\uC6B0\uBBF8",
  "\uB9AC\uC2A4\uD2B8",
  "\uC790\uB3D9",
  "\uAC80\uC0C9\uD574",
  "\uCC3E\uC544\uC8FC\uC138\uC694",
  "\uCD94\uCC9C",
  "what",
  "find",
  "latest",
  "ordinance",
  "search",
  "compare",
  "show",
  "please",
  "for"
]);

const CHANGE_TAILS = [
  "\uC548\uB0B4\uBB38",
  "\uC548\uB0B4\uC11C",
  "\uAC00\uC774\uB4DC",
  "\uACF5\uACE0",
  "\uBB38\uC11C",
  "\uBCF4\uB3C4\uC790\uB8CC",
  "\uD64D\uBCF4\uBB38",
  "\uCCB4\uD06C\uB9AC\uC2A4\uD2B8"
];

const MUNICIPALITY_QUERY_ALIASES = [
  {
    code: "6110000",
    aliases: ["\uC11C\uC6B8", "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC", "seoul"]
  },
  {
    code: "6260000",
    aliases: ["\uBD80\uC0B0", "\uBD80\uC0B0\uAD11\uC5ED\uC2DC", "busan"]
  },
  {
    code: "6270000",
    aliases: ["\uB300\uAD6C", "\uB300\uAD6C\uAD11\uC5ED\uC2DC", "daegu"]
  },
  {
    code: "6280000",
    aliases: ["\uC778\uCC9C", "\uC778\uCC9C\uAD11\uC5ED\uC2DC", "incheon"]
  },
  {
    code: "6290000",
    aliases: ["\uAD11\uC8FC", "\uAD11\uC8FC\uAD11\uC5ED\uC2DC", "gwangju"]
  },
  {
    code: "6300000",
    aliases: ["\uB300\uC804", "\uB300\uC804\uAD11\uC5ED\uC2DC", "daejeon"]
  },
  {
    code: "5690000",
    aliases: ["\uC138\uC885", "\uC138\uC885\uD2B9\uBCC4\uC790\uCE58\uC2DC", "sejong"]
  },
  {
    code: "6310000",
    aliases: ["\uC6B8\uC0B0", "\uC6B8\uC0B0\uAD11\uC5ED\uC2DC", "ulsan"]
  },
  {
    code: "6410000",
    aliases: ["\uACBD\uAE30", "\uACBD\uAE30\uB3C4", "gyeonggi"]
  },
  {
    code: "6530000",
    aliases: ["\uAC15\uC6D0", "\uAC15\uC6D0\uD2B9\uBCC4\uC790\uCE58\uB3C4", "gangwon"]
  },
  {
    code: "6430000",
    aliases: ["\uCDA9\uBD81", "\uCDA9\uCCAD\uBD81\uB3C4", "chungbuk"]
  },
  {
    code: "6440000",
    aliases: ["\uCDA9\uB0A8", "\uCDA9\uCCAD\uB0A8\uB3C4", "chungnam"]
  },
  {
    code: "6540000",
    aliases: ["\uC804\uBD81", "\uC804\uBD81\uD2B9\uBCC4\uC790\uCE58\uB3C4", "jeonbuk"]
  },
  {
    code: "6460000",
    aliases: ["\uC804\uB0A8", "\uC804\uB77C\uB0A8\uB3C4", "jeonnam"]
  },
  {
    code: "6470000",
    aliases: ["\uACBD\uBD81", "\uACBD\uC0C1\uBD81\uB3C4", "gyeongbuk"]
  },
  {
    code: "6480000",
    aliases: ["\uACBD\uB0A8", "\uACBD\uC0C1\uB0A8\uB3C4", "gyeongnam"]
  },
  {
    code: "6500000",
    aliases: ["\uC81C\uC8FC", "\uC81C\uC8FC\uD2B9\uBCC4\uC790\uCE58\uB3C4", "jeju"]
  },
  {
    code: "6550000",
    aliases: ["\uCDA9\uCCAD\uAD8C", "\uCDA9\uCCAD\uAD8C\uC5F0\uD569", "regional-union"]
  }
];

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

function tokenize(value) {
  return normalizeLookupText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !SEARCH_STOP_WORDS.has(token));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeKeywordValues(values = []) {
  return unique(
    (Array.isArray(values) ? values : [])
      .flatMap((value) => tokenize(value))
      .filter(Boolean)
  ).slice(0, 8);
}

function normalizeExpandedQueries(values = []) {
  return unique(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeText(value).replace(/\s+/g, " ").trim())
      .filter((value) => tokenize(value).length > 0)
  ).slice(0, 4);
}

function extractMunicipalityMatches(query) {
  const lookup = normalizeLookupText(query);
  if (!lookup) {
    return {
      codes: [],
      aliases: []
    };
  }

  const codes = [];
  const aliases = [];

  for (const municipality of MUNICIPALITY_QUERY_ALIASES) {
    const matchedAlias = municipality.aliases.find((alias) => lookup.includes(normalizeLookupText(alias)));
    if (!matchedAlias) {
      continue;
    }

    codes.push(municipality.code);
    aliases.push(matchedAlias);
  }

  return {
    codes: normalizeMunicipalityCodes(codes),
    aliases: unique(aliases)
  };
}

function stripMunicipalityMentions(query, aliases = []) {
  let cleaned = normalizeText(query);

  for (const alias of aliases) {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias) {
      continue;
    }
    cleaned = cleaned.replace(new RegExp(escapeRegExp(normalizedAlias), "giu"), " ");
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

function stripDocumentTail(query) {
  let cleaned = normalizeText(query);

  for (const suffix of CHANGE_TAILS) {
    cleaned = cleaned.replace(new RegExp(escapeRegExp(suffix), "gu"), " ");
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

function buildHeuristicExpandedQueries(baseQuery, keywords = []) {
  const seeds = unique([
    normalizeText(baseQuery),
    keywords.join(" "),
    keywords.slice(0, 2).join(" "),
    keywords.slice(0, 3).join(" ")
  ]).filter((value) => tokenize(value).length > 0);

  return unique(
    seeds.flatMap((seed) => [
      seed,
      `${seed} ${KOREAN_WORDS.ordinance}`.trim(),
      `${seed} ${KOREAN_WORDS.basic} ${KOREAN_WORDS.ordinance}`.trim(),
      `${seed} ${KOREAN_WORDS.support} ${KOREAN_WORDS.ordinance}`.trim()
    ])
  )
    .filter((value) => tokenize(value).length > 0)
    .slice(0, 4);
}

function buildHeuristicInterpretation(query, selectedMunicipalities = []) {
  const normalizedQuery = normalizeText(query);
  const municipalityMatch = extractMunicipalityMatches(normalizedQuery);
  const strippedMunicipalityQuery = stripMunicipalityMentions(normalizedQuery, municipalityMatch.aliases);
  const cleanedQuery = stripDocumentTail(strippedMunicipalityQuery);
  const keywords = normalizeKeywordValues([cleanedQuery]);
  const municipalityCodes = normalizeMunicipalityCodes([
    ...selectedMunicipalities,
    ...municipalityMatch.codes
  ]);
  const municipalityNames = getMunicipalityNames(municipalityCodes);
  const searchQuery = unique([
    cleanedQuery,
    keywords.join(" "),
    normalizedQuery
  ]).find((value) => tokenize(value).length > 0) || normalizedQuery;
  const expandedQueries = buildHeuristicExpandedQueries(searchQuery, keywords);

  return {
    originalQuery: normalizedQuery,
    searchQuery,
    keywords,
    expandedQueries,
    municipalityCodes,
    municipalityNames,
    explicitMunicipalityCodes: municipalityMatch.codes,
    explicitMunicipalityNames: getMunicipalityNames(municipalityMatch.codes),
    reasoning:
      municipalityMatch.codes.length > 0
        ? "The query explicitly mentions one or more municipalities, so the search scope was narrowed before ordinance lookup."
        : "The query was normalized into a short ordinance-title lookup and keyword set before searching."
  };
}

function buildInterpretationPrompt(query, municipalityNames = []) {
  return [
    "You rewrite a natural-language Korean ordinance search request into structured ordinance search instructions.",
    "Return JSON only with these keys:",
    "searchQuery, municipalityHints, keywords, expandedQueries, reasoning",
    "Requirements:",
    "- searchQuery must be a short Korean ordinance-title search query.",
    "- municipalityHints must contain only municipality names that are explicit in the user query or strongly implied by it.",
    "- keywords must be short Korean ordinance-search keywords.",
    "- expandedQueries must contain up to 4 alternate Korean search queries.",
    "- Do not invent municipalities unrelated to the query.",
    "- Prefer ordinance-title wording over full natural-language sentences.",
    "",
    `Selected municipality hints from the UI: ${JSON.stringify(municipalityNames)}`,
    `User query: ${query}`
  ].join("\n");
}

export async function interpretSourceSearchQuery(
  {
    query,
    municipalities = []
  },
  {
    env = process.env,
    fetchImpl = globalThis.fetch
  } = {}
) {
  const heuristic = buildHeuristicInterpretation(query, municipalities);
  const aiResult = await requestGeminiJson(
    buildInterpretationPrompt(heuristic.originalQuery, heuristic.municipalityNames),
    {
      env,
      fetchImpl,
      temperature: 0.1
    }
  );

  const payload = aiResult.value && typeof aiResult.value === "object" ? aiResult.value : {};
  const aiMunicipalityCodes = normalizeMunicipalityCodes(payload.municipalityHints ?? []);
  const municipalityCodes = normalizeMunicipalityCodes([
    ...heuristic.municipalityCodes,
    ...aiMunicipalityCodes
  ]);
  const municipalityNames = getMunicipalityNames(municipalityCodes);
  const searchQuery = normalizeText(payload.searchQuery) || heuristic.searchQuery;
  const keywords = unique([
    ...heuristic.keywords,
    ...normalizeKeywordValues(payload.keywords ?? [])
  ]).slice(0, 8);
  const expandedQueries = unique([
    ...normalizeExpandedQueries(payload.expandedQueries),
    ...heuristic.expandedQueries
  ])
    .filter((entry) => normalizeLookupText(entry) !== normalizeLookupText(searchQuery))
    .slice(0, 4);

  return {
    originalQuery: heuristic.originalQuery,
    searchQuery,
    keywords,
    expandedQueries,
    municipalityCodes,
    municipalityNames,
    explicitMunicipalityCodes: heuristic.explicitMunicipalityCodes,
    explicitMunicipalityNames: heuristic.explicitMunicipalityNames,
    reasoning: normalizeText(payload.reasoning) || heuristic.reasoning,
    ai: aiResult.meta
  };
}

function scoreMunicipalityMatch(result, municipalityNames = []) {
  const jurisdiction = normalizeLookupText(result?.jurisdiction);
  const title = normalizeLookupText(result?.title);
  if (!municipalityNames.length) {
    return 0;
  }

  return municipalityNames.some((name) => {
    const normalizedName = normalizeLookupText(name);
    return normalizedName && (jurisdiction.includes(normalizedName) || title.includes(normalizedName));
  })
    ? 32
    : 0;
}

function scoreKeywordMatch(result, keywords = []) {
  const title = normalizeLookupText(result?.title);
  const summary = normalizeLookupText(result?.summary);
  const body = `${title} ${summary}`;
  let score = 0;

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeLookupText(keyword);
    if (!normalizedKeyword) {
      continue;
    }

    if (title === normalizedKeyword) {
      score += 60;
      continue;
    }
    if (title.includes(normalizedKeyword)) {
      score += 24;
      continue;
    }
    if (body.includes(normalizedKeyword)) {
      score += 10;
    }
  }

  return score;
}

function scoreQueryMatch(result, query) {
  const normalizedQuery = normalizeLookupText(query);
  const title = normalizeLookupText(result?.title);
  if (!normalizedQuery || !title) {
    return 0;
  }
  if (title === normalizedQuery) {
    return 80;
  }
  if (title.includes(normalizedQuery) || normalizedQuery.includes(title)) {
    return 46;
  }
  return 0;
}

function dedupeKeyForResult(result = {}) {
  return normalizeText(result.id) || normalizeText(result.referenceUrl) || normalizeLookupText(`${result.title} ${result.jurisdiction}`);
}

export function rankInterpretedSearchResults({
  interpretation,
  searchBatches = [],
  limit = 8
} = {}) {
  const candidates = new Map();
  const allQueries = unique([
    interpretation?.searchQuery,
    ...(interpretation?.expandedQueries ?? [])
  ]);

  searchBatches.forEach((batch, batchIndex) => {
    const query = batch?.query ?? allQueries[batchIndex] ?? "";
    const results = Array.isArray(batch?.results) ? batch.results : [];

    results.forEach((result, resultIndex) => {
      const key = dedupeKeyForResult(result);
      if (!key) {
        return;
      }

      const score =
        scoreQueryMatch(result, interpretation?.searchQuery) +
        scoreQueryMatch(result, query) +
        scoreMunicipalityMatch(result, interpretation?.municipalityNames ?? []) +
        scoreKeywordMatch(result, interpretation?.keywords ?? []) +
        Math.max(0, 18 - batchIndex * 3 - resultIndex);

      const previous = candidates.get(key);
      if (!previous || score > previous.score) {
        candidates.set(key, {
          result,
          score
        });
      }
    });
  });

  return [...candidates.values()]
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      return normalizeLookupText(left.result?.title).localeCompare(normalizeLookupText(right.result?.title), "ko");
    })
    .slice(0, limit)
    .map((entry) => entry.result);
}
