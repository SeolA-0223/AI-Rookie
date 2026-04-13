import { DEFAULT_LOCALE, SUPPORTED_LOCALES, getCopy, getMessage } from "./i18n.js";
import {
  renderDraftView,
  renderHistoryList,
  renderImpactList,
  renderProvenanceCards,
  renderQuickStart,
  renderRiskList,
  renderSourceSearchRecommendation,
  renderSourceSearchResults,
  renderSummaryCards
} from "./view.js";

const HEALTH_ENDPOINT = "/api/health";
const CASE_CATALOG_ENDPOINT = "/api/case-catalog";
const SOURCE_SEARCH_ENDPOINT = "/api/source-search";
const SOURCE_STATUS_ENDPOINT = "/api/source-status";
const ANALYZE_ENDPOINT = "/api/analyze";
const HISTORY_ENDPOINT = "/api/history?limit=6";
const LOCALE_STORAGE_KEY = "ai-rookie-locale";
const REMOTE_PROVIDERS = ["law-go-public", "korea-law-mcp"];

const runButton = document.getElementById("analyze-btn");
const statusView = document.getElementById("status-msg");
const sourceStatusView = document.getElementById("source-status");
const sourceHelpView = document.getElementById("source-help");
const sourceModeSummaryView = document.getElementById("source-mode-summary");
const sourceSearchStatusView = document.getElementById("source-search-status");
const historyStatusView = document.getElementById("history-status");
const sourceProviderField = document.getElementById("source-provider");
const sourceCaseField = document.getElementById("source-case-id");
const sourceSearchQueryField = document.getElementById("source-search-query");
const sourceSearchButton = document.getElementById("source-search-btn");
const sourceBeforeIdField = document.getElementById("source-before-id");
const sourceAfterIdField = document.getElementById("source-after-id");
const summaryContainer = document.getElementById("summary-cards");
const impactListView = document.getElementById("impact-list");
const riskListView = document.getElementById("risk-list");
const draftView = document.getElementById("draft-view");
const historyListView = document.getElementById("history-list");
const provenanceView = document.getElementById("provenance-cards");
const sourceSearchRecommendationView = document.getElementById("source-search-recommendation");
const sourceSearchResultsView = document.getElementById("source-search-results");
const quickStartView = document.getElementById("quickstart-steps");
const sampleShortcutButton = document.getElementById("sample-shortcut-btn");
const liveShortcutButton = document.getElementById("live-shortcut-btn");
const modeSampleButton = document.getElementById("mode-sample-btn");
const modeLiveButton = document.getElementById("mode-live-btn");
const sampleModePanel = document.getElementById("sample-mode-panel");
const liveModePanel = document.getElementById("live-mode-panel");
const languageButtons = Array.from(document.querySelectorAll("[data-locale]"));

const state = {
  locale: loadStoredLocale(),
  mode: "sample",
  latestHealth: null,
  latestRequestedSourceStatus: null,
  latestSourceSearchResult: null,
  latestCaseCatalog: null,
  latestAnalysisMeta: null,
  latestAnalysisResult: null,
  latestHistoryPayload: null
};

