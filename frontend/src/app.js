import { DEFAULT_LOCALE, SUPPORTED_LOCALES, getCopy, getMessage } from "./i18n.js";
import {
  renderDocumentChecklist,
  renderDocumentIssues,
  renderDocumentMatch,
  renderDraftView,
  renderHistoryList,
  renderImpactList,
  renderLatestOrdinanceList,
  renderMunicipalityFilters,
  renderProvenanceCards,
  renderQuickStart,
  renderRiskList,
  renderSourceSearchRecommendation,
  renderSourceSearchResults,
  renderSummaryCards
} from "./view.js";

const ENDPOINTS = {
  caseCatalog: "/api/case-catalog",
  sourceSearch: "/api/source-search",
  sourceDiscover: "/api/source-discover",
  sourceStatus: "/api/source-status",
  analyze: "/api/analyze",
  documentInspect: "/api/document-inspect",
  history: "/api/history?limit=6"
};
const LOCALE_STORAGE_KEY = "ai-rookie-locale";
const REMOTE_PROVIDERS = ["law-go-public", "korea-law-mcp"];
const MUNICIPALITIES = [
  ["6110000", "서울특별시"],
  ["6260000", "부산광역시"],
  ["6270000", "대구광역시"],
  ["6280000", "인천광역시"],
  ["6290000", "광주광역시"],
  ["6300000", "대전광역시"],
  ["5690000", "세종특별자치시"],
  ["6310000", "울산광역시"],
  ["6410000", "경기도"],
  ["6530000", "강원특별자치도"],
  ["6430000", "충청북도"],
  ["6440000", "충청남도"],
  ["6540000", "전북특별자치도"],
  ["6460000", "전라남도"],
  ["6470000", "경상북도"],
  ["6480000", "경상남도"],
  ["6500000", "제주특별자치도"],
  ["6550000", "충청권광역연합"]
].map(([code, name]) => ({ code, name }));

const $ = (id) => document.getElementById(id);

const refs = {
  sheetFront: $("sheet-front"),
  pageCurrentView: $("page-current"),
  pageCurrentLabelView: $("page-current-label"),
  sheetFooterCopyView: $("sheet-footer-copy"),
  pageSearchButton: $("page-search-btn"),
  pageInspectButton: $("page-inspect-btn"),
  searchPageView: $("page-search"),
  inspectPageView: $("page-inspect"),
  languageButtons: Array.from(document.querySelectorAll("[data-locale]")),
  runButton: $("analyze-btn"),
  statusView: $("status-msg"),
  sourceStatusView: $("source-status"),
  sourceHelpView: $("source-help"),
  sourceModeSummaryView: $("source-mode-summary"),
  sourceSearchStatusView: $("source-search-status"),
  historyStatusView: $("history-status"),
  sourceProviderField: $("source-provider"),
  sourceCaseField: $("source-case-id"),
  sourceSearchQueryField: $("source-search-query"),
  sourceSearchButton: $("source-search-btn"),
  sourceBeforeIdField: $("source-before-id"),
  sourceAfterIdField: $("source-after-id"),
  summaryContainer: $("summary-cards"),
  impactListView: $("impact-list"),
  riskListView: $("risk-list"),
  draftView: $("draft-view"),
  historyListView: $("history-list"),
  provenanceView: $("provenance-cards"),
  sourceSearchRecommendationView: $("source-search-recommendation"),
  sourceSearchResultsView: $("source-search-results"),
  latestStatusView: $("latest-status"),
  latestOrdinanceListView: $("latest-ordinance-list"),
  municipalityFilterView: $("municipality-filter-list"),
  latestRefreshButton: $("latest-refresh-btn"),
  municipalitySelectAllButton: $("municipality-select-all-btn"),
  municipalityClearButton: $("municipality-clear-btn"),
  quickStartView: $("quickstart-steps"),
  sampleShortcutButton: $("sample-shortcut-btn"),
  liveShortcutButton: $("live-shortcut-btn"),
  modeSampleButton: $("mode-sample-btn"),
  modeLiveButton: $("mode-live-btn"),
  sampleModePanel: $("sample-mode-panel"),
  liveModePanel: $("live-mode-panel"),
  documentStatusView: $("document-status"),
  documentFileInput: $("document-file-input"),
  documentFileNameView: $("document-file-name"),
  documentTextField: $("document-text"),
  documentInspectButton: $("document-inspect-btn"),
  documentClearButton: $("document-clear-btn"),
  documentMatchCardView: $("document-match-card"),
  documentSummaryView: $("document-summary"),
  documentAiSummaryView: $("document-ai-summary"),
  documentReviewMetaView: $("document-review-meta"),
  documentIssuesListView: $("document-issues-list"),
  documentChecklistListView: $("document-checklist-list"),
  documentDraftView: $("document-draft-view"),
  documentDownloadButton: $("document-download-btn"),
  documentMunicipalityFilterView: $("document-municipality-filter-list"),
  documentMunicipalitySelectAllButton: $("document-municipality-select-all-btn"),
  documentMunicipalityClearButton: $("document-municipality-clear-btn")
};

