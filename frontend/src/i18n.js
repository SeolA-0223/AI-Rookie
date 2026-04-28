export const DEFAULT_LOCALE = "ko";
export const SUPPORTED_LOCALES = ["ko", "en"];

const KO_COPY = {
  meta: {
    htmlLang: "ko",
    title: "AI-Rookie 조례 대응 대시보드"
  },
  locale: {
    ko: "한국어",
    en: "English",
    ariaLabel: "언어 전환"
  },
  hero: {
    eyebrow: "Municipal Ordinance Copilot",
    title: "AI를 활용한\n지자체 조례 변경 대응 도우미",
    copy: "조례 검색, 최신 조례 열람, 내부 문서 검사와 수정 초안 생성을 한 화면에서 연결합니다."
  },
  pages: {
    search: "조례 검색",
    inspect: "문서 검사"
  },
  binder: {
    kicker: "AI-Rookie / Ordinance Binder",
    footerSearch: "탭을 눌러 페이지를 전환하고 조례 검색 또는 문서 검사를 진행하세요.",
    footerInspect: "문서를 넣고 Gemini 검사 결과와 최신 조례 반영 수정본을 검토하세요."
  },
  guide: {
    eyebrow: "빠른 시작",
    title: "처음 쓰는 사용자를 위한 3단계",
    subtitle: "조례 검색 페이지에서 조례를 찾고, 문서 검사 페이지에서 최신 조례 기준으로 문서를 점검할 수 있습니다.",
    sampleShortcut: "샘플 케이스로 시작",
    liveShortcut: "실제 조례 찾기",
    steps: [
      {
        title: "샘플 또는 실제 조회 모드 선택",
        body: "샘플 케이스로 바로 구조를 이해하거나, 실제 조례 조회 모드에서 조례명을 검색합니다."
      },
      {
        title: "지자체와 최신 조례 확인",
        body: "체크박스로 지자체를 좁히고 최신 공포 순 리스트에서 개정 조례를 빠르게 확인합니다."
      },
      {
        title: "문서 검사로 수정 초안 생성",
        body: "안내문이나 내부 문서를 넣으면 Gemini가 적용 조례를 판단하고 최신 조례 기준 수정안을 만듭니다."
      }
    ]
  },
  source: {
    eyebrow: "조례 검색",
    title: "조례 조회와 변경 비교",
    sampleTab: "샘플 체험",
    liveTab: "실제 조례 조회",
    sampleSummary: "샘플 케이스를 바로 실행해 변경 탐지, 영향 문서, 위험 우선순위 흐름을 확인할 수 있습니다.",
    liveSummary: "실제 조례명을 검색하면 추천된 이전/개정 버전을 바로 선택해 비교 분석할 수 있습니다.",
    sampleTitle: "샘플 케이스 비교",
    sampleBody: "번들 케이스를 선택하면 별도 버전 선택 없이 바로 조례 변경 분석을 실행합니다.",
    liveTitle: "실제 조례 조회와 pair 비교",
    liveBody: "조례명 일부 키워드를 입력하면 자동으로 후보를 찾고, 지자체 선택과 최신 조례 목록을 함께 써서 범위를 좁힐 수 있습니다.",
    providerLabel: "조회 소스",
    caseLabel: "샘플 케이스",
    searchLabel: "조례명 검색",
    searchPlaceholder: "예: 서울 청년 기본 / 대전 청년 지원",
    beforeLabel: "이전 버전 선택",
    beforePlaceholder: "검색 결과나 추천 조합에서 자동 선택됩니다.",
    afterLabel: "개정 버전 선택",
    afterPlaceholder: "검색 결과나 추천 조합에서 자동 선택됩니다.",
    searchHint: "조례명 일부 키워드를 2글자 이상 입력하면 자동으로 후보를 찾고, 추천 pair가 있으면 아래 버전 선택칸에 자동 반영합니다.",
    municipalityTitle: "지자체 선택",
    latestHint: "지자체 체크박스는 조례명 검색과 최신 공포 조례 리스트에 함께 적용됩니다.",
    advancedSummary: "고급 설정과 출처 추적",
    advancedBody: "provider 상태, live probe, 검색 provenance, 최근 분석 입력을 확인합니다.",
    liveUnavailable: "실제 조례 조회 전에 provider 연결 상태를 확인하세요.",
    localHint: "샘플 모드에서는 번들 케이스만 사용합니다.",
    searchAnalyzeTitle: "선택한 조례 pair 비교",
    searchAnalyzeBody: "검색 결과에서 before/after를 채운 뒤 조례 변경 분석을 실행합니다."
  },
  sections: {
    summaryTitle: "변경 요약",
    summaryNote: "무엇이 달라졌는지 조항 단위로 정리합니다.",
    impactTitle: "영향 문서",
    impactNote: "같이 수정해야 할 내부 문서를 우선순위와 함께 보여줍니다.",
    riskTitle: "위험 우선순위",
    riskNote: "대민 안내 오류 가능성이 높은 항목부터 확인합니다.",
    draftTitle: "비교 결과 초안",
    draftNote: "내부 공지, 시민 안내문, FAQ, 비교표 초안을 같이 검토합니다.",
    draftLanguageNote: "조례 비교 초안은 현재 분석 입력과 생성 결과를 기준으로 표시됩니다."
  },
  provenance: {
    title: "출처 추적",
    subtitle: "provider 설정, 검색 경로, 최신 목록, 최근 분석 입력을 한 번에 확인합니다.",
    empty: "아직 수집된 출처 정보가 없습니다.",
    selectedSource: "선택한 소스",
    searchRoute: "검색과 최신 목록",
    lastAnalysis: "최근 조례 비교",
    fields: {
      provider: "Provider",
      enabled: "구성 여부",
      baseUrl: "기본 URL",
      endpoint: "엔드포인트",
      ocMode: "검색 인증",
      casePack: "케이스",
      probe: "Live Probe",
      availableToolCount: "확인된 Tool 수",
      detailTool: "상세 Tool",
      searchTool: "검색 Tool",
      missingEnv: "누락 환경변수",
      status: "상태",
      route: "경로",
      queryVariants: "쿼리 변형",
      recommendation: "추천 조합",
      historyExpanded: "연혁 확장",
      curatedFallback: "큐레이션 보정",
      exactTitleMatchCount: "정확 일치 수",
      resultCount: "검색 결과 수",
      latestSort: "최신 정렬",
      municipalities: "지자체",
      latestCount: "최신 목록 수",
      pair: "이전 -> 개정",
      tool: "도구",
      beforeUrl: "이전 URL",
      afterUrl: "개정 URL",
      runId: "저장 ID"
    }
  },
  history: {
    detailsSummary: "최근 실행 이력 보기",
    title: "최근 조례 비교 이력",
    subtitle: "저장된 조례 비교 결과를 다시 불러올 수 있습니다.",
    itemMeta: (totalChanges, highRiskCount) => `변경 ${totalChanges}건 | 고위험 ${highRiskCount}건`,
    emptyBreakdown: "변경 유형 요약이 없습니다."
  },
  buttons: {
    runSample: "샘플 조례 비교 실행",
    runLive: "선택한 조례 pair 비교 실행",
    running: "비교 분석 중...",
    search: "검색",
    searching: "검색 중...",
    refreshLatest: "최신 조례 불러오기",
    loadingLatest: "최신 조례 불러오는 중...",
    selectAllMunicipalities: "전체 선택",
    clearMunicipalities: "전체 해제",
    searchLatestPair: "이 조례로 pair 찾기",
    useAsLatestAfter: "현재 버전으로 사용",
    applyRecommendation: "추천 조합 적용",
    useAsBefore: "이전 버전으로 사용",
    useAsAfter: "개정 버전으로 사용",
    inspectDocument: "문서 검사 실행",
    inspectingDocument: "문서 검사 중...",
    downloadDraft: "수정본 초안 다운로드",
    clearDocument: "문서 비우기"
  },
  search: {
    recommendationTitle: "추천 before/after 조합",
    recommendationFallbackReason: "제목과 날짜 메타데이터를 기준으로 가장 자연스러운 조합을 제안합니다.",
    confidence: "신뢰도",
    matchCount: "후보 수",
    strategy: "전략",
    beforeVersion: "이전 버전",
    afterVersion: "개정 버전",
    idLabel: "ID",
    sourceLabel: "출처",
    referenceMissing: "출처 URL이 없습니다.",
    noResults: "현재 검색어와 일치하는 조례가 없습니다.",
    curatedFallback: "큐레이션 보정"
  },
  latest: {
    empty: "선택한 조건에 맞는 최신 조례가 없습니다."
  },
  result: {
    emptySummary: "감지된 변경이 없습니다.",
    emptyImpact: "영향을 받는 내부 문서가 없습니다.",
    emptyRisk: "분류된 위험 항목이 없습니다.",
    emptyDraft: "생성된 초안이 없습니다.",
    noMappedDocuments: "연결된 문서 없음",
    draftSectionLabels: {
      internalNoticeDraft: "내부 공지 초안",
      citizenGuideDraft: "시민 안내문 초안",
      faqDraft: "FAQ 초안",
      comparisonTable: "비교표"
    }
  },
  documentInspect: {
    eyebrow: "문서 검사",
    title: "AI 문서 검사와 수정 초안",
    subtitle: "문서를 붙여넣거나 업로드하면 Gemini가 적용 조례를 판단하고 최신 조례 기준으로 수정 초안을 제안합니다.",
    inputTitle: "검사할 문서 입력",
    inputBody: "텍스트 붙여넣기 또는 텍스트 기반 파일 업로드를 지원합니다.",
    textLabel: "문서 본문",
    textPlaceholder: "예: 시민 안내문, 신청 안내, 내부 업무 매뉴얼 내용을 붙여넣으세요.",
    fileLabel: "문서 파일",
    fileHint: "`.txt`, `.md`, `.json`, `.html` 같은 텍스트 파일을 읽을 수 있습니다.",
    scopeTitle: "지자체 범위 힌트",
    scopeHint: "선택한 지자체 범위를 문서 검사에도 같이 사용합니다.",
    matchedTitle: "판정된 최신 조례",
    matchedEmpty: "아직 판정된 조례가 없습니다.",
    summaryTitle: "검사 요약",
    summaryNote: "문서가 최신 조례와 어떻게 어긋나는지 요약합니다.",
    issuesTitle: "수정 필요 항목",
    issuesNote: "문서에서 잘못됐거나 오래된 부분을 최신 조례 기준으로 정리합니다.",
    checklistTitle: "검토 체크리스트",
    draftTitle: "수정본 초안",
    draftNote: "최신 조례를 반영한 수정 초안입니다. 검토 후 실제 문서에 반영하세요.",
    aiTitle: "AI 판정 메모",
    aiNote: "Gemini가 추정한 적용 조례 검색어와 판정 근거입니다.",
    emptySummary: "아직 문서 검사 결과가 없습니다.",
    emptyIssues: "표시할 수정 항목이 없습니다.",
    emptyChecklist: "표시할 체크리스트가 없습니다.",
    emptyDraft: "수정본 초안이 없습니다.",
    detectedQueryLabel: "판정 검색어",
    confidenceLabel: "판정 신뢰도",
    riskLabel: "위험도",
    fileNameLabel: "파일명",
    searchRouteLabel: "검색 경로",
    reasoningLabel: "판정 근거",
    candidateCountLabel: "후보 수",
    matchedIdLabel: "조례 ID",
    sourceUrlLabel: "출처 URL",
    clauseCountLabel: "조항 수",
    ordinanceBasisLabel: "최신 조례 근거",
    suggestionLabel: "수정 제안"
  },
  labels: {
    yes: "예",
    no: "아니오",
    unknown: "미확인",
    notAvailable: "없음",
    loading: "불러오는 중...",
    directInput: "직접 입력",
    effectiveDate: "시행",
    promulgationDate: "공포",
    noTimeline: "조례 날짜 정보 없음"
  },
  providers: {
    "local-fixture": "로컬 샘플",
    "law-go-public": "law.go.kr 공개",
    "korea-law-mcp": "Korea Law MCP",
    inline: "직접 입력"
  },
  changeTypes: {
    조건: "조건",
    서류: "서류",
    기간: "기간",
    금액: "금액",
    기타: "기타",
    eligibility: "조건",
    documents: "서류",
    deadline: "기간",
    amount: "금액",
    other: "기타"
  },
  riskLevels: {
    빨강: "빨강",
    노랑: "노랑",
    파랑: "파랑",
    red: "빨강",
    yellow: "노랑",
    blue: "파랑",
    high: "높음",
    medium: "보통",
    low: "낮음"
  },
  messages: {
    ready: "준비됨.",
    runningAnalysis: "조례 비교 분석 중...",
    analysisSuccess: (count) => `조례 비교가 완료되었습니다. 변경 ${count}건을 감지했습니다.`,
    analysisFailure: (message) => `조례 비교에 실패했습니다: ${message}`,
    sourceStatusLoading: "선택한 소스 상태를 확인하는 중...",
    sourceConfigured: (provider) => `${provider} 연결이 가능합니다.`,
    sourceNotConfigured: (provider, detail = "") => `${provider} 설정이 아직 준비되지 않았습니다.${detail ? ` ${detail}` : ""}`,
    sampleReady: "샘플 케이스를 바로 비교할 수 있습니다.",
    sampleHelp: (title, municipality) =>
      title
        ? `"${title}"${municipality ? ` (${municipality})` : ""} 케이스가 선택되었습니다.`
        : "샘플 케이스를 선택하세요.",
    liveLawHelp: "law.go.kr 공개 소스로 검색합니다. 검색 후 추천된 이전/개정 버전을 바로 비교에 사용할 수 있습니다.",
    liveMcpHelp: "Korea Law MCP가 연결되어 있으면 검색과 추천 pair 선택을 함께 사용할 수 있습니다.",
    sourceSearchReady: (scope) => `${scope} 범위에서 조례명을 입력하면 자동으로 후보를 찾고 추천된 이전/개정 버전을 바로 선택할 수 있습니다.`,
    sourceSearchUnavailable: "샘플 모드에서는 검색이 필요하지 않습니다.",
    sourceSearchNeedQuery: "검색어를 먼저 입력하세요.",
    sourceSearchNeedMoreQuery: (scope, minChars) => `${scope} 범위에서 ${minChars}글자 이상 입력하면 자동검색이 시작됩니다.`,
    sourceSearchAutoQueued: (scope) => `${scope} 범위로 조례 후보를 자동 검색하는 중...`,
    sourceSearchLoading: (scope) => `${scope} 범위 조례 후보 검색 중...`,
    sourceSearchLoaded: (count, hasRecommendation, scope) =>
      hasRecommendation ? `${scope} 범위 후보 ${count}건과 추천 조합을 불러왔습니다.` : `${scope} 범위 후보 ${count}건을 불러왔습니다.`,
    sourceSearchFailure: (message) => `조례 검색에 실패했습니다: ${message}`,
    latestReadyDefault: "전국 최신 조례 목록을 불러올 준비가 되었습니다.",
    latestSampleMode: "샘플 모드에서는 최신 조례 목록을 사용하지 않습니다.",
    latestReady: (scope) => `${scope} 기준 최신 조례 목록을 불러올 수 있습니다.`,
    latestLoading: (scope) => `${scope} 기준 최신 조례를 불러오는 중...`,
    latestLoaded: (count, scope) => `${scope} 기준 최신 조례 ${count}건을 불러왔습니다.`,
    latestLoadFailure: (message) => `최신 조례 목록을 불러오지 못했습니다: ${message}`,
    latestLawOnly: "최신 조례 목록은 law.go.kr 공개 소스에서만 제공합니다.",
    latestNationwide: "전국 전체",
    latestMunicipalityCount: (count) => `${count}개 지자체`,
    latestAfterSelected: (id) => `${id}를 개정 버전 후보로 선택했습니다.`,
    latestPairSearch: (title) => `"${title}" 기준으로 before/after pair를 찾습니다.`,
    recommendationApplied: (beforeId, afterId) => `추천 조합을 적용했습니다: ${beforeId} -> ${afterId}`,
    selectedBefore: (id) => `${id}를 이전 버전 후보로 선택했습니다.`,
    selectedAfter: (id) => `${id}를 개정 버전 후보로 선택했습니다.`,
    historyLoading: "비교 이력 불러오는 중...",
    historyLoadFailure: (message) => `비교 이력을 불러오지 못했습니다: ${message}`,
    historyStorageDisabled: (provider) => `${provider} 저장소가 아직 설정되지 않았습니다.`,
    historyWaiting: (provider) => `${provider} 저장소는 연결됐지만 저장된 실행 이력이 없습니다.`,
    historyLoaded: (provider, count) => `${provider} 저장소에서 최근 ${count}건을 불러왔습니다.`,
    livePairRequired: (provider) => `${provider}는 이전 버전과 개정 버전이 모두 선택되어야 합니다.`,
    probeUnavailable: "미확인",
    probeSuccess: "연결 가능",
    probeFailure: (error) => `실패 (${error || "알 수 없는 오류"})`,
    ocEnv: "설정된 LAW_GO_OC",
    ocDemo: "데모 LAW_GO_OC=test",
    notSearchedYet: "아직 검색하지 않음",
    metadataLoaded: "메타데이터 로드됨",
    recommendationAvailable: "있음",
    recommendationMissing: "없음",
    expansionYes: "예",
    expansionNo: "아니오",
    documentNeedText: "검사할 문서를 입력하세요.",
    documentLoadingFile: "문서 파일을 읽는 중...",
    documentFileLoaded: (name) => `${name} 파일을 불러왔습니다.`,
    documentInspecting: "Gemini로 문서 검사를 실행하는 중...",
    documentInspectSuccess: (title) => `${title} 기준으로 문서 검사가 완료되었습니다.`,
    documentInspectFailure: (message) => `문서 검사에 실패했습니다: ${message}`,
    documentCleared: "문서 입력을 비웠습니다.",
    downloadReady: (fileName) => `${fileName} 파일 다운로드를 준비했습니다.`
  }
};

