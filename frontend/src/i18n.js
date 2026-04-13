export const DEFAULT_LOCALE = "ko";
export const SUPPORTED_LOCALES = ["ko", "en"];

const KO_COPY = {
  meta: {
    htmlLang: "ko",
    title: "AI-Rookie 대시보드"
  },
  locale: {
    ko: "한국어",
    en: "English",
    ariaLabel: "언어 전환"
  },
  hero: {
    eyebrow: "지자체 개정 코파일럿",
    title: "규정 변경 대응 대시보드",
    copy: "조례 개정 흐름을 빠르게 점검하고, 어떤 문서가 함께 바뀌어야 하는지 찾은 뒤, 후속 공지 초안까지 바로 검토할 수 있도록 구성했습니다."
  },
  guide: {
    eyebrow: "빠른 시작",
    title: "처음 쓰는 사용자를 위한 3단계",
    subtitle: "기본은 샘플 체험입니다. 실제 조례 조회는 아래에서 모드를 바꾸면 됩니다.",
    sampleShortcut: "샘플 케이스로 바로 시작",
    liveShortcut: "실제 조례 조회로 전환",
    steps: [
      {
        title: "케이스 또는 조회 모드 선택",
        body: "처음에는 샘플 체험 모드에서 케이스 팩 하나를 고르면 됩니다."
      },
      {
        title: "필요하면 조례명 검색",
        body: "실제 조례 조회 모드에서는 조례명을 검색하고 추천 before/after 조합을 바로 적용할 수 있습니다."
      },
      {
        title: "분석 실행 후 결과 확인",
        body: "변경 요약, 영향 문서, 위험 우선순위, 초안 미리보기를 순서대로 확인하면 됩니다."
      }
    ]
  },
  source: {
    eyebrow: "입력 경로",
    title: "분석 설정",
    sampleTab: "샘플 체험",
    liveTab: "실제 조례 조회",
    sampleSummary: "현재 샘플 체험 모드입니다. 케이스를 고르고 바로 분석하세요.",
    liveSummary: "현재 실제 조례 조회 모드입니다. 조례명을 검색한 뒤 추천 조합 또는 before/after ID를 사용하세요.",
    sampleTitle: "샘플 케이스로 바로 체험",
    sampleBody: "번들 사례 팩을 선택하면 즉시 분석할 수 있습니다. ID 입력이 필요 없습니다.",
    liveTitle: "실제 조례를 찾아 분석",
    liveBody: "조례명을 검색해 추천 pair를 적용하거나, 이미 아는 before/after 조례 ID를 직접 입력할 수 있습니다.",
    providerLabel: "조회 제공자",
    caseLabel: "케이스 팩",
    searchLabel: "조례명 검색",
    searchPlaceholder: "예: 서울특별시 청년 기본 조례",
    beforeLabel: "이전 버전 ID",
    beforePlaceholder: "예: 1840746",
    afterLabel: "개정 버전 ID",
    afterPlaceholder: "예: 1840747",
    searchHint: "조례명을 검색하면 사용할 수 있는 ID 후보와 추천 조합을 보여줍니다.",
    advancedSummary: "고급 설정과 출처 확인",
    advancedBody: "provider 상태, live probe, 검색 provenance, 최근 분석 입력 정보를 확인할 수 있습니다.",
    liveUnavailable: "실제 조례 조회를 쓰기 전에 provider 설정 상태를 확인하세요.",
    localHint: "샘플 모드에서는 번들 케이스만 사용합니다. 가장 쉬운 데모 경로입니다."
  },
  sections: {
    summaryTitle: "변경 요약",
    summaryNote: "무엇이 바뀌었는지 조항 단위로 정리합니다.",
    impactTitle: "영향 문서",
    impactNote: "함께 갱신해야 할 내부 문서를 우선순위와 함께 보여줍니다.",
    riskTitle: "위험 우선순위",
    riskNote: "대민 안내 오류 가능성이 큰 항목부터 먼저 확인하세요.",
    draftTitle: "초안 미리보기",
    draftNote: "내부 공지, 시민 안내문, FAQ, 비교표를 한 번에 검토할 수 있습니다.",
    draftLanguageNote: "분석 결과 본문은 현재 소스 문구 언어를 그대로 유지합니다."
  },
  provenance: {
    title: "출처 추적",
    subtitle: "provider 설정, 검색 경로, 최근 분석 입력을 한 곳에서 확인합니다.",
    empty: "아직 수집된 출처 정보가 없습니다.",
    selectedSource: "선택한 소스",
    searchRoute: "검색 경로",
    lastAnalysis: "최근 분석",
    fields: {
      provider: "제공자",
      enabled: "구성 여부",
      baseUrl: "기본 URL",
      endpoint: "엔드포인트",
      ocMode: "검색 인증",
      casePack: "케이스 팩",
      probe: "라이브 Probe",
      availableToolCount: "감지된 도구 수",
      detailTool: "상세 도구",
      searchTool: "검색 도구",
      missingEnv: "누락 환경변수",
      status: "상태",
      route: "경로",
      queryVariants: "질의 변형",
      recommendation: "추천 조합",
      historyExpanded: "연혁 확장",
      curatedFallback: "큐레이션 보정",
      exactTitleMatchCount: "정확 제목 일치",
      resultCount: "결과 수",
      pair: "이전 -> 개정",
      tool: "도구",
      beforeUrl: "이전 URL",
      afterUrl: "개정 URL",
      runId: "저장 실행 ID"
    }
  },
  history: {
    detailsSummary: "최근 실행 이력 보기",
    title: "최근 실행 이력",
    subtitle: "저장된 분석 결과를 다시 열어볼 수 있습니다.",
    itemMeta: (totalChanges, highRiskCount) => `변경 ${totalChanges}건 | 고위험 ${highRiskCount}건`,
    emptyBreakdown: "변경 유형 요약이 없습니다."
  },
  buttons: {
    runSample: "샘플 케이스 분석하기",
    runLive: "선택한 조례 분석하기",
    running: "분석 중...",
    search: "ID 찾기",
    searching: "검색 중...",
    applyRecommendation: "추천 조합 적용",
    useAsBefore: "이전 버전으로 사용",
    useAsAfter: "개정 버전으로 사용"
  },
  search: {
    recommendationTitle: "추천 조합",
    recommendationFallbackReason: "날짜와 제목 기준으로 가장 자연스러운 before/after 조합을 준비했습니다.",
    confidence: "신뢰도",
    matchCount: "매치 수",
    strategy: "전략",
    beforeVersion: "이전 버전",
    afterVersion: "개정 버전",
    idLabel: "ID",
    sourceLabel: "출처",
    referenceMissing: "출처 URL이 없습니다.",
    noResults: "현재 검색어에 해당하는 조례 후보가 없습니다.",
    curatedFallback: "큐레이션 보정"
  },
  result: {
    emptySummary: "감지된 변경이 없습니다.",
    emptyImpact: "영향을 받는 내부 문서가 없습니다.",
    emptyRisk: "분류된 위험이 없습니다.",
    emptyDraft: "생성된 초안이 없습니다.",
    noMappedDocuments: "매핑된 문서 없음",
    draftSectionLabels: {
      internalNoticeDraft: "내부 공지 초안",
      citizenGuideDraft: "시민 안내문 초안",
      faqDraft: "FAQ 초안",
      comparisonTable: "비교표"
    }
  },
  labels: {
    yes: "예",
    no: "아니오",
    unknown: "미확인",
    notAvailable: "해당 없음",
    loading: "불러오는 중...",
    directInput: "직접 입력",
    effectiveDate: "시행",
    promulgationDate: "공포",
    noTimeline: "조례 날짜 메타데이터가 없습니다."
  },
  providers: {
    "local-fixture": "로컬 샘플",
    "law-go-public": "law.go.kr 공개",
    "korea-law-mcp": "Korea Law MCP",
    inline: "직접 입력"
  },
  changeTypes: {
    요건: "요건",
    서류: "서류",
    기한: "기한",
    금액: "금액",
    기타: "기타"
  },
  riskLevels: {
    빨강: "빨강",
    노랑: "노랑",
    파랑: "파랑"
  },
  messages: {
    ready: "준비됨.",
    runningAnalysis: "조례 변경을 분석하는 중...",
    analysisSuccess: (count) => `분석이 완료되었습니다. ${count}개의 변경이 감지되었습니다.`,
    analysisFailure: (message) => `분석에 실패했습니다: ${message}`,
    sourceStatusLoading: "선택한 소스 상태를 확인하는 중...",
    sourceConfigured: (provider) => `${provider}가 연결되어 있습니다.`,
    sourceNotConfigured: (provider, detail = "") => `${provider}는 아직 설정되지 않았습니다.${detail ? ` ${detail}` : ""}`,
    sampleReady: "번들 케이스를 바로 분석할 수 있습니다.",
    sampleHelp: (title, municipality) =>
      title
        ? `"${title}"${municipality ? ` (${municipality})` : ""} 케이스를 선택했습니다. 별도 ID 없이 바로 분석할 수 있습니다.`
        : "번들 케이스를 선택하면 별도 ID 없이 바로 분석할 수 있습니다.",
    liveLawHelp: "law.go.kr 공개 검색을 사용합니다. 검색 결과가 부족하면 조례 ID를 직접 입력하세요.",
    liveMcpHelp: "Korea Law MCP endpoint가 켜져 있으면 검색 후 추천 pair를 바로 적용할 수 있습니다.",
    sourceSearchReady: "조례명을 검색하거나 이미 아는 before/after ID를 입력하세요.",
    sourceSearchUnavailable: "샘플 모드에서는 조례 검색이 필요하지 않습니다.",
    sourceSearchNeedQuery: "검색 전에 조례명 또는 키워드를 입력하세요.",
    sourceSearchLoading: "조례 후보를 검색하는 중...",
    sourceSearchLoaded: (count, hasRecommendation) =>
      hasRecommendation ? `${count}개의 후보와 추천 조합을 불러왔습니다.` : `${count}개의 후보를 불러왔습니다.`,
    sourceSearchFailure: (message) => `검색에 실패했습니다: ${message}`,
    recommendationApplied: (beforeId, afterId) => `추천 조합을 적용했습니다: ${beforeId} -> ${afterId}.`,
    selectedBefore: (id) => `${id}를 이전 버전 ID로 선택했습니다.`,
    selectedAfter: (id) => `${id}를 개정 버전 ID로 선택했습니다.`,
    historyLoading: "분석 이력을 불러오는 중...",
    historyLoadFailure: (message) => `분석 이력을 불러오지 못했습니다: ${message}`,
    historyStorageDisabled: (provider) => `${provider} 저장소가 아직 설정되지 않았습니다.`,
    historyWaiting: (provider) => `${provider} 저장소는 연결되었지만 아직 저장된 분석이 없습니다.`,
    historyLoaded: (provider, count) => `${provider} 저장소에서 최근 ${count}건을 불러왔습니다.`,
    livePairRequired: (provider) => `${provider}는 이전 ID와 개정 ID가 모두 필요합니다.`,
    probeUnavailable: "미확인",
    probeSuccess: "접속 가능",
    probeFailure: (error) => `실패 (${error || "알 수 없는 오류"})`,
    ocEnv: "설정된 LAW_GO_OC",
    ocDemo: "데모 LAW_GO_OC=test",
    notSearchedYet: "아직 검색하지 않음",
    metadataLoaded: "검색 메타데이터 로드됨",
    recommendationAvailable: "있음",
    recommendationMissing: "없음",
    expansionYes: "예",
    expansionNo: "아니오"
  }
};

