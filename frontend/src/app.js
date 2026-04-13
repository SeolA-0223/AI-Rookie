const HEALTH_ENDPOINT = "/api/health";
const CASE_CATALOG_ENDPOINT = "/api/case-catalog";
const SOURCE_SEARCH_ENDPOINT = "/api/source-search";
const SOURCE_STATUS_ENDPOINT = "/api/source-status";
const ANALYZE_ENDPOINT = "/api/analyze";
const HISTORY_ENDPOINT = "/api/history?limit=6";

const BUTTON_LABEL = "분석 실행";
const BUTTON_LOADING_LABEL = "분석 중...";
const SEARCH_BUTTON_LABEL = "ID 찾기";
const SEARCH_BUTTON_LOADING_LABEL = "검색 중...";

const DRAFT_SECTION_LABELS = {
  internalNoticeDraft: "내부 공지 초안",
  citizenGuideDraft: "시민 안내문 초안",
  faqDraft: "FAQ 초안",
  comparisonTable: "비교표"
};

const runButton = document.getElementById("analyze-btn");
const statusView = document.getElementById("status-msg");
const historyStatusView = document.getElementById("history-status");
const historyListView = document.getElementById("history-list");
const sourceStatusView = document.getElementById("source-status");
const sourceHelpView = document.getElementById("source-help");
const provenanceView = document.getElementById("provenance-cards");
const sourceProviderField = document.getElementById("source-provider");
const sourceCaseGroup = document.getElementById("source-case-group");
const sourceCaseField = document.getElementById("source-case-id");
const sourceBeforeGroup = document.getElementById("source-before-group");
const sourceAfterGroup = document.getElementById("source-after-group");
const sourceBeforeIdField = document.getElementById("source-before-id");
const sourceAfterIdField = document.getElementById("source-after-id");
const sourceSearchGroup = document.getElementById("source-search-group");
const sourceSearchQueryField = document.getElementById("source-search-query");
const sourceSearchButton = document.getElementById("source-search-btn");
const sourceSearchStatusView = document.getElementById("source-search-status");
const sourceSearchRecommendationView = document.getElementById("source-search-recommendation");
const sourceSearchResultsView = document.getElementById("source-search-results");

let latestHealth = null;
let latestRequestedSourceStatus = null;
let latestSourceSearchResult = null;
let latestCaseCatalog = null;
let latestAnalysisMeta = null;

// Helpers
function setStatus(message, type = "neutral") {
  if (!statusView) {
    return;
  }

  statusView.textContent = message;
  statusView.className = `status status-${type}`;
}

function setLoading(loading) {
  if (!runButton) {
    return;
  }

  runButton.disabled = loading;
  runButton.textContent = loading ? BUTTON_LOADING_LABEL : BUTTON_LABEL;
}

function setHistoryStatus(message, type = "neutral") {
  if (!historyStatusView) {
    return;
  }

  historyStatusView.textContent = message;
  historyStatusView.className = `subtle subtle-${type}`;
}

function setSourceStatus(message, type = "neutral") {
  if (!sourceStatusView) {
    return;
  }

  sourceStatusView.textContent = message;
  sourceStatusView.className = `subtle subtle-${type}`;
}

function setSourceHelp(message, type = "neutral") {
  if (!sourceHelpView) {
    return;
  }

  sourceHelpView.textContent = message;
  sourceHelpView.className = `source-help subtle subtle-${type}`;
}

function setSourceSearchStatus(message, type = "neutral") {
  if (!sourceSearchStatusView) {
    return;
  }

  sourceSearchStatusView.textContent = message;
  sourceSearchStatusView.className = `subtle subtle-${type}`;
}

function setSourceSearchLoading(loading) {
  if (!sourceSearchButton) {
    return;
  }

  sourceSearchButton.disabled = loading;
  sourceSearchButton.textContent = loading ? SEARCH_BUTTON_LOADING_LABEL : SEARCH_BUTTON_LABEL;
}

function providerUsesSourceIds(provider) {
  return provider === "korea-law-mcp" || provider === "law-go-public";
}

function providerSupportsSearch(provider) {
  return providerUsesSourceIds(provider);
}

function formatProviderLabel(provider) {
  if (provider === "local-fixture") {
    return "로컬 샘플";
  }
  if (provider === "law-go-public") {
    return "law.go.kr 공개";
  }
  if (provider === "korea-law-mcp") {
    return "Korea Law MCP";
  }
  if (provider === "inline") {
    return "직접 입력";
  }

  return provider || "알 수 없는 소스";
}

function formatMissingEnv(missingEnv = []) {
  if (!Array.isArray(missingEnv) || !missingEnv.length) {
    return "";
  }

  return missingEnv.join(", ");
}