function loadStoredLocale() {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return SUPPORTED_LOCALES.includes(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function saveLocale(locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {}
}

function copy() {
  return getCopy(state.locale);
}

function currentProvider() {
  return state.mode === "sample" ? "local-fixture" : sourceProviderField?.value || REMOTE_PROVIDERS[0];
}

function providerUsesSourceIds(provider) {
  return provider === "law-go-public" || provider === "korea-law-mcp";
}

function getSelectedCase() {
  const selectedCaseId = sourceCaseField?.value ?? "";
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
  const timeline = [];
  if (result.effectiveDate) {
    timeline.push(`${copy().labels.effectiveDate} ${result.effectiveDate}`);
  }
  if (result.promulgationDate) {
    timeline.push(`${copy().labels.promulgationDate} ${result.promulgationDate}`);
  }
  return timeline.join(" / ") || copy().labels.noTimeline;
}

function formatProbeStatus(probe) {
  if (!probe) {
    return copy().messages.probeUnavailable;
  }
  return probe.success ? copy().messages.probeSuccess : copy().messages.probeFailure(probe.error);
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

function setStatus(message, type = "neutral") {
  if (!statusView) {
    return;
  }
  statusView.textContent = message;
  statusView.className = `status status-${type}`;
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

function setHistoryStatus(message, type = "neutral") {
  if (!historyStatusView) {
    return;
  }
  historyStatusView.textContent = message;
  historyStatusView.className = `subtle subtle-${type}`;
}

function setRunButtonLoading(loading) {
  if (!runButton) {
    return;
  }
  runButton.disabled = loading;
  runButton.textContent = loading ? copy().buttons.running : state.mode === "sample" ? copy().buttons.runSample : copy().buttons.runLive;
}

function setSourceSearchLoading(loading) {
  if (!sourceSearchButton) {
    return;
  }
  sourceSearchButton.disabled = loading;
  sourceSearchButton.textContent = loading ? copy().buttons.searching : copy().buttons.search;
}

function populateProviderOptions() {
  if (!sourceProviderField) {
    return;
  }
  const previousValue = REMOTE_PROVIDERS.includes(sourceProviderField.value) ? sourceProviderField.value : REMOTE_PROVIDERS[0];
  sourceProviderField.innerHTML = "";
  for (const provider of REMOTE_PROVIDERS) {
    const option = document.createElement("option");
    option.value = provider;
    option.textContent = formatProviderLabel(provider);
    option.selected = provider === previousValue;
    sourceProviderField.append(option);
  }
}

function populateCaseCatalog() {
  if (!sourceCaseField) {
    return;
  }
  const previousCaseId = sourceCaseField.value;
  const cases = Array.isArray(state.latestCaseCatalog?.cases) ? state.latestCaseCatalog.cases : [];
  const defaultCaseId =
    previousCaseId && cases.some((entry) => entry.caseId === previousCaseId)
      ? previousCaseId
      : typeof state.latestCaseCatalog?.defaultCaseId === "string" && state.latestCaseCatalog.defaultCaseId
      ? state.latestCaseCatalog.defaultCaseId
      : cases.find((entry) => entry.defaultSample)?.caseId ?? "";

  sourceCaseField.innerHTML = "";
  if (!cases.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = copy().labels.loading;
    sourceCaseField.append(option);
    sourceCaseField.disabled = true;
    return;
  }

  for (const entry of cases) {
    const option = document.createElement("option");
    option.value = entry.caseId ?? "";
    const visibleTitle = entry.officialKoreanTitle || entry.title || entry.caseId || copy().labels.unknown;
    option.textContent = entry.municipality ? `${entry.municipality} - ${visibleTitle}` : visibleTitle;
    option.selected = entry.caseId === defaultCaseId;
    sourceCaseField.append(option);
  }
  sourceCaseField.disabled = false;
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

  for (const button of languageButtons) {
    const locale = button.dataset.locale;
    button.textContent = copy().locale[locale] ?? locale;
    button.setAttribute("aria-pressed", String(locale === state.locale));
  }

  populateProviderOptions();
  renderQuickStart(quickStartView, copy().guide.steps);
}

function updateModeButtons() {
  for (const [button, mode] of [
    [modeSampleButton, "sample"],
    [modeLiveButton, "live"]
  ]) {
    if (!button) {
      continue;
    }
    const isActive = state.mode === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function updateModePanels() {
  if (sampleModePanel) {
    sampleModePanel.hidden = state.mode !== "sample";
  }
  if (liveModePanel) {
    liveModePanel.hidden = state.mode !== "live";
  }
  if (sourceModeSummaryView) {
    sourceModeSummaryView.textContent = state.mode === "sample" ? copy().source.sampleSummary : copy().source.liveSummary;
  }
  if (runButton) {
    runButton.textContent = state.mode === "sample" ? copy().buttons.runSample : copy().buttons.runLive;
  }
  updateModeButtons();
}

function getSelectedSourceStatus() {
  return state.latestRequestedSourceStatus?.requestedProvider === currentProvider() ? state.latestRequestedSourceStatus.source : null;
}

function updateSourceControls() {
  updateModePanels();

  if (state.mode === "sample") {
    const selectedCase = getSelectedCase();
    const sourceStatus = getSelectedSourceStatus();
    setSourceStatus(
      sourceStatus?.enabled === false ? copy().messages.sourceNotConfigured(formatProviderLabel("local-fixture")) : copy().messages.sampleReady,
      sourceStatus?.enabled === false ? "error" : "success"
    );
    setSourceHelp(copy().messages.sampleHelp(selectedCase?.officialKoreanTitle || selectedCase?.title, selectedCase?.municipality), "neutral");
    setSourceSearchStatus(copy().messages.sourceSearchUnavailable, "neutral");
    return;
  }

  const provider = currentProvider();
  const sourceStatus = getSelectedSourceStatus();
  const providerLabel = formatProviderLabel(provider);

  if (!sourceStatus) {
    setSourceStatus(copy().messages.sourceStatusLoading, "neutral");
    setSourceHelp(copy().source.liveUnavailable, "neutral");
    setSourceSearchStatus(copy().messages.sourceSearchReady, "neutral");
    return;
  }

  if (sourceStatus.enabled) {
    setSourceStatus(copy().messages.sourceConfigured(providerLabel), "success");
    setSourceHelp(provider === "korea-law-mcp" ? copy().messages.liveMcpHelp : copy().messages.liveLawHelp, "neutral");
    if (!state.latestSourceSearchResult) {
      setSourceSearchStatus(copy().messages.sourceSearchReady, "neutral");
    }
    return;
  }

  const missingEnv = Array.isArray(sourceStatus.missingEnv) && sourceStatus.missingEnv.length ? sourceStatus.missingEnv.join(", ") : "";
  const detail = missingEnv ? `${copy().provenance.fields.missingEnv}: ${missingEnv}.` : "";
  setSourceStatus(copy().messages.sourceNotConfigured(providerLabel, detail), "error");
  setSourceHelp(copy().source.liveUnavailable, "error");
  if (!state.latestSourceSearchResult) {
    setSourceSearchStatus(copy().messages.sourceNotConfigured(providerLabel), "error");
  }
}

function setLanguage(locale) {
  state.locale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  saveLocale(state.locale);
  applyStaticCopy();
  renderCurrentResult();
  renderHistoryFromState();
  renderSourceSearchFromState();
  renderProvenance();
  updateSourceControls();
}

function clearSearchResults() {
  renderSourceSearchRecommendation(sourceSearchRecommendationView, null, {
    copy: copy(),
    formatTimelineLabel,
    onApplyRecommendation: () => {}
  });
  if (sourceSearchResultsView) {
    sourceSearchResultsView.innerHTML = "";
  }
}

function setMode(mode, { run = false, focus = false, reloadStatus = true } = {}) {
  state.mode = mode === "live" ? "live" : "sample";
  if (state.mode === "sample") {
    state.latestSourceSearchResult = null;
    clearSearchResults();
  }
  updateSourceControls();
  renderProvenance();

  if (focus) {
    const target = state.mode === "sample" ? sourceCaseField : sourceSearchQueryField;
    target?.focus();
  }

  if (reloadStatus) {
    setSourceStatus(copy().messages.sourceStatusLoading, "neutral");
    void loadSelectedSourceStatus();
  }

  if (run) {
    void runAnalyze();
  }
}

function pushProvenanceItem(items, label, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  items.push({ label, value: String(value) });
}

function buildProvenanceCards() {
  const provider = currentProvider();
  const selectedCase = getSelectedCase();
  const statusPayload = state.latestRequestedSourceStatus?.requestedProvider === provider ? state.latestRequestedSourceStatus : null;
  const sourceStatus = statusPayload?.source ?? null;
  const probe = statusPayload?.probe ?? null;
  const searchPayload = state.latestSourceSearchResult?.requestedProvider === provider ? state.latestSourceSearchResult : null;
  const searchMeta = searchPayload?.meta ?? {};
  const searchDiagnostics = searchMeta.diagnostics ?? {};
  const inputSource = state.latestAnalysisMeta?.inputSource ?? null;
  const fields = copy().provenance.fields;

  const providerItems = [];
  pushProvenanceItem(providerItems, fields.provider, formatProviderLabel(provider));
  pushProvenanceItem(
    providerItems,
    fields.enabled,
    sourceStatus ? (sourceStatus.enabled ? copy().labels.yes : copy().labels.no) : copy().labels.unknown
  );
  pushProvenanceItem(providerItems, fields.baseUrl, sourceStatus?.baseUrl);
  pushProvenanceItem(providerItems, fields.endpoint, sourceStatus?.endpoint);
  pushProvenanceItem(
    providerItems,
    fields.ocMode,
    sourceStatus?.ocMode === "env"
      ? copy().messages.ocEnv
      : sourceStatus?.ocMode === "test-demo"
        ? copy().messages.ocDemo
        : ""
  );
  pushProvenanceItem(providerItems, fields.casePack, selectedCase?.officialKoreanTitle || selectedCase?.title);
  pushProvenanceItem(providerItems, fields.probe, provider === "korea-law-mcp" ? formatProbeStatus(probe) : "");
  pushProvenanceItem(providerItems, fields.availableToolCount, probe?.success ? probe.availableToolCount : "");
  pushProvenanceItem(providerItems, fields.detailTool, probe?.selectedDetailToolName);
  pushProvenanceItem(providerItems, fields.searchTool, probe?.selectedSearchToolName);
  pushProvenanceItem(
    providerItems,
    fields.missingEnv,
    Array.isArray(sourceStatus?.missingEnv) && sourceStatus.missingEnv.length ? sourceStatus.missingEnv.join(", ") : ""
  );

  const cards = [
    {
      title: copy().provenance.selectedSource,
      items: providerItems,
      tone: sourceStatus?.enabled ? "success" : "neutral"
    }
  ];

  if (providerUsesSourceIds(provider)) {
    const searchItems = [];
    pushProvenanceItem(
      searchItems,
      fields.status,
      searchPayload ? copy().messages.metadataLoaded : copy().messages.notSearchedYet
    );
    pushProvenanceItem(searchItems, fields.route, searchMeta.searchBackend || searchMeta.toolName);
    pushProvenanceItem(
      searchItems,
      fields.queryVariants,
      Array.isArray(searchDiagnostics.queryVariants) ? searchDiagnostics.queryVariants.join(" -> ") : ""
    );
    pushProvenanceItem(
      searchItems,
      fields.recommendation,
      searchPayload ? (searchPayload.recommendation ? copy().messages.recommendationAvailable : copy().messages.recommendationMissing) : ""
    );
    pushProvenanceItem(
      searchItems,
      fields.historyExpanded,
      typeof searchMeta.historyExpanded === "boolean"
        ? searchMeta.historyExpanded
          ? copy().messages.expansionYes
          : copy().messages.expansionNo
        : ""
    );
    pushProvenanceItem(
      searchItems,
      fields.curatedFallback,
      searchDiagnostics.curatedFallbackUsed ? (searchDiagnostics.curatedFallbackCaseIds ?? []).join(", ") : ""
    );
    pushProvenanceItem(searchItems, fields.exactTitleMatchCount, searchDiagnostics.exactTitleMatchCount);
    pushProvenanceItem(searchItems, fields.resultCount, Array.isArray(searchPayload?.results) ? searchPayload.results.length : "");

    cards.push({
      title: copy().provenance.searchRoute,
      items: searchItems,
      tone: searchPayload ? "success" : "neutral"
    });
  }

  const analysisItems = [];
  pushProvenanceItem(analysisItems, fields.provider, inputSource ? formatProviderLabel(inputSource.provider) : "");
  pushProvenanceItem(analysisItems, fields.casePack, inputSource?.caseTitle ?? inputSource?.caseId);
  pushProvenanceItem(
    analysisItems,
    fields.pair,
    inputSource?.beforeId && inputSource?.afterId ? `${inputSource.beforeId} -> ${inputSource.afterId}` : ""
  );
  pushProvenanceItem(analysisItems, fields.tool, inputSource?.toolName);
  pushProvenanceItem(analysisItems, fields.endpoint, inputSource?.endpoint);
  pushProvenanceItem(analysisItems, fields.baseUrl, inputSource?.baseUrl);
  pushProvenanceItem(analysisItems, fields.beforeUrl, inputSource?.beforeReferenceUrl ?? inputSource?.officialUrl);
  pushProvenanceItem(analysisItems, fields.afterUrl, inputSource?.afterReferenceUrl);
  pushProvenanceItem(analysisItems, fields.runId, state.latestAnalysisMeta?.storage?.runId);

  cards.push({
    title: copy().provenance.lastAnalysis,
    items: analysisItems,
    tone: inputSource ? "success" : "neutral"
  });

  return cards;
}

function renderProvenance() {
  renderProvenanceCards(provenanceView, buildProvenanceCards(), { copy: copy() });
}

function renderSourceSearchFromState() {
  const recommendation = state.mode === "live" ? state.latestSourceSearchResult?.recommendation : null;
  const results = state.mode === "live" ? state.latestSourceSearchResult?.results ?? [] : [];

  renderSourceSearchRecommendation(sourceSearchRecommendationView, recommendation, {
    copy: copy(),
    formatTimelineLabel,
    onApplyRecommendation: applyRecommendedPair
  });

  if (state.mode !== "live") {
    if (sourceSearchResultsView) {
      sourceSearchResultsView.innerHTML = "";
    }
    return;
  }

  renderSourceSearchResults(sourceSearchResultsView, results, {
    copy: copy(),
    formatTimelineLabel,
    onUseBefore: useResultAsBefore,
    onUseAfter: useResultAsAfter
  });
}

function renderCurrentResult() {
  const normalized = normalizeAnalyzeResponse(state.latestAnalysisResult ?? {});
  const changesById = new Map(normalized.changes.map((change) => [change.id, change]));
  renderSummaryCards(summaryContainer, normalized.changes, { copy: copy(), translateChangeType });
  renderImpactList(impactListView, normalized.mapped, { copy: copy(), changesById });
  renderRiskList(riskListView, normalized.risks, { copy: copy(), translateRiskLevel, changesById });
  renderDraftView(draftView, normalized.drafts, { copy: copy() });
  return normalized;
}

function appendEmptyHistoryMessage(text) {
  if (!historyListView) {
    return;
  }
  historyListView.innerHTML = "";
  const element = document.createElement("p");
  element.className = "empty";
  element.textContent = text;
  historyListView.append(element);
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
  if (inputSource.provider) {
    return formatProviderLabel(inputSource.provider);
  }
  return run.source === "custom" ? copy().labels.directInput : formatProviderLabel("local-fixture");
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

  renderHistoryList(historyListView, runs, {
    copy: copy(),
    formatRunTime,
    describeRunSource,
    translateChangeType,
    onSelectRun: (run) => {
      state.latestAnalysisResult = run.result ?? null;
      state.latestAnalysisMeta = run.result?.meta ?? null;
      renderCurrentResult();
      renderProvenance();
      setStatus(copy().messages.analysisSuccess(run.totalChanges), "success");
    }
  });
  setHistoryStatus(copy().messages.historyLoaded(providerName, runs.length), "success");
}

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
  setSourceSearchStatus(copy().messages.recommendationApplied(recommendation.before.id, recommendation.after.id), "success");
}

function useResultAsBefore(result) {
  if (sourceBeforeIdField) {
    sourceBeforeIdField.value = result.id ?? "";
  }
  setSourceSearchStatus(copy().messages.selectedBefore(result.id ?? copy().labels.unknown), "success");
}

function useResultAsAfter(result) {
  if (sourceAfterIdField) {
    sourceAfterIdField.value = result.id ?? "";
  }
  setSourceSearchStatus(copy().messages.selectedAfter(result.id ?? copy().labels.unknown), "success");
}

async function loadHealth() {
  try {
    const response = await fetch(HEALTH_ENDPOINT);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    state.latestHealth = await response.json();
  } catch {
    state.latestHealth = null;
  }
}

async function loadCaseCatalog() {
  try {
    const response = await fetch(CASE_CATALOG_ENDPOINT);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    state.latestCaseCatalog = await response.json();
  } catch {
    state.latestCaseCatalog = null;
  }
  populateCaseCatalog();
}

async function loadSelectedSourceStatus() {
  const provider = currentProvider();
  const probeParam = provider === "korea-law-mcp" ? "&probe=1" : "";

  try {
    const response = await fetch(`${SOURCE_STATUS_ENDPOINT}?provider=${encodeURIComponent(provider)}${probeParam}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    state.latestRequestedSourceStatus = await response.json();
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
    const response = await fetch(HISTORY_ENDPOINT);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    state.latestHistoryPayload = await response.json();
    renderHistoryFromState();
  } catch (error) {
    state.latestHistoryPayload = null;
    appendEmptyHistoryMessage(copy().messages.historyLoadFailure(error.message));
    setHistoryStatus(copy().messages.historyLoadFailure(error.message), "error");
  }
}

async function runSourceSearch() {
  if (state.mode !== "live") {
    setSourceSearchStatus(copy().messages.sourceSearchUnavailable, "neutral");
    return;
  }

  const provider = currentProvider();
  const query = sourceSearchQueryField?.value.trim() ?? "";

  if (!query) {
    setSourceSearchStatus(copy().messages.sourceSearchNeedQuery, "error");
    state.latestSourceSearchResult = null;
    renderSourceSearchFromState();
    renderProvenance();
    return;
  }

  setSourceSearchLoading(true);
  setSourceSearchStatus(copy().messages.sourceSearchLoading, "neutral");

  try {
    const response = await fetch(
      `${SOURCE_SEARCH_ENDPOINT}?provider=${encodeURIComponent(provider)}&query=${encodeURIComponent(query)}&limit=6`
    );

    if (!response.ok) {
      let detail = "";
      try {
        detail = parseErrorMessage(await response.json());
      } catch {
        detail = "";
      }
      throw new Error(detail || `HTTP ${response.status}`);
    }

    state.latestSourceSearchResult = await response.json();
    renderSourceSearchFromState();
    renderProvenance();
    setSourceSearchStatus(
      copy().messages.sourceSearchLoaded(
        Array.isArray(state.latestSourceSearchResult.results) ? state.latestSourceSearchResult.results.length : 0,
        Boolean(state.latestSourceSearchResult.recommendation)
      ),
      "success"
    );
  } catch (error) {
    state.latestSourceSearchResult = null;
    renderSourceSearchFromState();
    renderProvenance();
    setSourceSearchStatus(copy().messages.sourceSearchFailure(error.message), "error");
  } finally {
    setSourceSearchLoading(false);
  }
}

function buildAnalyzePayload() {
  if (state.mode === "sample") {
    const selectedCaseId = sourceCaseField?.value.trim() ?? "";
    return {
      source: selectedCaseId
        ? {
            provider: "local-fixture",
            caseId: selectedCaseId
          }
        : {
            provider: "local-fixture"
          }
    };
  }

  const provider = currentProvider();
  const beforeId = sourceBeforeIdField?.value.trim() ?? "";
  const afterId = sourceAfterIdField?.value.trim() ?? "";

  if (!beforeId || !afterId) {
    throw new Error(copy().messages.livePairRequired(formatProviderLabel(provider)));
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
  setRunButtonLoading(true);
  setStatus(copy().messages.runningAnalysis, "loading");

  try {
    const payload = buildAnalyzePayload();
    const response = await fetch(ANALYZE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let detail = "";
      try {
        detail = parseErrorMessage(await response.json());
      } catch {
        detail = "";
      }
      throw new Error(detail || `HTTP ${response.status}`);
    }

    state.latestAnalysisResult = await response.json();
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
    await loadHistory();
  } finally {
    setRunButtonLoading(false);
  }
}

function attachEventListeners() {
  runButton?.addEventListener("click", () => {
    void runAnalyze();
  });

  sampleShortcutButton?.addEventListener("click", () => {
    setMode("sample", { run: true, focus: true });
  });

  liveShortcutButton?.addEventListener("click", () => {
    setMode("live", { focus: true });
  });

  modeSampleButton?.addEventListener("click", () => {
    setMode("sample", { focus: true });
  });

  modeLiveButton?.addEventListener("click", () => {
    setMode("live", { focus: true });
  });

  sourceProviderField?.addEventListener("change", () => {
    state.latestSourceSearchResult = null;
    renderSourceSearchFromState();
    setSourceStatus(copy().messages.sourceStatusLoading, "neutral");
    void loadSelectedSourceStatus();
  });

  sourceCaseField?.addEventListener("change", () => {
    updateSourceControls();
    renderProvenance();
  });

  sourceSearchButton?.addEventListener("click", () => {
    void runSourceSearch();
  });

  sourceSearchQueryField?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void runSourceSearch();
    }
  });

  for (const button of languageButtons) {
    button.addEventListener("click", () => {
      const locale = button.dataset.locale;
      if (!SUPPORTED_LOCALES.includes(locale) || locale === state.locale) {
        return;
      }
      setLanguage(locale);
    });
  }
}

async function init() {
  applyStaticCopy();
  attachEventListeners();

  setStatus(copy().messages.ready, "neutral");
  setSourceStatus(copy().messages.sourceStatusLoading, "neutral");
  setSourceHelp(copy().source.localHint, "neutral");
  setSourceSearchStatus(copy().messages.sourceSearchUnavailable, "neutral");
  setHistoryStatus(copy().messages.historyLoading, "neutral");

  await loadHealth();
  await loadCaseCatalog();
  await loadSelectedSourceStatus();
  await loadHistory();
  await runAnalyze();
}

void init();