const EN_COPY = {
  meta: {
    htmlLang: "en",
    title: "AI-Rookie Dashboard"
  },
  locale: {
    ko: "한국어",
    en: "English",
    ariaLabel: "Language switch"
  },
  hero: {
    eyebrow: "Municipal Change Copilot",
    title: "Regulation Change Response Dashboard",
    copy: "Review ordinance updates, find which internal documents are affected, and move directly into follow-up draft review."
  },
  guide: {
    eyebrow: "Quick Start",
    title: "Three steps for first-time users",
    subtitle: "The default path is the sample experience. Switch modes below when you want to use live ordinance lookup.",
    sampleShortcut: "Start with sample cases",
    liveShortcut: "Switch to live ordinance lookup",
    steps: [
      {
        title: "Choose a case or lookup mode",
        body: "Start with Sample Mode and pick one bundled case pack."
      },
      {
        title: "Search an ordinance name if needed",
        body: "In Live Lookup Mode, search an ordinance title and apply the recommended before/after pair."
      },
      {
        title: "Run analysis and review outputs",
        body: "Read the change summary, impacted documents, risk priority, and generated drafts in order."
      }
    ]
  },
  source: {
    eyebrow: "Input Path",
    title: "Analysis Setup",
    sampleTab: "Sample Mode",
    liveTab: "Live Lookup",
    sampleSummary: "You are in Sample Mode. Pick a case and run analysis immediately.",
    liveSummary: "You are in Live Lookup Mode. Search an ordinance title, then use the recommended pair or enter before/after IDs.",
    sampleTitle: "Try a bundled sample case",
    sampleBody: "Pick a bundled municipality scenario and run analysis immediately. No IDs are required.",
    liveTitle: "Analyze a real ordinance",
    liveBody: "Search the ordinance title, apply a recommended pair, or enter known before/after ordinance IDs directly.",
    providerLabel: "Lookup Provider",
    caseLabel: "Case Pack",
    searchLabel: "Ordinance Search",
    searchPlaceholder: "Example: Seoul Youth Basic Ordinance",
    beforeLabel: "Before Version ID",
    beforePlaceholder: "Example: 1840746",
    afterLabel: "After Version ID",
    afterPlaceholder: "Example: 1840747",
    searchHint: "Search by ordinance title to see candidate IDs and a recommended pair.",
    advancedSummary: "Advanced settings and provenance",
    advancedBody: "Check provider status, live probe results, search provenance, and the latest analysis input.",
    liveUnavailable: "Check provider configuration before using live ordinance lookup.",
    localHint: "Sample Mode uses bundled local cases only. This is the easiest demo path."
  },
  sections: {
    summaryTitle: "Change Summary",
    summaryNote: "See what changed, organized by clause.",
    impactTitle: "Impacted Documents",
    impactNote: "Review which internal documents should be updated together.",
    riskTitle: "Risk Priority",
    riskNote: "Start with items most likely to cause public-facing guidance errors.",
    draftTitle: "Draft Preview",
    draftNote: "Review internal notice, citizen guide, FAQ, and comparison output together.",
    draftLanguageNote: "The analysis body keeps the source text language used by the current case or provider."
  },
  provenance: {
    title: "Source Provenance",
    subtitle: "Review provider setup, search route, and the latest analysis input in one place.",
    empty: "No provenance information has been collected yet.",
    selectedSource: "Selected Source",
    searchRoute: "Search Route",
    lastAnalysis: "Latest Analysis",
    fields: {
      provider: "Provider",
      enabled: "Configured",
      baseUrl: "Base URL",
      endpoint: "Endpoint",
      ocMode: "Search Auth",
      casePack: "Case Pack",
      probe: "Live Probe",
      availableToolCount: "Detected Tools",
      detailTool: "Detail Tool",
      searchTool: "Search Tool",
      missingEnv: "Missing Env",
      status: "Status",
      route: "Route",
      queryVariants: "Query Variants",
      recommendation: "Recommendation",
      historyExpanded: "History Expanded",
      curatedFallback: "Curated Fallback",
      exactTitleMatchCount: "Exact Title Hits",
      resultCount: "Result Count",
      pair: "Before -> After",
      tool: "Tool",
      beforeUrl: "Before URL",
      afterUrl: "After URL",
      runId: "Stored Run ID"
    }
  },
  history: {
    detailsSummary: "Show recent runs",
    title: "Recent Runs",
    subtitle: "Reload saved analysis results from storage.",
    itemMeta: (totalChanges, highRiskCount) => `Changes ${totalChanges} | High risk ${highRiskCount}`,
    emptyBreakdown: "No change-type breakdown is available."
  },
  buttons: {
    runSample: "Analyze Sample Case",
    runLive: "Analyze Selected Ordinance",
    running: "Analyzing...",
    search: "Find IDs",
    searching: "Searching...",
    applyRecommendation: "Use recommended pair",
    useAsBefore: "Use as before",
    useAsAfter: "Use as after"
  },
  search: {
    recommendationTitle: "Recommended Pair",
    recommendationFallbackReason: "This is the most plausible before/after pair based on title and date metadata.",
    confidence: "Confidence",
    matchCount: "Matches",
    strategy: "Strategy",
    beforeVersion: "Before",
    afterVersion: "After",
    idLabel: "ID",
    sourceLabel: "Source",
    referenceMissing: "No source URL is available.",
    noResults: "No ordinance candidates matched the current query.",
    curatedFallback: "Curated fallback"
  },
  result: {
    emptySummary: "No changes were detected.",
    emptyImpact: "No impacted internal documents were found.",
    emptyRisk: "No risks were classified.",
    emptyDraft: "No draft output was generated.",
    noMappedDocuments: "No mapped documents",
    draftSectionLabels: {
      internalNoticeDraft: "Internal Notice Draft",
      citizenGuideDraft: "Citizen Guide Draft",
      faqDraft: "FAQ Draft",
      comparisonTable: "Comparison Table"
    }
  },
  labels: {
    yes: "Yes",
    no: "No",
    unknown: "Unknown",
    notAvailable: "N/A",
    loading: "Loading...",
    directInput: "Inline Input",
    effectiveDate: "Effective",
    promulgationDate: "Promulgated",
    noTimeline: "No ordinance date metadata is available."
  },
  providers: {
    "local-fixture": "Local Fixture",
    "law-go-public": "law.go.kr Public",
    "korea-law-mcp": "Korea Law MCP",
    inline: "Inline Input"
  },
  changeTypes: {
    요건: "Eligibility",
    서류: "Documents",
    기한: "Deadline",
    금액: "Amount",
    기타: "Other"
  },
  riskLevels: {
    빨강: "High",
    노랑: "Medium",
    파랑: "Low"
  },
  messages: {
    ready: "Ready.",
    runningAnalysis: "Analyzing ordinance changes...",
    analysisSuccess: (count) => `Analysis completed. Detected ${count} changes.`,
    analysisFailure: (message) => `Analysis failed: ${message}`,
    sourceStatusLoading: "Checking the selected source status...",
    sourceConfigured: (provider) => `${provider} is available.`,
    sourceNotConfigured: (provider, detail = "") => `${provider} is not configured yet.${detail ? ` ${detail}` : ""}`,
    sampleReady: "Bundled sample cases are ready to analyze.",
    sampleHelp: (title, municipality) =>
      title
        ? `Selected case: "${title}"${municipality ? ` (${municipality})` : ""}. You can run analysis immediately without entering IDs.`
        : "Choose a bundled case to run analysis without entering IDs.",
    liveLawHelp: "Uses public law.go.kr search. If search results are incomplete, enter ordinance IDs directly.",
    liveMcpHelp: "If the Korea Law MCP endpoint is running, you can search and apply a recommended pair directly.",
    sourceSearchReady: "Search an ordinance title or enter known before/after IDs.",
    sourceSearchUnavailable: "Search is not needed in Sample Mode.",
    sourceSearchNeedQuery: "Enter an ordinance title or keyword before searching.",
    sourceSearchLoading: "Searching ordinance candidates...",
    sourceSearchLoaded: (count, hasRecommendation) =>
      hasRecommendation ? `Loaded ${count} candidates and a recommended pair.` : `Loaded ${count} candidates.`,
    sourceSearchFailure: (message) => `Search failed: ${message}`,
    recommendationApplied: (beforeId, afterId) => `Applied recommended pair: ${beforeId} -> ${afterId}.`,
    selectedBefore: (id) => `Selected ${id} as the before ID.`,
    selectedAfter: (id) => `Selected ${id} as the after ID.`,
    historyLoading: "Loading analysis history...",
    historyLoadFailure: (message) => `Could not load analysis history: ${message}`,
    historyStorageDisabled: (provider) => `${provider} storage is not configured yet.`,
    historyWaiting: (provider) => `${provider} storage is connected, but no saved runs exist yet.`,
    historyLoaded: (provider, count) => `Loaded ${count} recent runs from ${provider} storage.`,
    livePairRequired: (provider) => `${provider} requires both before and after IDs.`,
    probeUnavailable: "Unknown",
    probeSuccess: "Reachable",
    probeFailure: (error) => `Failed (${error || "unknown error"})`,
    ocEnv: "Configured LAW_GO_OC",
    ocDemo: "Demo LAW_GO_OC=test",
    notSearchedYet: "Not searched yet",
    metadataLoaded: "Search metadata loaded",
    recommendationAvailable: "Available",
    recommendationMissing: "Missing",
    expansionYes: "Yes",
    expansionNo: "No"
  }
};

const COPY = {
  ko: KO_COPY,
  en: EN_COPY
};

function resolvePath(source, path) {
  return path.split(".").reduce((value, key) => value?.[key], source);
}

export function getCopy(locale = DEFAULT_LOCALE) {
  return COPY[locale] ?? COPY[DEFAULT_LOCALE];
}

export function getMessage(locale, path) {
  const value = resolvePath(getCopy(locale), path);
  return typeof value === "string" ? value : "";
}