function createEmptyMessage(tagName, text) {
  const element = document.createElement(tagName);
  element.className = "empty";
  element.textContent = text;
  return element;
}

function pushProvenanceItem(items, label, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  items.push({ label, value: String(value) });
}

function createProvenanceCard(title, items, tone = "neutral") {
  const card = document.createElement("article");
  card.className = `provenance-card provenance-${tone}`;

  const heading = document.createElement("h3");
  heading.textContent = title;
  card.append(heading);

  if (!items.length) {
    card.append(createEmptyMessage("p", "아직 수집된 출처 정보가 없습니다."));
    return card;
  }

  const list = document.createElement("ul");
  list.className = "provenance-list";

  for (const item of items) {
    const row = document.createElement("li");
    const label = document.createElement("strong");
    const value = document.createElement("span");

    label.textContent = item.label;
    value.textContent = item.value;
    row.append(label, value);
    list.append(row);
  }

  card.append(list);
  return card;
}

function formatProbeStatus(probe) {
  if (!probe) {
    return "미확인";
  }

  return probe.success ? "접속 가능" : `실패 (${probe.error ?? "알 수 없는 오류"})`;
}

function formatTimelineLabel(result = {}) {
  const timeline = [];

  if (result.effectiveDate) {
    timeline.push(`시행 ${result.effectiveDate}`);
  }
  if (result.promulgationDate) {
    timeline.push(`공포 ${result.promulgationDate}`);
  }

  return timeline.join(" / ") || "조례 일자 메타데이터가 없습니다.";
}

function getSelectedCase() {
  const selectedCaseId = sourceCaseField?.value ?? "";
  return latestCaseCatalog?.cases?.find((item) => item.caseId === selectedCaseId) ?? null;
}

function populateCaseCatalog(payload = {}) {
  if (!sourceCaseField) {
    return;
  }

  const cases = Array.isArray(payload.cases) ? payload.cases : [];
  const defaultCaseId =
    typeof payload.defaultCaseId === "string" && payload.defaultCaseId
      ? payload.defaultCaseId
      : cases.find((entry) => entry.defaultSample)?.caseId ?? "";

  sourceCaseField.innerHTML = "";

  if (!cases.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "사용 가능한 번들 케이스가 없습니다.";
    sourceCaseField.append(option);
    sourceCaseField.disabled = true;
    return;
  }

  for (const entry of cases) {
    const option = document.createElement("option");
    option.value = entry.caseId ?? "";
    option.textContent = entry.municipality
      ? `${entry.municipality} - ${entry.title}`
      : entry.title ?? entry.caseId ?? "제목 없는 케이스";
    if (entry.caseId === defaultCaseId) {
      option.selected = true;
    }
    sourceCaseField.append(option);
  }

  sourceCaseField.disabled = false;
}

function parseErrorMessage(errorBody) {
  if (!errorBody || typeof errorBody !== "object") {
    return "";
  }

  if (typeof errorBody.error === "string") {
    return errorBody.error;
  }

  if (errorBody.error && typeof errorBody.error === "object") {
    const { message, details } = errorBody.error;
    if (typeof message === "string" && message) {
      if (Array.isArray(details) && details.length > 0) {
        return `${message} (${details[0].path}: ${details[0].message})`;
      }
      return message;
    }
  }

  if (typeof errorBody.detail === "string") {
    return errorBody.detail;
  }

  return "";
}

// Rendering
function applyRecommendedPair(recommendation) {
  if (!recommendation?.before?.id || !recommendation?.after?.id) {
    return;
  }

  if (sourceBeforeIdField) {
    sourceBeforeIdField.value = recommendation.before.id;
  }
  if (sourceAfterIdField) {
    sourceAfterIdField.value = recommendation.after.id;
  }

  setSourceSearchStatus(`추천 조합을 적용했습니다: ${recommendation.before.id} -> ${recommendation.after.id}.`, "success");
}