const state = {
  locale: loadStoredLocale(),
  page: "search",
  mode: "sample",
  latestRequestedSourceStatus: null,
  latestSourceSearchResult: null,
  latestDiscoveryResult: null,
  latestCaseCatalog: null,
  latestAnalysisMeta: null,
  latestAnalysisResult: null,
  latestHistoryPayload: null,
  latestDocumentInspection: null,
  selectedMunicipalities: [],
  currentDocumentFileName: ""
};

function loadStoredLocale() {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return SUPPORTED_LOCALES.includes(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

const copy = () => getCopy(state.locale);

function saveLocale(locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {}
}

function currentProvider() {
  return state.mode === "sample" ? "local-fixture" : refs.sourceProviderField?.value || REMOTE_PROVIDERS[0];
}

function providerUsesSourceIds(provider) {
  return provider === "law-go-public" || provider === "korea-law-mcp";
}

function getSelectedCase() {
  const selectedCaseId = refs.sourceCaseField?.value ?? "";
  return state.latestCaseCatalog?.cases?.find((item) => item.caseId === selectedCaseId) ?? null;
}

function translateChangeType(value) {
  return copy().changeTypes[value] ?? value ?? copy().labels.unknown;
}

function translateRiskLevel(value) {
  return copy().riskLevels[value] ?? value ?? copy().labels.unknown;
}

function formatProviderLabel(provider) {
  return copy().providers[provider] ?? provider ?? copy().labels.unknown;
}

function formatTimelineLabel(result = {}) {
  const parts = [];
  if (result.effectiveDate) {
    parts.push(`${copy().labels.effectiveDate} ${result.effectiveDate}`);
  }
  if (result.promulgationDate) {
    parts.push(`${copy().labels.promulgationDate} ${result.promulgationDate}`);
  }
  return parts.join(" / ") || copy().labels.noTimeline;
}

function formatRunTime(value) {
  if (!value) {
    return copy().labels.unknown;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(state.locale === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function parseErrorMessage(errorBody) {
  if (!errorBody || typeof errorBody !== "object") {
    return "";
  }
  if (typeof errorBody.error === "string") {
    return errorBody.error;
  }
  if (errorBody.error?.message) {
    const detail = Array.isArray(errorBody.error.details) && errorBody.error.details[0];
    return detail ? `${errorBody.error.message} (${detail.path}: ${detail.message})` : errorBody.error.message;
  }
  return typeof errorBody.detail === "string" ? errorBody.detail : "";
}

function setTextStatus(element, className, message, type = "neutral") {
  if (!element) {
    return;
  }
  element.textContent = message;
  element.className = `${className} ${className}-${type}`;
}

function setStatus(message, type = "neutral") {
  setTextStatus(refs.statusView, "status", message, type);
}

function setSourceStatus(message, type = "neutral") {
  setTextStatus(refs.sourceStatusView, "subtle", message, type);
}

function setSourceHelp(message, type = "neutral") {
  if (!refs.sourceHelpView) {
    return;
  }
  refs.sourceHelpView.textContent = message;
  refs.sourceHelpView.className = `source-help subtle subtle-${type}`;
}

function setSourceSearchStatus(message, type = "neutral") {
  setTextStatus(refs.sourceSearchStatusView, "subtle", message, type);
}

function setLatestStatus(message, type = "neutral") {
  setTextStatus(refs.latestStatusView, "subtle", message, type);
}

function setHistoryStatus(message, type = "neutral") {
  setTextStatus(refs.historyStatusView, "subtle", message, type);
}

function setDocumentStatus(message, type = "neutral") {
  setTextStatus(refs.documentStatusView, "subtle", message, type);
}

function latestDiscoverySupported() {
  return state.mode === "live" && currentProvider() === "law-go-public";
}

function formatMunicipalityScope(codes = state.selectedMunicipalities) {
  if (!codes.length) {
    return copy().messages.latestNationwide;
  }
  const names = MUNICIPALITIES.filter((item) => codes.includes(item.code)).map((item) => item.name);
  return names.length <= 2 ? names.join(", ") : copy().messages.latestMunicipalityCount(names.length);
}

function normalizeAnalyzeResponse(result = {}) {
  const analysis = result.analysis ?? {};
  return {
    changes: analysis.changes ?? result.changes ?? [],
    mapped: analysis.impactedDocuments ?? result.mapped ?? [],
    risks: analysis.risks ?? result.risks ?? [],
    drafts: result.drafts ?? {}
  };
}

function renderDocumentFileName() {
  if (refs.documentFileNameView) {
    refs.documentFileNameView.textContent = state.currentDocumentFileName || copy().documentInspect.fileHint;
  }
}

function populateProviderOptions() {
  if (!refs.sourceProviderField) {
    return;
  }
  const current = REMOTE_PROVIDERS.includes(refs.sourceProviderField.value) ? refs.sourceProviderField.value : REMOTE_PROVIDERS[0];
  refs.sourceProviderField.innerHTML = "";
  for (const provider of REMOTE_PROVIDERS) {
    const option = document.createElement("option");
    option.value = provider;
    option.textContent = formatProviderLabel(provider);
    option.selected = provider === current;
    refs.sourceProviderField.append(option);
  }
}

function populateCaseCatalog() {
  if (!refs.sourceCaseField) {
    return;
  }
  const cases = Array.isArray(state.latestCaseCatalog?.cases) ? state.latestCaseCatalog.cases : [];
  const previous = refs.sourceCaseField.value;
  const defaultCaseId =
    previous && cases.some((entry) => entry.caseId === previous)
      ? previous
      : state.latestCaseCatalog?.defaultCaseId || cases.find((entry) => entry.defaultSample)?.caseId || "";

  refs.sourceCaseField.innerHTML = "";
  if (!cases.length) {
    refs.sourceCaseField.innerHTML = `<option value="">${copy().labels.loading}</option>`;
    refs.sourceCaseField.disabled = true;
    return;
  }
  for (const entry of cases) {
    const option = document.createElement("option");
    option.value = entry.caseId ?? "";
    option.selected = entry.caseId === defaultCaseId;
    option.textContent = entry.municipality ? `${entry.municipality} - ${entry.officialKoreanTitle || entry.title}` : entry.title;
    refs.sourceCaseField.append(option);
  }
  refs.sourceCaseField.disabled = false;
}

function applyStaticCopy() {
  document.documentElement.lang = copy().meta.htmlLang;
  document.title = copy().meta.title;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    const text = getMessage(state.locale, element.dataset.i18n);
    if (text) {
      element.textContent = text;
    }
  }
  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    const text = getMessage(state.locale, element.dataset.i18nPlaceholder);
    if (text) {
      element.setAttribute("placeholder", text);
    }
  }
  for (const button of refs.languageButtons) {
    const locale = button.dataset.locale;
    button.textContent = copy().locale[locale] ?? locale;
    button.setAttribute("aria-pressed", String(locale === state.locale));
  }
  populateProviderOptions();
  populateCaseCatalog();
  renderQuickStart(refs.quickStartView, copy().guide.steps);
  renderDocumentFileName();
}

function setPage(page) {
  state.page = page === "inspect" ? "inspect" : "search";
  if (refs.sheetFront) {
    refs.sheetFront.dataset.activePage = state.page;
  }
  if (refs.searchPageView) {
    refs.searchPageView.hidden = state.page !== "search";
  }
  if (refs.inspectPageView) {
    refs.inspectPageView.hidden = state.page !== "inspect";
  }
  if (refs.pageCurrentView) {
    refs.pageCurrentView.textContent = state.page === "search" ? "01" : "02";
  }
  if (refs.pageCurrentLabelView) {
    refs.pageCurrentLabelView.textContent = state.page === "search" ? copy().pages.search : copy().pages.inspect;
  }
  if (refs.sheetFooterCopyView) {
    refs.sheetFooterCopyView.textContent = state.page === "search" ? copy().binder.footerSearch : copy().binder.footerInspect;
  }
  for (const [button, name] of [[refs.pageSearchButton, "search"], [refs.pageInspectButton, "inspect"]]) {
    if (!button) {
      continue;
    }
    const active = state.page === name;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-selected", String(active));
  }
}

function updateModePanels() {
  if (refs.sampleModePanel) {
    refs.sampleModePanel.hidden = state.mode !== "sample";
  }
  if (refs.liveModePanel) {
    refs.liveModePanel.hidden = state.mode !== "live";
  }
  if (refs.sourceModeSummaryView) {
    refs.sourceModeSummaryView.textContent = state.mode === "sample" ? copy().source.sampleSummary : copy().source.liveSummary;
  }
  if (refs.runButton) {
    refs.runButton.textContent = state.mode === "sample" ? copy().buttons.runSample : copy().buttons.runLive;
  }
  for (const [button, mode] of [[refs.modeSampleButton, "sample"], [refs.modeLiveButton, "live"]]) {
    if (!button) {
      continue;
    }
    const active = state.mode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function updateSourceControls() {
  updateModePanels();
  if (state.mode === "sample") {
    const selectedCase = getSelectedCase();
    setSourceStatus(copy().messages.sampleReady, "success");
    setSourceHelp(copy().messages.sampleHelp(selectedCase?.officialKoreanTitle || selectedCase?.title, selectedCase?.municipality), "neutral");
    setSourceSearchStatus(copy().messages.sourceSearchUnavailable, "neutral");
    setLatestStatus(copy().messages.latestSampleMode, "neutral");
    return;
  }

  const sourceStatus = state.latestRequestedSourceStatus?.requestedProvider === currentProvider()
    ? state.latestRequestedSourceStatus.source
    : null;
  const providerLabel = formatProviderLabel(currentProvider());
  if (!sourceStatus) {
    setSourceStatus(copy().messages.sourceStatusLoading, "neutral");
    setSourceHelp(copy().source.liveUnavailable, "neutral");
    setSourceSearchStatus(copy().messages.sourceSearchReady, "neutral");
    setLatestStatus(copy().messages.latestReady(formatMunicipalityScope()), "neutral");
    return;
  }
  if (sourceStatus.enabled) {
    setSourceStatus(copy().messages.sourceConfigured(providerLabel), "success");
    setSourceHelp(currentProvider() === "korea-law-mcp" ? copy().messages.liveMcpHelp : copy().messages.liveLawHelp, "neutral");
    return;
  }
  const missingEnv = Array.isArray(sourceStatus.missingEnv) && sourceStatus.missingEnv.length ? sourceStatus.missingEnv.join(", ") : "";
  setSourceStatus(copy().messages.sourceNotConfigured(providerLabel, missingEnv), "error");
  setSourceHelp(copy().source.liveUnavailable, "error");
}

function pushProvenanceItem(items, label, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  items.push({ label, value: String(value) });
}

function buildProvenanceCards() {
  const provider = currentProvider();
  const statusPayload = state.latestRequestedSourceStatus?.requestedProvider === provider ? state.latestRequestedSourceStatus : null;
  const sourceStatus = statusPayload?.source ?? null;
  const probe = statusPayload?.probe ?? null;
  const searchPayload = state.latestSourceSearchResult?.requestedProvider === provider ? state.latestSourceSearchResult : null;
  const latestPayload = state.latestDiscoveryResult?.requestedProvider === provider ? state.latestDiscoveryResult : null;
  const inputSource = state.latestAnalysisMeta?.inputSource ?? null;
  const fields = copy().provenance.fields;

  const sourceItems = [];
  pushProvenanceItem(sourceItems, fields.provider, formatProviderLabel(provider));
  pushProvenanceItem(sourceItems, fields.enabled, sourceStatus ? (sourceStatus.enabled ? copy().labels.yes : copy().labels.no) : copy().labels.unknown);
  pushProvenanceItem(sourceItems, fields.baseUrl, sourceStatus?.baseUrl);
  pushProvenanceItem(sourceItems, fields.endpoint, sourceStatus?.endpoint);
  pushProvenanceItem(sourceItems, fields.probe, probe ? (probe.success ? copy().messages.probeSuccess : copy().messages.probeFailure(probe.error)) : "");
  pushProvenanceItem(sourceItems, fields.missingEnv, Array.isArray(sourceStatus?.missingEnv) ? sourceStatus.missingEnv.join(", ") : "");

  const searchItems = [];
  pushProvenanceItem(searchItems, fields.route, searchPayload?.meta?.searchBackend || latestPayload?.meta?.route);
  pushProvenanceItem(searchItems, fields.resultCount, Array.isArray(searchPayload?.results) ? searchPayload.results.length : "");
  pushProvenanceItem(searchItems, fields.latestCount, Array.isArray(latestPayload?.results) ? latestPayload.results.length : "");
  pushProvenanceItem(
    searchItems,
    fields.municipalities,
    latestPayload?.meta?.nationwide
      ? copy().messages.latestNationwide
      : Array.isArray(latestPayload?.meta?.municipalityNames)
        ? latestPayload.meta.municipalityNames.join(", ")
        : ""
  );

  const analysisItems = [];
  pushProvenanceItem(analysisItems, fields.provider, inputSource ? formatProviderLabel(inputSource.provider) : "");
  pushProvenanceItem(analysisItems, fields.casePack, inputSource?.caseTitle ?? inputSource?.caseId);
  pushProvenanceItem(
    analysisItems,
    fields.pair,
    inputSource?.beforeId && inputSource?.afterId ? `${inputSource.beforeId} -> ${inputSource.afterId}` : ""
  );
  pushProvenanceItem(analysisItems, fields.beforeUrl, inputSource?.beforeReferenceUrl ?? inputSource?.officialUrl);
  pushProvenanceItem(analysisItems, fields.afterUrl, inputSource?.afterReferenceUrl);
  pushProvenanceItem(analysisItems, fields.runId, state.latestAnalysisMeta?.storage?.runId);

  return [
    { title: copy().provenance.selectedSource, items: sourceItems, tone: sourceStatus?.enabled ? "success" : "neutral" },
    { title: copy().provenance.searchRoute, items: searchItems, tone: searchPayload || latestPayload ? "success" : "neutral" },
    { title: copy().provenance.lastAnalysis, items: analysisItems, tone: inputSource ? "success" : "neutral" }
  ];
}

function renderProvenance() {
  renderProvenanceCards(refs.provenanceView, buildProvenanceCards(), { copy: copy() });
}

function renderMunicipalityFiltersFromState() {
  const options = {
    selectedCodes: state.selectedMunicipalities,
    onToggle: (code, checked) => {
      const next = new Set(state.selectedMunicipalities);
      checked ? next.add(code) : next.delete(code);
      state.selectedMunicipalities = [...next];
      renderMunicipalityFiltersFromState();
      void loadLatestDiscovery();
    }
  };
  renderMunicipalityFilters(refs.municipalityFilterView, MUNICIPALITIES, options);
  renderMunicipalityFilters(refs.documentMunicipalityFilterView, MUNICIPALITIES, options);
}

function renderSourceSearchFromState() {
  const recommendation = state.mode === "live" ? state.latestSourceSearchResult?.recommendation : null;
  const results = state.mode === "live" ? state.latestSourceSearchResult?.results ?? [] : [];
  renderSourceSearchRecommendation(refs.sourceSearchRecommendationView, recommendation, {
    copy: copy(),
    formatTimelineLabel,
    onApplyRecommendation: applyRecommendedPair
  });
  if (state.mode !== "live") {
    if (refs.sourceSearchResultsView) {
      refs.sourceSearchResultsView.innerHTML = "";
    }
    return;
  }
  renderSourceSearchResults(refs.sourceSearchResultsView, results, {
    copy: copy(),
    formatTimelineLabel,
    onUseBefore: useResultAsBefore,
    onUseAfter: useResultAsAfter
  });
}

function renderLatestDiscoveryFromState() {
  if (!latestDiscoverySupported()) {
    if (refs.latestOrdinanceListView) {
      refs.latestOrdinanceListView.innerHTML = "";
    }
    return;
  }
  renderLatestOrdinanceList(refs.latestOrdinanceListView, state.latestDiscoveryResult?.results ?? [], {
    copy: copy(),
    formatTimelineLabel,
    onSearchPair: searchLatestPair,
    onUseAsAfter: useLatestAsAfter
  });
}

function renderCurrentResult() {
  const normalized = normalizeAnalyzeResponse(state.latestAnalysisResult ?? {});
  const changesById = new Map(normalized.changes.map((change) => [change.id, change]));
  renderSummaryCards(refs.summaryContainer, normalized.changes, { copy: copy(), translateChangeType });
  renderImpactList(refs.impactListView, normalized.mapped, { copy: copy(), changesById });
  renderRiskList(refs.riskListView, normalized.risks, { copy: copy(), translateRiskLevel, changesById });
  renderDraftView(refs.draftView, normalized.drafts, { copy: copy() });
  return normalized;
}

function renderDocumentReviewMeta(result) {
  if (!refs.documentReviewMetaView) {
    return;
  }
  refs.documentReviewMetaView.innerHTML = "";
  if (!result) {
    return;
  }
  const rows = [
    [copy().documentInspect.fileNameLabel, result.meta?.fileName || state.currentDocumentFileName],
    [copy().documentInspect.riskLabel, translateRiskLevel(result.review?.riskLevel)],
    [copy().documentInspect.searchRouteLabel, result.meta?.search?.route || result.meta?.search?.mode],
    [copy().documentInspect.candidateCountLabel, Array.isArray(result.ordinance?.candidates) ? result.ordinance.candidates.length : 0],
    [copy().documentInspect.detectedQueryLabel, result.detection?.ordinanceTitleQuery],
    [copy().documentInspect.confidenceLabel, result.detection?.confidence]
  ];
  for (const [label, value] of rows) {
    if (!value && value !== 0) {
      continue;
    }
    const line = document.createElement("p");
    line.className = "search-meta";
    line.textContent = `${label}: ${value}`;
    refs.documentReviewMetaView.append(line);
  }
}

function renderDocumentInspectResult() {
  const result = state.latestDocumentInspection;
  renderDocumentMatch(
    refs.documentMatchCardView,
    result
      ? {
          matched: result.ordinance?.matched,
          query: result.detection?.ordinanceTitleQuery,
          confidence: result.detection?.confidence,
          clauseCount: result.ordinance?.document?.clauseCount
        }
      : null,
    { copy: copy(), formatTimelineLabel }
  );
  if (refs.documentSummaryView) {
    refs.documentSummaryView.textContent = result?.review?.summary || copy().documentInspect.emptySummary;
  }
  if (refs.documentAiSummaryView) {
    refs.documentAiSummaryView.textContent = result
      ? `${copy().documentInspect.reasoningLabel}: ${result.detection?.reasoning || copy().labels.unknown}`
      : copy().documentInspect.emptySummary;
  }
  renderDocumentReviewMeta(result);
  renderDocumentIssues(refs.documentIssuesListView, result?.review?.issues ?? [], { copy: copy() });
  renderDocumentChecklist(refs.documentChecklistListView, result?.review?.checklist ?? [], { copy: copy() });
  if (refs.documentDraftView) {
    refs.documentDraftView.textContent = result?.review?.revisedDraft || copy().documentInspect.emptyDraft;
  }
  if (refs.documentDownloadButton) {
    refs.documentDownloadButton.disabled = !(result?.download?.content && result?.download?.fileName);
  }
}

function appendEmptyHistoryMessage(text) {
  if (!refs.historyListView) {
    return;
  }
  refs.historyListView.innerHTML = "";
  const item = document.createElement("p");
  item.className = "empty";
  item.textContent = text;
  refs.historyListView.append(item);
}

function describeRunSource(run) {
  const inputSource = run.result?.meta?.inputSource ?? {};
  if (inputSource.provider === "local-fixture" && inputSource.caseId) {
    return `${formatProviderLabel("local-fixture")} (${inputSource.caseTitle ?? inputSource.caseId})`;
  }
  if (providerUsesSourceIds(inputSource.provider)) {
    const ids = inputSource.beforeId && inputSource.afterId ? ` (${inputSource.beforeId} -> ${inputSource.afterId})` : "";
    return `${formatProviderLabel(inputSource.provider)}${ids}`;
  }
  return inputSource.provider ? formatProviderLabel(inputSource.provider) : formatProviderLabel("local-fixture");
}

function renderHistoryFromState() {
  const payload = state.latestHistoryPayload;
  if (!payload) {
    appendEmptyHistoryMessage(copy().messages.historyLoading);
    return;
  }
  const runs = Array.isArray(payload.runs) ? payload.runs : [];
  const storage = payload.storage ?? {};
  const providerName = storage.provider ?? "storage";
  if (!storage.enabled) {
    appendEmptyHistoryMessage(copy().messages.historyStorageDisabled(providerName));
    setHistoryStatus(copy().messages.historyStorageDisabled(providerName), "neutral");
    return;
  }
  if (!runs.length) {
    appendEmptyHistoryMessage(copy().messages.historyWaiting(providerName));
    setHistoryStatus(copy().messages.historyWaiting(providerName), "neutral");
    return;
  }
  renderHistoryList(refs.historyListView, runs, {
    copy: copy(),
    formatRunTime,
    describeRunSource,
    translateChangeType,
    onSelectRun: (run) => {
      state.latestAnalysisResult = run.result ?? null;
      state.latestAnalysisMeta = run.result?.meta ?? null;
      const normalized = renderCurrentResult();
      renderProvenance();
      setStatus(copy().messages.analysisSuccess(normalized.changes.length), "success");
    }
  });
  setHistoryStatus(copy().messages.historyLoaded(providerName, runs.length), "success");
}

function applyRecommendedPair(recommendation) {
  if (!recommendation?.before?.id || !recommendation?.after?.id) {
    return;
  }
  if (refs.sourceBeforeIdField) {
    refs.sourceBeforeIdField.value = recommendation.before.id;
  }
  if (refs.sourceAfterIdField) {
    refs.sourceAfterIdField.value = recommendation.after.id;
  }
  setSourceSearchStatus(copy().messages.recommendationApplied(recommendation.before.id, recommendation.after.id), "success");
}

function useResultAsBefore(result) {
  if (refs.sourceBeforeIdField) {
    refs.sourceBeforeIdField.value = result.id ?? "";
  }
  setSourceSearchStatus(copy().messages.selectedBefore(result.id ?? copy().labels.unknown), "success");
}

function useResultAsAfter(result) {
  if (refs.sourceAfterIdField) {
    refs.sourceAfterIdField.value = result.id ?? "";
  }
  setSourceSearchStatus(copy().messages.selectedAfter(result.id ?? copy().labels.unknown), "success");
}

function searchLatestPair(result) {
  if (refs.sourceSearchQueryField) {
    refs.sourceSearchQueryField.value = result.title ?? "";
  }
  if (refs.sourceAfterIdField && result.id) {
    refs.sourceAfterIdField.value = result.id;
  }
  setSourceSearchStatus(copy().messages.latestPairSearch(result.title ?? copy().labels.unknown), "success");
  void runSourceSearch();
}

function useLatestAsAfter(result) {
  if (refs.sourceAfterIdField) {
    refs.sourceAfterIdField.value = result.id ?? "";
  }
  setLatestStatus(copy().messages.latestAfterSelected(result.id ?? copy().labels.unknown), "success");
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  let json = {};
  try {
    json = await response.json();
  } catch {}
  if (!response.ok) {
    throw new Error(parseErrorMessage(json) || `HTTP ${response.status}`);
  }
  return json;
}

async function loadCaseCatalog() {
  try {
    state.latestCaseCatalog = await fetchJson(ENDPOINTS.caseCatalog);
  } catch {
    state.latestCaseCatalog = null;
  }
  populateCaseCatalog();
}

async function loadSelectedSourceStatus() {
  const provider = currentProvider();
  const probe = provider === "korea-law-mcp" ? "&probe=1" : "";
  try {
    state.latestRequestedSourceStatus = await fetchJson(`${ENDPOINTS.sourceStatus}?provider=${encodeURIComponent(provider)}${probe}`);
  } catch (error) {
    state.latestRequestedSourceStatus = null;
    setSourceStatus(copy().messages.sourceNotConfigured(formatProviderLabel(provider), error.message), "error");
  }
  updateSourceControls();
  renderProvenance();
}

async function loadHistory() {
  setHistoryStatus(copy().messages.historyLoading, "neutral");
  try {
    state.latestHistoryPayload = await fetchJson(ENDPOINTS.history);
    renderHistoryFromState();
  } catch (error) {
    state.latestHistoryPayload = null;
    appendEmptyHistoryMessage(copy().messages.historyLoadFailure(error.message));
    setHistoryStatus(copy().messages.historyLoadFailure(error.message), "error");
  }
}

async function loadLatestDiscovery() {
  if (!latestDiscoverySupported()) {
    state.latestDiscoveryResult = null;
    renderLatestDiscoveryFromState();
    renderProvenance();
    setLatestStatus(copy().messages.latestLawOnly, "neutral");
    return;
  }
  if (refs.latestRefreshButton) {
    refs.latestRefreshButton.disabled = true;
    refs.latestRefreshButton.textContent = copy().buttons.loadingLatest;
  }
  setLatestStatus(copy().messages.latestLoading(formatMunicipalityScope()), "neutral");
  try {
    const municipalities = encodeURIComponent(state.selectedMunicipalities.join(","));
    state.latestDiscoveryResult = await fetchJson(
      `${ENDPOINTS.sourceDiscover}?provider=${encodeURIComponent(currentProvider())}&limit=12&municipalities=${municipalities}`
    );
    renderLatestDiscoveryFromState();
    renderProvenance();
    setLatestStatus(
      copy().messages.latestLoaded(
        Array.isArray(state.latestDiscoveryResult.results) ? state.latestDiscoveryResult.results.length : 0,
        formatMunicipalityScope(state.latestDiscoveryResult.meta?.municipalityCodes ?? state.selectedMunicipalities)
      ),
      "success"
    );
  } catch (error) {
    state.latestDiscoveryResult = null;
    renderLatestDiscoveryFromState();
    setLatestStatus(copy().messages.latestLoadFailure(error.message), "error");
  } finally {
    if (refs.latestRefreshButton) {
      refs.latestRefreshButton.disabled = false;
      refs.latestRefreshButton.textContent = copy().buttons.refreshLatest;
    }
  }
}

async function runSourceSearch() {
  if (state.mode !== "live") {
    setSourceSearchStatus(copy().messages.sourceSearchUnavailable, "neutral");
    return;
  }
  const query = refs.sourceSearchQueryField?.value.trim() ?? "";
  if (!query) {
    setSourceSearchStatus(copy().messages.sourceSearchNeedQuery, "error");
    return;
  }
  if (refs.sourceSearchButton) {
    refs.sourceSearchButton.disabled = true;
    refs.sourceSearchButton.textContent = copy().buttons.searching;
  }
  setSourceSearchStatus(copy().messages.sourceSearchLoading, "neutral");
  try {
    state.latestSourceSearchResult = await fetchJson(
      `${ENDPOINTS.sourceSearch}?provider=${encodeURIComponent(currentProvider())}&query=${encodeURIComponent(query)}&limit=6`
    );
    renderSourceSearchFromState();
    renderProvenance();
    setSourceSearchStatus(
      copy().messages.sourceSearchLoaded(state.latestSourceSearchResult.results?.length ?? 0, Boolean(state.latestSourceSearchResult.recommendation)),
      "success"
    );
  } catch (error) {
    state.latestSourceSearchResult = null;
    renderSourceSearchFromState();
    setSourceSearchStatus(copy().messages.sourceSearchFailure(error.message), "error");
  } finally {
    if (refs.sourceSearchButton) {
      refs.sourceSearchButton.disabled = false;
      refs.sourceSearchButton.textContent = copy().buttons.search;
    }
  }
}

function buildAnalyzePayload() {
  if (state.mode === "sample") {
    const caseId = refs.sourceCaseField?.value.trim() ?? "";
    return { source: caseId ? { provider: "local-fixture", caseId } : { provider: "local-fixture" } };
  }
  const beforeId = refs.sourceBeforeIdField?.value.trim() ?? "";
  const afterId = refs.sourceAfterIdField?.value.trim() ?? "";
  if (!beforeId || !afterId) {
    throw new Error(copy().messages.livePairRequired(formatProviderLabel(currentProvider())));
  }
  return { source: { provider: currentProvider(), beforeId, afterId } };
}

async function runAnalyze() {
  if (refs.runButton) {
    refs.runButton.disabled = true;
    refs.runButton.textContent = copy().buttons.running;
  }
  setStatus(copy().messages.runningAnalysis, "loading");
  try {
    state.latestAnalysisResult = await fetchJson(ENDPOINTS.analyze, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildAnalyzePayload())
    });
    state.latestAnalysisMeta = state.latestAnalysisResult.meta ?? null;
    const normalized = renderCurrentResult();
    renderProvenance();
    setStatus(copy().messages.analysisSuccess(normalized.changes.length), "success");
    await loadHistory();
  } catch (error) {
    state.latestAnalysisResult = null;
    state.latestAnalysisMeta = null;
    renderCurrentResult();
    renderProvenance();
    setStatus(copy().messages.analysisFailure(error.message), "error");
  } finally {
    if (refs.runButton) {
      refs.runButton.disabled = false;
      refs.runButton.textContent = state.mode === "sample" ? copy().buttons.runSample : copy().buttons.runLive;
    }
  }
}

function buildDocumentInspectPayload() {
  const documentText = refs.documentTextField?.value.trim() ?? "";
  if (!documentText) {
    throw new Error(copy().messages.documentNeedText);
  }
  return {
    documentText,
    fileName: state.currentDocumentFileName,
    municipalities: state.selectedMunicipalities,
    provider: "law-go-public"
  };
}

async function runDocumentInspect() {
  if (refs.documentInspectButton) {
    refs.documentInspectButton.disabled = true;
    refs.documentInspectButton.textContent = copy().buttons.inspectingDocument;
  }
  if (refs.documentClearButton) {
    refs.documentClearButton.disabled = true;
  }
  setDocumentStatus(copy().messages.documentInspecting, "loading");
  try {
    state.latestDocumentInspection = await fetchJson(ENDPOINTS.documentInspect, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDocumentInspectPayload())
    });
    renderDocumentInspectResult();
    setDocumentStatus(copy().messages.documentInspectSuccess(state.latestDocumentInspection.ordinance?.matched?.title ?? copy().labels.unknown), "success");
  } catch (error) {
    state.latestDocumentInspection = null;
    renderDocumentInspectResult();
    setDocumentStatus(copy().messages.documentInspectFailure(error.message), "error");
  } finally {
    if (refs.documentInspectButton) {
      refs.documentInspectButton.disabled = false;
      refs.documentInspectButton.textContent = copy().buttons.inspectDocument;
    }
    if (refs.documentClearButton) {
      refs.documentClearButton.disabled = false;
    }
  }
}

async function handleDocumentFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  setDocumentStatus(copy().messages.documentLoadingFile, "loading");
  try {
    const text = await file.text();
    state.currentDocumentFileName = file.name;
    if (refs.documentTextField) {
      refs.documentTextField.value = text;
    }
    renderDocumentFileName();
    setDocumentStatus(copy().messages.documentFileLoaded(file.name), "success");
  } catch (error) {
    state.currentDocumentFileName = "";
    renderDocumentFileName();
    setDocumentStatus(copy().messages.documentInspectFailure(error.message), "error");
  }
}