const EN_COPY = {
  meta: {
    htmlLang: "en",
    title: "AI-Rookie Ordinance Dashboard"
  },
  locale: {
    ko: "한국어",
    en: "English",
    ariaLabel: "Language switch"
  },
  hero: {
    eyebrow: "Municipal Ordinance Copilot",
    title: "AI-Assisted\nMunicipal Ordinance Change Helper",
    copy: "Search ordinances, browse the latest local laws, and inspect working documents against the latest ordinance."
  },
  pages: {
    search: "Ordinance Search",
    inspect: "Document Review"
  },
  binder: {
    kicker: "AI-Rookie / Ordinance Binder",
    footerSearch: "Switch tabs to move between ordinance search and document review.",
    footerInspect: "Review Gemini findings and the latest-law revision draft for the uploaded document."
  },
  guide: {
    eyebrow: "Quick Start",
    title: "Three steps for new users",
    subtitle: "Use Ordinance Search to find the current law, then use Document Review to check a real document against the latest ordinance.",
    sampleShortcut: "Start with sample cases",
    liveShortcut: "Open live ordinance lookup",
    steps: [
      {
        title: "Choose sample or live lookup",
        body: "Start with a bundled sample or switch to live ordinance lookup for a real municipality."
      },
      {
        title: "Narrow by municipality and latest list",
        body: "Use the checkbox filters and the date-sorted latest ordinance list to narrow the scope quickly."
      },
      {
        title: "Run document review",
        body: "Paste or upload a document and let Gemini identify the likely ordinance, compare it to the latest text, and draft a revision."
      }
    ]
  },
  source: {
    eyebrow: "Ordinance Search",
    title: "Lookup And Pair Comparison",
    sampleTab: "Sample Mode",
    liveTab: "Live Lookup",
    sampleSummary: "Run the bundled comparison cases to review the existing pipeline.",
    liveSummary: "Search real ordinance titles and compare the recommended before/after versions directly.",
    sampleTitle: "Compare a bundled sample case",
    sampleBody: "Pick one bundled case pack and run the comparison immediately.",
    liveTitle: "Search live ordinances and compare a pair",
    liveBody: "Type part of an ordinance title to auto-search candidates, then narrow the same search with municipality filters and the latest ordinance list.",
    providerLabel: "Lookup provider",
    caseLabel: "Sample case",
    searchLabel: "Ordinance search",
    searchPlaceholder: "Example: Seoul youth basic / Daejeon youth support",
    beforeLabel: "Before version",
    beforePlaceholder: "Auto-selected from the search results or recommendation.",
    afterLabel: "After version",
    afterPlaceholder: "Auto-selected from the search results or recommendation.",
    searchHint: "Type at least two keyword characters from an ordinance title to auto-search, then apply the recommended before/after pair automatically.",
    municipalityTitle: "Municipality filters",
    latestHint: "The municipality checkboxes apply to both ordinance-title search and the latest date-sorted ordinance list.",
    advancedSummary: "Advanced settings and provenance",
    advancedBody: "Review provider status, live probe, search provenance, and the latest pair-comparison input.",
    liveUnavailable: "Check provider configuration before using live ordinance lookup.",
    localHint: "Sample Mode uses bundled local cases only.",
    searchAnalyzeTitle: "Compare the selected ordinance pair",
    searchAnalyzeBody: "After filling before/after IDs, run the ordinance comparison pipeline."
  },
  sections: {
    summaryTitle: "Change Summary",
    summaryNote: "See what changed, organized by clause.",
    impactTitle: "Impacted Documents",
    impactNote: "Review which internal documents should change together.",
    riskTitle: "Risk Priority",
    riskNote: "Start with items most likely to cause public-facing errors.",
    draftTitle: "Comparison Drafts",
    draftNote: "Review the internal notice, citizen guide, FAQ, and comparison table together.",
    draftLanguageNote: "The pair-comparison drafts reflect the current analysis input and generated output."
  },
  provenance: {
    title: "Source Provenance",
    subtitle: "Review provider setup, search route, latest browsing, and the most recent pair comparison input.",
    empty: "No provenance information has been collected yet.",
    selectedSource: "Selected Source",
    searchRoute: "Search And Latest List",
    lastAnalysis: "Latest Pair Comparison",
    fields: {
      provider: "Provider",
      enabled: "Configured",
      baseUrl: "Base URL",
      endpoint: "Endpoint",
      ocMode: "Search Auth",
      casePack: "Case",
      probe: "Live Probe",
      availableToolCount: "Detected tools",
      detailTool: "Detail tool",
      searchTool: "Search tool",
      missingEnv: "Missing env",
      status: "Status",
      route: "Route",
      queryVariants: "Query variants",
      recommendation: "Recommendation",
      historyExpanded: "History expanded",
      curatedFallback: "Curated fallback",
      exactTitleMatchCount: "Exact title hits",
      resultCount: "Search result count",
      latestSort: "Latest sort",
      municipalities: "Municipalities",
      latestCount: "Latest count",
      pair: "Before -> After",
      tool: "Tool",
      beforeUrl: "Before URL",
      afterUrl: "After URL",
      runId: "Stored run ID"
    }
  },
  history: {
    detailsSummary: "Show recent runs",
    title: "Recent Pair Comparisons",
    subtitle: "Reload saved ordinance-pair comparisons from storage.",
    itemMeta: (totalChanges, highRiskCount) => `Changes ${totalChanges} | High risk ${highRiskCount}`,
    emptyBreakdown: "No change-type breakdown is available."
  },
  buttons: {
    runSample: "Run Sample Comparison",
    runLive: "Run Selected Pair Comparison",
    running: "Comparing...",
    search: "Find IDs",
    searching: "Searching...",
    refreshLatest: "Load latest ordinances",
    loadingLatest: "Loading latest ordinances...",
    selectAllMunicipalities: "Select all",
    clearMunicipalities: "Clear all",
    searchLatestPair: "Find pair for this title",
    useAsLatestAfter: "Use as current",
    applyRecommendation: "Apply recommended pair",
    useAsBefore: "Use as before",
    useAsAfter: "Use as after",
    inspectDocument: "Run document review",
    inspectingDocument: "Reviewing document...",
    downloadDraft: "Download revision draft",
    clearDocument: "Clear document"
  },
  search: {
    recommendationTitle: "Recommended Pair",
    recommendationFallbackReason: "This is the most plausible pair based on title and date metadata.",
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
  latest: {
    empty: "No latest ordinances matched the current selection."
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
  documentInspect: {
    eyebrow: "Document Review",
    title: "AI Document Review And Revision Draft",
    subtitle: "Paste or upload a document and let Gemini infer the governing ordinance, compare it to the latest law, and draft a revision.",
    inputTitle: "Input document",
    inputBody: "Paste text or upload a text-based file.",
    textLabel: "Document text",
    textPlaceholder: "Example: paste a citizen guide, application guide, or internal memo here.",
    fileLabel: "Document file",
    fileHint: "Text-based files such as `.txt`, `.md`, `.json`, and `.html` can be read directly.",
    scopeTitle: "Municipality scope hints",
    scopeHint: "The same municipality selection is reused for document review.",
    matchedTitle: "Matched latest ordinance",
    matchedEmpty: "No matched ordinance yet.",
    summaryTitle: "Review summary",
    summaryNote: "See how the document differs from the latest ordinance.",
    issuesTitle: "Revision items",
    issuesNote: "Review outdated or incorrect statements found in the document.",
    checklistTitle: "Checklist",
    draftTitle: "Revision draft",
    draftNote: "This draft applies the latest ordinance and is meant for human review before use.",
    aiTitle: "AI reasoning",
    aiNote: "Review the ordinance search query and reasoning Gemini used.",
    emptySummary: "No document review result yet.",
    emptyIssues: "No revision items to show.",
    emptyChecklist: "No checklist items to show.",
    emptyDraft: "No revision draft is available.",
    detectedQueryLabel: "Detected query",
    confidenceLabel: "Confidence",
    riskLabel: "Risk level",
    fileNameLabel: "File name",
    searchRouteLabel: "Search route",
    reasoningLabel: "Reasoning",
    candidateCountLabel: "Candidates",
    matchedIdLabel: "Ordinance ID",
    sourceUrlLabel: "Source URL",
    clauseCountLabel: "Clause count",
    ordinanceBasisLabel: "Ordinance basis",
    suggestionLabel: "Suggested change"
  },
  labels: {
    yes: "Yes",
    no: "No",
    unknown: "Unknown",
    notAvailable: "N/A",
    loading: "Loading...",
    directInput: "Inline input",
    effectiveDate: "Effective",
    promulgationDate: "Promulgated",
    noTimeline: "No ordinance date metadata"
  },
  providers: {
    "local-fixture": "Local Fixture",
    "law-go-public": "law.go.kr Public",
    "korea-law-mcp": "Korea Law MCP",
    inline: "Inline Input"
  },
  changeTypes: {
    조건: "Eligibility",
    서류: "Documents",
    기간: "Deadline",
    금액: "Amount",
    기타: "Other",
    eligibility: "Eligibility",
    documents: "Documents",
    deadline: "Deadline",
    amount: "Amount",
    other: "Other"
  },
  riskLevels: {
    빨강: "High",
    노랑: "Medium",
    파랑: "Low",
    red: "High",
    yellow: "Medium",
    blue: "Low",
    high: "High",
    medium: "Medium",
    low: "Low"
  },
  messages: {
    ready: "Ready.",
    runningAnalysis: "Running ordinance pair comparison...",
    analysisSuccess: (count) => `Pair comparison completed. Detected ${count} changes.`,
    analysisFailure: (message) => `Pair comparison failed: ${message}`,
    sourceStatusLoading: "Checking the selected source status...",
    sourceConfigured: (provider) => `${provider} is available.`,
    sourceNotConfigured: (provider, detail = "") => `${provider} is not configured yet.${detail ? ` ${detail}` : ""}`,
    sampleReady: "Bundled sample cases are ready.",
    sampleHelp: (title, municipality) =>
      title
        ? `Selected case: "${title}"${municipality ? ` (${municipality})` : ""}.`
        : "Choose a bundled case.",
    liveLawHelp: "Uses public law.go.kr search. After searching, you can compare the recommended before/after versions directly.",
    liveMcpHelp: "If the Korea Law MCP endpoint is available, search and recommended pair selection can use it directly.",
    sourceSearchReady: (scope) => `Type an ordinance title for auto-search within ${scope}, then compare the recommended before/after versions directly.`,
    sourceSearchUnavailable: "Search is not needed in Sample Mode.",
    sourceSearchNeedQuery: "Enter a search query first.",
    sourceSearchNeedMoreQuery: (scope, minChars) =>
      `Auto-search starts after ${minChars} characters within ${scope}.`,
    sourceSearchAutoQueued: (scope) => `Auto-searching ordinance candidates within ${scope}...`,
    sourceSearchLoading: (scope) => `Searching ordinance candidates within ${scope}...`,
    sourceSearchLoaded: (count, hasRecommendation, scope) =>
      hasRecommendation ? `Loaded ${count} candidates and a recommended pair for ${scope}.` : `Loaded ${count} candidates for ${scope}.`,
    sourceSearchFailure: (message) => `Search failed: ${message}`,
    latestReadyDefault: "The nationwide latest ordinance list is ready to load.",
    latestSampleMode: "Latest ordinance browsing is not used in Sample Mode.",
    latestReady: (scope) => `Latest ordinance browsing is ready for ${scope}.`,
    latestLoading: (scope) => `Loading latest ordinances for ${scope}...`,
    latestLoaded: (count, scope) => `Loaded ${count} latest ordinances for ${scope}.`,
    latestLoadFailure: (message) => `Could not load the latest ordinance list: ${message}`,
    latestLawOnly: "The latest ordinance list is available only for the law.go.kr public provider.",
    latestNationwide: "Nationwide",
    latestMunicipalityCount: (count) => `${count} municipalities`,
    latestAfterSelected: (id) => `Selected ${id} as the current-version candidate.`,
    latestPairSearch: (title) => `Searching a before/after pair for "${title}".`,
    recommendationApplied: (beforeId, afterId) => `Applied recommended pair: ${beforeId} -> ${afterId}`,
    selectedBefore: (id) => `Selected ${id} as the before-version candidate.`,
    selectedAfter: (id) => `Selected ${id} as the after-version candidate.`,
    historyLoading: "Loading comparison history...",
    historyLoadFailure: (message) => `Could not load comparison history: ${message}`,
    historyStorageDisabled: (provider) => `${provider} storage is not configured yet.`,
    historyWaiting: (provider) => `${provider} storage is connected, but no saved runs exist yet.`,
    historyLoaded: (provider, count) => `Loaded ${count} recent runs from ${provider} storage.`,
    livePairRequired: (provider) => `${provider} requires both a before version and an after version to be selected.`,
    probeUnavailable: "Unknown",
    probeSuccess: "Reachable",
    probeFailure: (error) => `Failed (${error || "unknown error"})`,
    ocEnv: "Configured LAW_GO_OC",
    ocDemo: "Demo LAW_GO_OC=test",
    notSearchedYet: "Not searched yet",
    metadataLoaded: "Metadata loaded",
    recommendationAvailable: "Available",
    recommendationMissing: "Missing",
    expansionYes: "Yes",
    expansionNo: "No",
    documentNeedText: "Enter document text to review.",
    documentLoadingFile: "Reading the document file...",
    documentFileLoaded: (name) => `Loaded ${name}.`,
    documentInspecting: "Running Gemini document review...",
    documentInspectSuccess: (title) => `Document review completed against ${title}.`,
    documentInspectFailure: (message) => `Document review failed: ${message}`,
    documentCleared: "Cleared the document input.",
    downloadReady: (fileName) => `Prepared ${fileName} for download.`
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