function renderSourceSearchRecommendation(recommendation) {
  if (!sourceSearchRecommendationView) {
    return;
  }

  sourceSearchRecommendationView.innerHTML = "";

  if (!recommendation?.before?.id || !recommendation?.after?.id) {
    return;
  }

  const card = document.createElement("article");
  card.className = "recommendation-card";

  const title = document.createElement("h3");
  title.textContent = "추천 조합";

  const reason = document.createElement("p");
  reason.textContent = recommendation.reason || "시계열 기준 추천 조합이 준비되어 있습니다.";

  const meta = document.createElement("p");
  meta.className = "recommendation-meta";
  meta.textContent =
    `신뢰도: ${recommendation.confidence ?? "확인 불가"} / ` +
    `매치 수: ${recommendation.matchCount ?? 0} / ` +
    `전략: ${recommendation.strategy ?? "heuristic"}`;

  const grid = document.createElement("div");
  grid.className = "recommendation-grid";

  const beforeBlock = document.createElement("div");
  beforeBlock.className = "search-result";
  beforeBlock.innerHTML = `
    <h3>이전안</h3>
    <p class="search-meta">ID: ${recommendation.before.id}</p>
    <p>${recommendation.before.title ?? recommendation.before.id}</p>
    <p class="search-meta">${formatTimelineLabel(recommendation.before)}</p>
  `;

  const afterBlock = document.createElement("div");
  afterBlock.className = "search-result";
  afterBlock.innerHTML = `
    <h3>개정안</h3>
    <p class="search-meta">ID: ${recommendation.after.id}</p>
    <p>${recommendation.after.title ?? recommendation.after.id}</p>
    <p class="search-meta">${formatTimelineLabel(recommendation.after)}</p>
  `;

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.className = "secondary-btn";
  applyButton.textContent = "추천 조합 적용";
  applyButton.addEventListener("click", () => applyRecommendedPair(recommendation));

  grid.append(beforeBlock, afterBlock);
  card.append(title, reason, meta, grid, applyButton);
  sourceSearchRecommendationView.append(card);
}

function renderSourceSearchResults(results = []) {
  if (!sourceSearchResultsView) {
    return;
  }

  sourceSearchResultsView.innerHTML = "";

  if (!results.length) {
    sourceSearchResultsView.append(createEmptyMessage("p", "현재 검색어에 해당하는 조례 후보가 없습니다."));
    return;
  }

  for (const result of results) {
    const card = document.createElement("article");
    card.className = "search-result";

    const title = document.createElement("h3");
    title.textContent = result.title ?? result.id ?? "제목 없는 조례";

    const idLine = document.createElement("p");
    idLine.className = "search-meta";
    idLine.textContent = `ID: ${result.id ?? "확인 불가"}`;

    const meta = document.createElement("p");
    meta.className = "search-meta";
    meta.textContent = [result.jurisdiction, formatTimelineLabel(result), result.curatedCaseId ? `큐레이션: ${result.curatedCaseId}` : ""]
      .filter(Boolean)
      .join(" / ");

    const summary = document.createElement("p");
    summary.textContent = result.summary || "요약이 제공되지 않았습니다.";

    const reference = document.createElement("p");
    reference.className = "search-meta search-link";
    reference.textContent = result.referenceUrl ? `출처: ${result.referenceUrl}` : "출처 URL이 없습니다.";

    const actions = document.createElement("div");
    actions.className = "search-actions";

    const beforeButton = document.createElement("button");
    beforeButton.type = "button";
    beforeButton.className = "secondary-btn";
    beforeButton.textContent = "이전안으로 사용";
    beforeButton.disabled = !result.id;
    beforeButton.addEventListener("click", () => {
      if (sourceBeforeIdField) {
        sourceBeforeIdField.value = result.id ?? "";
      }
      setSourceSearchStatus(`${result.id}를 이전 버전 ID로 선택했습니다.`, "success");
    });

    const afterButton = document.createElement("button");
    afterButton.type = "button";
    afterButton.className = "secondary-btn";
    afterButton.textContent = "개정안으로 사용";
    afterButton.disabled = !result.id;
    afterButton.addEventListener("click", () => {
      if (sourceAfterIdField) {
        sourceAfterIdField.value = result.id ?? "";
      }
      setSourceSearchStatus(`${result.id}를 개정 버전 ID로 선택했습니다.`, "success");
    });

    actions.append(beforeButton, afterButton);
    card.append(title, idLine, meta, summary, reference, actions);
    sourceSearchResultsView.append(card);
  }
}