function clearDocumentInput() {
  state.currentDocumentFileName = "";
  state.latestDocumentInspection = null;
  if (refs.documentTextField) {
    refs.documentTextField.value = "";
  }
  if (refs.documentFileInput) {
    refs.documentFileInput.value = "";
  }
  renderDocumentFileName();
  renderDocumentInspectResult();
  setDocumentStatus(copy().messages.documentCleared, "neutral");
}

function downloadDocumentDraft() {
  const download = state.latestDocumentInspection?.download;
  if (!download?.content || !download.fileName) {
    return;
  }
  const blob = new Blob([download.content], { type: download.contentType || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = download.fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setDocumentStatus(copy().messages.downloadReady(download.fileName), "success");
}

function setMode(mode, options = {}) {
  state.mode = mode === "live" ? "live" : "sample";
  if (state.mode === "sample") {
    state.latestSourceSearchResult = null;
    state.latestDiscoveryResult = null;
  }
  updateSourceControls();
  renderSourceSearchFromState();
  renderLatestDiscoveryFromState();
  renderProvenance();
  if (options.reload !== false) {
    void loadSelectedSourceStatus();
    if (state.mode === "live") {
      void loadLatestDiscovery();
    }
  }
  if (options.run) {
    void runAnalyze();
  }
  if (options.focus) {
    (state.mode === "sample" ? refs.sourceCaseField : refs.sourceSearchQueryField)?.focus();
  }
}

function setLanguage(locale) {
  state.locale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  saveLocale(state.locale);
  applyStaticCopy();
  setPage(state.page);
  updateModePanels();
  renderMunicipalityFiltersFromState();
  renderSourceSearchFromState();
  renderLatestDiscoveryFromState();
  renderCurrentResult();
  renderHistoryFromState();
  renderDocumentInspectResult();
  renderProvenance();
  updateSourceControls();
}

function attachEventListeners() {
  refs.pageSearchButton?.addEventListener("click", () => setPage("search"));
  refs.pageInspectButton?.addEventListener("click", () => setPage("inspect"));
  refs.runButton?.addEventListener("click", () => void runAnalyze());
  refs.sampleShortcutButton?.addEventListener("click", () => {
    setPage("search");
    setMode("sample", { run: true, focus: true });
  });
  refs.liveShortcutButton?.addEventListener("click", () => {
    setPage("search");
    setMode("live", { focus: true });
  });
  refs.modeSampleButton?.addEventListener("click", () => setMode("sample", { focus: true }));
  refs.modeLiveButton?.addEventListener("click", () => setMode("live", { focus: true }));
  refs.sourceProviderField?.addEventListener("change", () => {
    state.latestSourceSearchResult = null;
    state.latestDiscoveryResult = null;
    renderSourceSearchFromState();
    renderLatestDiscoveryFromState();
    void loadSelectedSourceStatus();
    void loadLatestDiscovery();
  });
  refs.sourceCaseField?.addEventListener("change", () => {
    updateSourceControls();
    renderProvenance();
  });
  refs.sourceSearchButton?.addEventListener("click", () => void runSourceSearch());
  refs.sourceSearchQueryField?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void runSourceSearch();
    }
  });
  refs.latestRefreshButton?.addEventListener("click", () => void loadLatestDiscovery());
  const selectAll = () => {
    state.selectedMunicipalities = MUNICIPALITIES.map((item) => item.code);
    renderMunicipalityFiltersFromState();
    void loadLatestDiscovery();
  };
  const clearAll = () => {
    state.selectedMunicipalities = [];
    renderMunicipalityFiltersFromState();
    void loadLatestDiscovery();
  };
  refs.municipalitySelectAllButton?.addEventListener("click", selectAll);
  refs.documentMunicipalitySelectAllButton?.addEventListener("click", selectAll);
  refs.municipalityClearButton?.addEventListener("click", clearAll);
  refs.documentMunicipalityClearButton?.addEventListener("click", clearAll);
  refs.documentFileInput?.addEventListener("change", (event) => void handleDocumentFileChange(event));
  refs.documentInspectButton?.addEventListener("click", () => void runDocumentInspect());
  refs.documentClearButton?.addEventListener("click", clearDocumentInput);
  refs.documentDownloadButton?.addEventListener("click", downloadDocumentDraft);
  for (const button of refs.languageButtons) {
    button.addEventListener("click", () => {
      const locale = button.dataset.locale;
      if (locale && locale !== state.locale) {
        setLanguage(locale);
      }
    });
  }
}

async function init() {
  applyStaticCopy();
  setPage("search");
  updateModePanels();
  renderMunicipalityFiltersFromState();
  renderCurrentResult();
  renderDocumentInspectResult();
  attachEventListeners();
  setStatus(copy().messages.ready, "neutral");
  setSourceStatus(copy().messages.sourceStatusLoading, "neutral");
  setSourceHelp(copy().source.localHint, "neutral");
  setSourceSearchStatus(copy().messages.sourceSearchUnavailable, "neutral");
  setLatestStatus(copy().messages.latestSampleMode, "neutral");
  setHistoryStatus(copy().messages.historyLoading, "neutral");
  setDocumentStatus(copy().messages.ready, "neutral");
  await loadCaseCatalog();
  await loadSelectedSourceStatus();
  await loadHistory();
  await runAnalyze();
}

void init();