function renderProvenance() {
  if (!provenanceView) {
    return;
  }

  provenanceView.innerHTML = "";

  const provider = sourceProviderField?.value ?? "local-fixture";
  const selectedCase = getSelectedCase();
  const statusPayload = latestRequestedSourceStatus?.requestedProvider === provider ? latestRequestedSourceStatus : null;
  const sourceStatus = statusPayload?.source ?? null;
  const probe = statusPayload?.probe ?? null;
  const searchPayload = latestSourceSearchResult?.requestedProvider === provider ? latestSourceSearchResult : null;
  const searchMeta = searchPayload?.meta ?? {};
  const searchDiagnostics = searchMeta.diagnostics ?? {};
  const inputSource = latestAnalysisMeta?.inputSource ?? null;

  const providerItems = [];
  pushProvenanceItem(providerItems, "제공자", formatProviderLabel(provider));
  pushProvenanceItem(providerItems, "구성 여부", sourceStatus ? (sourceStatus.enabled ? "예" : "아니오") : "확인 중");
  pushProvenanceItem(providerItems, "기본 URL", sourceStatus?.baseUrl);
  pushProvenanceItem(providerItems, "엔드포인트", sourceStatus?.endpoint);
  pushProvenanceItem(
    providerItems,
    "인증",
    sourceStatus?.ocMode === "env" ? "설정된 LAW_GO_OC" : sourceStatus?.ocMode === "test-demo" ? "데모 LAW_GO_OC=test" : ""
  );
  pushProvenanceItem(providerItems, "케이스 팩", selectedCase?.title);
  pushProvenanceItem(providerItems, "라이브 Probe", provider === "korea-law-mcp" ? formatProbeStatus(probe) : "");
  pushProvenanceItem(providerItems, "감지된 도구 수", probe?.success ? probe.availableToolCount : "");
  pushProvenanceItem(providerItems, "상세 도구", probe?.selectedDetailToolName);
  pushProvenanceItem(providerItems, "검색 도구", probe?.selectedSearchToolName);
  pushProvenanceItem(
    providerItems,
    "누락 환경변수",
    Array.isArray(sourceStatus?.missingEnv) && sourceStatus.missingEnv.length ? sourceStatus.missingEnv.join(", ") : ""
  );
  provenanceView.append(createProvenanceCard("선택된 제공자", providerItems, sourceStatus?.enabled ? "success" : "neutral"));

  if (providerSupportsSearch(provider)) {
    const searchItems = [];
    pushProvenanceItem(searchItems, "상태", searchPayload ? "검색 메타데이터 로드됨" : "아직 검색하지 않음");
    pushProvenanceItem(searchItems, "경로", searchMeta.searchBackend || searchMeta.toolName);
    pushProvenanceItem(
      searchItems,
      "질의 변형",
      Array.isArray(searchDiagnostics.queryVariants) ? searchDiagnostics.queryVariants.join(" -> ") : ""
    );
    pushProvenanceItem(searchItems, "추천 조합", searchPayload?.recommendation ? "있음" : searchPayload ? "없음" : "");
    pushProvenanceItem(
      searchItems,
      "연혁 확장",
      typeof searchMeta.historyExpanded === "boolean" ? (searchMeta.historyExpanded ? "예" : "아니오") : ""
    );
    pushProvenanceItem(
      searchItems,
      "큐레이션 보정",
      searchDiagnostics.curatedFallbackUsed ? (searchDiagnostics.curatedFallbackCaseIds ?? []).join(", ") : searchPayload ? "사용 안 함" : ""
    );
    pushProvenanceItem(searchItems, "정확 제목 일치", searchDiagnostics.exactTitleMatchCount);
    pushProvenanceItem(searchItems, "결과 수", Array.isArray(searchPayload?.results) ? searchPayload.results.length : "");
    provenanceView.append(createProvenanceCard("검색 경로", searchItems));
  }

  const analysisItems = [];
  pushProvenanceItem(analysisItems, "상태", inputSource ? "분석 입력 메타데이터 로드됨" : "아직 분석 입력이 없습니다.");
  pushProvenanceItem(analysisItems, "제공자", inputSource ? formatProviderLabel(inputSource.provider) : "");
  pushProvenanceItem(analysisItems, "케이스 팩", inputSource?.caseTitle ?? inputSource?.caseId);
  pushProvenanceItem(
    analysisItems,
    "이전 -> 개정",
    inputSource?.beforeId && inputSource?.afterId ? `${inputSource.beforeId} -> ${inputSource.afterId}` : ""
  );
  pushProvenanceItem(analysisItems, "도구", inputSource?.toolName);
  pushProvenanceItem(analysisItems, "엔드포인트", inputSource?.endpoint);
  pushProvenanceItem(analysisItems, "기본 URL", inputSource?.baseUrl);
  pushProvenanceItem(analysisItems, "이전 URL", inputSource?.beforeReferenceUrl ?? inputSource?.officialUrl);
  pushProvenanceItem(analysisItems, "개정 URL", inputSource?.afterReferenceUrl);
  pushProvenanceItem(analysisItems, "저장 실행 ID", latestAnalysisMeta?.storage?.runId);
  provenanceView.append(createProvenanceCard("최근 분석", analysisItems, inputSource ? "success" : "neutral"));
}

function describeRunSource(run) {
  const inputSource = run.result?.meta?.inputSource ?? {};
  if (inputSource.provider === "local-fixture" && inputSource.caseId) {
    return `로컬 샘플 (${inputSource.caseTitle ?? inputSource.caseId})`;
  }

  if (providerUsesSourceIds(inputSource.provider)) {
    const ids =
      inputSource.beforeId && inputSource.afterId
        ? ` (${inputSource.beforeId} -> ${inputSource.afterId})`
        : "";
    return `${formatProviderLabel(inputSource.provider)}${ids}`;
  }

  if (inputSource.provider) {
    return formatProviderLabel(inputSource.provider);
  }

  if (run.source === "custom") {
    return "직접 입력";
  }

  return "샘플 입력";
}

function renderSummary(changes = []) {
  const container = document.getElementById("summary-cards");
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!changes.length) {
    container.append(createEmptyMessage("p", "감지된 변경이 없습니다."));
    return;
  }

  for (const change of changes) {
    const card = document.createElement("article");
    card.className = "card";

    const title = document.createElement("h3");
    title.textContent = change.title ?? "(제목 없음)";

    const type = document.createElement("p");
    type.className = "card-meta";
    const typeStrong = document.createElement("strong");
    typeStrong.textContent = change.changeType ?? "기타";
    type.append(typeStrong);

    const summary = document.createElement("p");
    summary.textContent = change.summary ?? "요약이 없습니다.";

    card.append(title, type, summary);
    container.append(card);
  }
}

function renderImpact(mapped = []) {
  const container = document.getElementById("impact-list");
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!mapped.length) {
    container.append(createEmptyMessage("li", "영향을 받는 내부 문서가 없습니다."));
    return;
  }

  for (const item of mapped) {
    const impactedDocs = Array.isArray(item.impactedDocuments)
      ? item.impactedDocuments.map((document) => `${document.title} (${document.score})`)
      : [];
    const legacyDocs = Array.isArray(item.docs) ? item.docs : [];
    const docs = impactedDocs.length > 0 ? impactedDocs.join(", ") : legacyDocs.join(", ");

    const row = document.createElement("li");
    row.textContent = `${item.changeId}: ${docs || "매칭된 문서 없음"}`;
    container.append(row);
  }
}

function riskClassForLevel(level) {
  if (level === "빨강") {
    return "risk-red";
  }
  if (level === "노랑") {
    return "risk-yellow";
  }
  return "risk-blue";
}

function renderRisks(risks = []) {
  const container = document.getElementById("risk-list");
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!risks.length) {
    container.append(createEmptyMessage("li", "분류된 위험이 없습니다."));
    return;
  }

  for (const item of risks) {
    const level = item.risk?.level ?? item.level ?? "파랑";
    const reason = item.risk?.reason ?? item.reason ?? "사유가 없습니다.";

    const row = document.createElement("li");
    row.className = riskClassForLevel(level);
    row.textContent = `${item.changeId} - ${level}: ${reason}`;
    container.append(row);
  }
}

function renderDraft(drafts = {}) {
  const draftView = document.getElementById("draft-view");
  if (!draftView) {
    return;
  }

  const preferredOrder = ["internalNoticeDraft", "citizenGuideDraft", "faqDraft", "comparisonTable"];
  const keys = preferredOrder.filter((key) => typeof drafts[key] === "string");
  const dynamicKeys = Object.keys(drafts).filter((key) => !keys.includes(key));
  const allKeys = [...keys, ...dynamicKeys];

  if (!allKeys.length) {
    draftView.textContent = "생성된 초안이 없습니다.";
    return;
  }

  draftView.textContent = allKeys
    .map((key) => `[${DRAFT_SECTION_LABELS[key] ?? key}]\n${drafts[key]}`)
    .join("\n\n");
}

function formatRunTime(value) {
  if (!value) {
    return "시간 미상";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
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

function renderResult(result) {
  const normalized = normalizeAnalyzeResponse(result);
  renderSummary(normalized.changes);
  renderImpact(normalized.mapped);
  renderRisks(normalized.risks);
  renderDraft(normalized.drafts);
  return normalized;
}

function renderHistoryItem(run) {
  const item = document.createElement("article");
  item.className = "history-item";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "history-button";

  const title = document.createElement("strong");
  title.textContent = `${formatRunTime(run.createdAt)} | ${describeRunSource(run)}`;

  const meta = document.createElement("p");
  meta.textContent = `변경 ${run.totalChanges}건 | 고위험 ${run.highRiskChangeCount}건`;

  const breakdown = document.createElement("p");
  const changeTypes = Object.entries(run.changeTypeBreakdown ?? {})
    .map(([type, count]) => `${type} ${count}`)
    .join(" / ");
  breakdown.textContent = changeTypes || "변경 유형 요약이 없습니다.";

  button.append(title, meta, breakdown);
  button.addEventListener("click", () => {
    renderResult(run.result ?? {});
    latestAnalysisMeta = run.result?.meta ?? null;
    renderProvenance();
    setStatus(`저장된 분석 ${run.id}를 불러왔습니다.`, "success");
  });

  item.append(button);
  return item;
}

function renderHistory(payload = {}) {
  if (!historyListView) {
    return;
  }

  historyListView.innerHTML = "";
  const runs = Array.isArray(payload.runs) ? payload.runs : [];
  const storage = payload.storage ?? {};
  const providerName = storage.provider ?? "storage";

  if (!storage.enabled) {
    historyListView.append(createEmptyMessage("p", `${providerName} 저장소가 아직 설정되지 않았습니다.`));
    setHistoryStatus(`${providerName} 저장소가 비활성화되어 있습니다.`, "neutral");
    return;
  }

  if (!runs.length) {
    historyListView.append(createEmptyMessage("p", "저장된 분석이 없습니다."));
    setHistoryStatus(`${providerName} 저장소가 연결되었습니다. 첫 저장 결과를 기다리는 중입니다.`, "success");
    return;
  }

  for (const run of runs) {
    historyListView.append(renderHistoryItem(run));
  }

  setHistoryStatus(`${providerName} 저장소가 연결되었습니다. 최근 ${runs.length}개 실행을 보여줍니다.`, "success");
}

// Data loading
async function loadHistory() {
  try {
    const response = await fetch(HISTORY_ENDPOINT);
    if (!response.ok) {
      throw new Error(`이력 요청이 ${response.status}로 실패했습니다.`);
    }

    const payload = await response.json();
    renderHistory(payload);
  } catch (error) {
    if (historyListView) {
      historyListView.innerHTML = "";
      historyListView.append(createEmptyMessage("p", "분석 이력을 불러올 수 없습니다."));
    }
    setHistoryStatus(`분석 이력을 불러올 수 없습니다: ${error.message}`, "error");
  }
}

async function loadHealth() {
  try {
    const response = await fetch(HEALTH_ENDPOINT);
    if (!response.ok) {
      throw new Error(`상태 확인 요청이 ${response.status}로 실패했습니다.`);
    }

    latestHealth = await response.json();
  } catch (error) {
    latestHealth = null;
    setSourceStatus(`소스 상태를 확인할 수 없습니다: ${error.message}`, "error");
  }
}

async function loadCaseCatalog() {
  if (!sourceCaseField) {
    latestCaseCatalog = null;
    return;
  }

  try {
    const response = await fetch(CASE_CATALOG_ENDPOINT);
    if (!response.ok) {
      throw new Error(`케이스 카탈로그 요청이 ${response.status}로 실패했습니다.`);
    }

    latestCaseCatalog = await response.json();
    populateCaseCatalog(latestCaseCatalog);
  } catch (error) {
    latestCaseCatalog = null;
    sourceCaseField.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "번들 케이스를 불러올 수 없습니다.";
    sourceCaseField.append(option);
    sourceCaseField.disabled = true;
    setSourceHelp(`번들 케이스 카탈로그를 불러올 수 없습니다: ${error.message}`, "error");
  }
}

function updateSourceControls() {
  const provider = sourceProviderField?.value ?? "local-fixture";
  const usesSourceIds = providerUsesSourceIds(provider);
  const supportsSearch = providerSupportsSearch(provider);
  const selectedSource = latestRequestedSourceStatus?.requestedProvider === provider ? latestRequestedSourceStatus.source : null;
  const selectedCase = getSelectedCase();

  if (sourceCaseGroup) {
    sourceCaseGroup.hidden = provider !== "local-fixture";
  }
  if (sourceBeforeGroup) {
    sourceBeforeGroup.hidden = !usesSourceIds;
  }
  if (sourceAfterGroup) {
    sourceAfterGroup.hidden = !usesSourceIds;
  }
  if (sourceSearchGroup) {
    sourceSearchGroup.hidden = !supportsSearch;
  }

  if (provider === "local-fixture") {
    const localFixtureEnabled = selectedSource?.enabled ?? true;
    setSourceStatus(localFixtureEnabled ? "번들 샘플 소스를 사용할 수 있습니다." : "번들 샘플 소스를 사용할 수 없습니다.", localFixtureEnabled ? "success" : "error");
    setSourceHelp(
      selectedCase
        ? `번들 케이스 팩 "${selectedCase.title}" (${selectedCase.municipality ?? "지자체 미지정"})을 사용합니다. 데모 흐름에서는 별도 소스 ID가 필요하지 않습니다.`
        : "리포지토리에 포함된 샘플 조례 쌍을 사용합니다. 기본 데모 흐름에서는 별도 소스 ID가 필요하지 않습니다.",
      localFixtureEnabled ? "neutral" : "error"
    );
    setSourceSearchStatus("검색은 원격 조례 제공자에서만 사용됩니다.", "neutral");
    renderSourceSearchRecommendation(null);
    renderSourceSearchResults([]);
    renderProvenance();
    return;
  }

  if (selectedSource?.enabled) {
    if (provider === "korea-law-mcp") {
      const toolNames = Array.isArray(selectedSource.detailToolNames)
        ? selectedSource.detailToolNames.join(" -> ")
        : "configured detail tool";
      const idArgumentName = selectedSource.idArgumentName ?? "ID";
      const searchToolName = Array.isArray(selectedSource.searchToolNames)
        ? selectedSource.searchToolNames.join(" -> ")
        : "search_local_ordinance";
      const searchQueryArgumentName = selectedSource.searchQueryArgumentName ?? "query";

      setSourceStatus("Korea Law MCP 요청 경로가 구성되어 있습니다.", "success");
      setSourceHelp(
        `조례명을 검색하거나 이전/개정 조례 ID를 직접 입력하세요. 서버는 ${idArgumentName} 인수로 ${toolNames} 순서를 시도합니다.`,
        "neutral"
      );
      setSourceSearchStatus(
        `검색은 ${searchToolName}의 ${searchQueryArgumentName} 인수를 사용합니다. 아래 후보를 선택해 이전/개정 ID를 채우세요.`,
        "neutral"
      );
      renderProvenance();
      return;
    }

    if (provider === "law-go-public") {
      const ocMode = selectedSource.ocMode === "env" ? "설정된 OC" : "테스트 OC";
      setSourceStatus("law.go.kr 공개 요청 경로가 구성되어 있습니다.", "success");
      setSourceHelp(
        `조례명을 검색하거나 이전/개정 조례 순번 ID를 직접 입력하세요. 서버는 ${ocMode} 검색 접근으로 공식 공개 엔드포인트를 사용합니다.`,
        "neutral"
      );
      setSourceSearchStatus(
        "검색은 공식 law.go.kr 조례 검색 엔드포인트를 사용합니다. 아래 후보를 선택해 이전/개정 ID를 채우세요.",
        "neutral"
      );
      renderProvenance();
      return;
    }

    renderProvenance();
    return;
  }

  if (selectedSource && !selectedSource.enabled) {
    const missingEnv = formatMissingEnv(selectedSource.missingEnv);
    const detail = missingEnv ? ` 누락: ${missingEnv}.` : "";

    setSourceStatus(`${formatProviderLabel(provider)}는 요청 단위 사용을 위해 아직 설정되지 않았습니다.`, "error");
    setSourceHelp(`조례 ID를 사용하기 전에 제공자를 설정하세요.${detail}`, "error");
    setSourceSearchStatus(`${formatProviderLabel(provider)}가 설정되기 전까지 검색을 사용할 수 없습니다.`, "error");
    renderSourceSearchRecommendation(null);
    renderSourceSearchResults([]);
    renderProvenance();
    return;
  }

  const defaultSource = latestHealth?.source ?? {};
  if (defaultSource.provider === provider && defaultSource.enabled) {
    setSourceStatus(`서버에서 ${formatProviderLabel(provider)}가 구성되어 있습니다.`, "success");
    setSourceHelp("조례명을 검색하거나 이전/개정 버전의 조례 ID를 입력하세요.", "neutral");
    setSourceSearchStatus(`${formatProviderLabel(provider)} 검색을 사용할 준비가 되었습니다.`, "neutral");
    renderProvenance();
    return;
  }

  setSourceStatus(`${formatProviderLabel(provider)}는 요청마다 선택됩니다.`, "neutral");
  setSourceHelp("조례명을 검색하거나 이전/개정 버전의 조례 ID를 입력하세요.", "neutral");
  setSourceSearchStatus("선택한 조례 제공자에서 사용할 ID를 검색하세요.", "neutral");
  renderProvenance();
}

async function loadSelectedSourceStatus() {
  const provider = sourceProviderField?.value ?? "local-fixture";
  const probeParam = provider === "korea-law-mcp" ? "&probe=1" : "";

  try {
    const response = await fetch(`${SOURCE_STATUS_ENDPOINT}?provider=${encodeURIComponent(provider)}${probeParam}`);
    if (!response.ok) {
      throw new Error(`소스 상태 요청이 ${response.status}로 실패했습니다.`);
    }

    latestRequestedSourceStatus = await response.json();
  } catch (error) {
    latestRequestedSourceStatus = null;
    setSourceStatus(`소스 상태를 확인할 수 없습니다: ${error.message}`, "error");
  }

  updateSourceControls();
}

async function runSourceSearch() {
  const provider = sourceProviderField?.value ?? "local-fixture";
  const query = sourceSearchQueryField?.value.trim() ?? "";

  if (!providerSupportsSearch(provider)) {
    setSourceSearchStatus("검색은 원격 조례 제공자에서만 사용할 수 있습니다.", "neutral");
    renderSourceSearchRecommendation(null);
    renderSourceSearchResults([]);
    renderProvenance();
    return;
  }

  if (!query) {
    setSourceSearchStatus("검색 전에 조례명 또는 키워드를 입력하세요.", "error");
    renderSourceSearchRecommendation(null);
    renderSourceSearchResults([]);
    renderProvenance();
    return;
  }

  setSourceSearchLoading(true);
  setSourceSearchStatus("조례 후보를 검색하는 중...", "neutral");

  try {
    const response = await fetch(
      `${SOURCE_SEARCH_ENDPOINT}?provider=${encodeURIComponent(provider)}&query=${encodeURIComponent(query)}&limit=6`
    );

    if (!response.ok) {
      let detail = "";
      try {
        const errorBody = await response.json();
        detail = parseErrorMessage(errorBody);
      } catch {
        detail = "";
      }
      throw new Error(detail || `소스 검색이 ${response.status}로 실패했습니다.`);
    }

    latestSourceSearchResult = await response.json();
    renderSourceSearchRecommendation(latestSourceSearchResult.recommendation);
    renderSourceSearchResults(latestSourceSearchResult.results ?? []);
    renderProvenance();
    setSourceSearchStatus(
      latestSourceSearchResult.recommendation
        ? `${(latestSourceSearchResult.results ?? []).length}개의 조례 후보와 추천 조합을 불러왔습니다.`
        : `${(latestSourceSearchResult.results ?? []).length}개의 조례 후보를 불러왔습니다.`,
      "success"
    );
  } catch (error) {
    latestSourceSearchResult = null;
    renderSourceSearchRecommendation(null);
    renderSourceSearchResults([]);
    renderProvenance();
    setSourceSearchStatus(`검색에 실패했습니다: ${error.message}`, "error");
  } finally {
    setSourceSearchLoading(false);
  }
}

function buildAnalyzePayload() {
  const provider = sourceProviderField?.value ?? "local-fixture";

  if (provider === "local-fixture") {
    const selectedCaseId = sourceCaseField?.value.trim() ?? "";
    return selectedCaseId
      ? {
          source: {
            provider: "local-fixture",
            caseId: selectedCaseId
          }
        }
      : {
          source: {
            provider: "local-fixture"
          }
        };
  }

  const beforeId = sourceBeforeIdField?.value.trim() ?? "";
  const afterId = sourceAfterIdField?.value.trim() ?? "";

  if (!beforeId || !afterId) {
    throw new Error(`${formatProviderLabel(provider)}에는 이전 ID와 개정 ID가 모두 필요합니다.`);
  }

  return {
    source: {
      provider,
      beforeId,
      afterId
    }
  };
}

async function runAnalyze() {
  setLoading(true);
  setStatus("조례 변경을 분석하는 중...", "loading");

  try {
    const payload = buildAnalyzePayload();
    const response = await fetch(ANALYZE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let detail = "";
      try {
        const errorBody = await response.json();
        detail = parseErrorMessage(errorBody);
      } catch {
        detail = "";
      }
      throw new Error(detail || `요청이 ${response.status}로 실패했습니다.`);
    }

    const result = await response.json();
    const normalized = renderResult(result);
    latestAnalysisMeta = result.meta ?? null;
    renderProvenance();
    setStatus(`분석이 완료되었습니다. ${normalized.changes.length}개의 변경이 감지되었습니다.`, "success");
    await loadHistory();
  } catch (error) {
    renderResult({ changes: [], mapped: [], risks: [], drafts: {} });
    latestAnalysisMeta = null;
    renderProvenance();
    setStatus(`분석에 실패했습니다: ${error.message}`, "error");
    await loadHistory();
  } finally {
    setLoading(false);
  }
}

async function init() {
  if (sourceProviderField) {
    sourceProviderField.addEventListener("change", () => {
      setSourceStatus("선택한 소스 제공자를 확인하는 중...", "neutral");
      latestSourceSearchResult = null;
      renderSourceSearchRecommendation(null);
      renderSourceSearchResults([]);
      renderProvenance();
      updateSourceControls();
      void loadSelectedSourceStatus();
    });
  }

  if (sourceCaseField) {
    sourceCaseField.addEventListener("change", () => {
      updateSourceControls();
      renderProvenance();
    });
  }

  if (sourceSearchButton) {
    sourceSearchButton.addEventListener("click", () => {
      void runSourceSearch();
    });
  }

  if (sourceSearchQueryField) {
    sourceSearchQueryField.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void runSourceSearch();
      }
    });
  }

  await loadHealth();
  await loadCaseCatalog();
  await loadSelectedSourceStatus();
  await loadHistory();
  await runAnalyze();
}

if (runButton) {
  runButton.addEventListener("click", runAnalyze);
}

void init();
