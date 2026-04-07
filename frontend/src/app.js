const HEALTH_ENDPOINT = "/api/health";
const SOURCE_SEARCH_ENDPOINT = "/api/source-search";
const SOURCE_STATUS_ENDPOINT = "/api/source-status";
const ANALYZE_ENDPOINT = "/api/analyze";
const HISTORY_ENDPOINT = "/api/history?limit=6";
const BUTTON_LABEL = "Run Analysis";
const BUTTON_LOADING_LABEL = "Analyzing...";

const runButton = document.getElementById("analyze-btn");
const statusView = document.getElementById("status-msg");
const historyStatusView = document.getElementById("history-status");
const historyListView = document.getElementById("history-list");
const sourceStatusView = document.getElementById("source-status");
const sourceHelpView = document.getElementById("source-help");
const sourceProviderField = document.getElementById("source-provider");
const sourceBeforeGroup = document.getElementById("source-before-group");
const sourceAfterGroup = document.getElementById("source-after-group");
const sourceBeforeIdField = document.getElementById("source-before-id");
const sourceAfterIdField = document.getElementById("source-after-id");
const sourceSearchGroup = document.getElementById("source-search-group");
const sourceSearchQueryField = document.getElementById("source-search-query");
const sourceSearchButton = document.getElementById("source-search-btn");
const sourceSearchStatusView = document.getElementById("source-search-status");
const sourceSearchResultsView = document.getElementById("source-search-results");

let latestHealth = null;
let latestRequestedSourceStatus = null;
let latestSourceSearchResult = null;

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
  sourceSearchButton.textContent = loading ? "Searching..." : "Find IDs";
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

function renderSourceSearchResults(results = []) {
  if (!sourceSearchResultsView) {
    return;
  }

  sourceSearchResultsView.innerHTML = "";

  if (!results.length) {
    sourceSearchResultsView.append(createEmptyMessage("p", "No ordinance candidates found for the current query."));
    return;
  }

  for (const result of results) {
    const card = document.createElement("article");
    card.className = "search-result";

    const title = document.createElement("h3");
    title.textContent = result.title ?? result.id ?? "Untitled ordinance";

    const idLine = document.createElement("p");
    idLine.className = "search-meta";
    idLine.textContent = `ID: ${result.id ?? "Unavailable"}`;

    const jurisdictionParts = [result.jurisdiction, result.effectiveDate && `Effective ${result.effectiveDate}`, result.promulgationDate && `Promulgated ${result.promulgationDate}`]
      .filter(Boolean)
      .join(" / ");

    const meta = document.createElement("p");
    meta.className = "search-meta";
    meta.textContent = jurisdictionParts || "No ordinance metadata returned.";

    const summary = document.createElement("p");
    summary.textContent = result.summary || "No summary returned.";

    const actions = document.createElement("div");
    actions.className = "search-actions";

    const beforeButton = document.createElement("button");
    beforeButton.type = "button";
    beforeButton.className = "secondary-btn";
    beforeButton.textContent = "Use as Before";
    beforeButton.disabled = !result.id;
    beforeButton.addEventListener("click", () => {
      if (sourceBeforeIdField) {
        sourceBeforeIdField.value = result.id ?? "";
      }
      setSourceSearchStatus(`Selected ${result.id} as the before ordinance ID.`, "success");
    });

    const afterButton = document.createElement("button");
    afterButton.type = "button";
    afterButton.className = "secondary-btn";
    afterButton.textContent = "Use as After";
    afterButton.disabled = !result.id;
    afterButton.addEventListener("click", () => {
      if (sourceAfterIdField) {
        sourceAfterIdField.value = result.id ?? "";
      }
      setSourceSearchStatus(`Selected ${result.id} as the after ordinance ID.`, "success");
    });

    actions.append(beforeButton, afterButton);
    card.append(title, idLine, meta, summary, actions);
    sourceSearchResultsView.append(card);
  }
}

function formatProviderLabel(provider) {
  if (provider === "korea-law-mcp") {
    return "Korea Law MCP";
  }
  if (provider === "local-fixture") {
    return "Local Fixture";
  }
  if (provider === "inline") {
    return "Inline Request";
  }
  return provider || "Unknown Source";
}

function describeRunSource(run) {
  const inputSource = run.result?.meta?.inputSource ?? {};
  if (inputSource.provider === "korea-law-mcp") {
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
    return "Custom Input";
  }

  return "Sample Input";
}

function renderSummary(changes = []) {
  const container = document.getElementById("summary-cards");
  if (!container) {
    return;
  }
  container.innerHTML = "";

  if (!changes.length) {
    container.append(createEmptyMessage("p", "No detected changes."));
    return;
  }

  for (const change of changes) {
    const card = document.createElement("article");
    card.className = "card";

    const title = document.createElement("h3");
    title.textContent = change.title ?? "(Untitled)";

    const type = document.createElement("p");
    type.className = "card-meta";
    const typeStrong = document.createElement("strong");
    typeStrong.textContent = change.changeType ?? "기타";
    type.append(typeStrong);

    const summary = document.createElement("p");
    summary.textContent = change.summary ?? "No summary available.";

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
    container.append(createEmptyMessage("li", "No impacted internal documents."));
    return;
  }

  for (const item of mapped) {
    const impactedDocs = Array.isArray(item.impactedDocuments)
      ? item.impactedDocuments.map((document) => `${document.title} (${document.score})`)
      : [];
    const legacyDocs = Array.isArray(item.docs) ? item.docs : [];
    const docs = impactedDocs.length > 0 ? impactedDocs.join(", ") : legacyDocs.join(", ");

    const row = document.createElement("li");
    row.textContent = `${item.changeId}: ${docs || "No matched documents"}`;
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
    container.append(createEmptyMessage("li", "No risk classifications."));
    return;
  }

  for (const item of risks) {
    const level = item.risk?.level ?? item.level ?? "파랑";
    const reason = item.risk?.reason ?? item.reason ?? "No reason provided.";

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
    draftView.textContent = "No draft output.";
    return;
  }

  draftView.textContent = allKeys.map((key) => `[${key}]\n${drafts[key]}`).join("\n\n");
}

function formatRunTime(value) {
  if (!value) {
    return "Unknown time";
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
  title.textContent = `${formatRunTime(run.createdAt)} · ${describeRunSource(run)}`;

  const meta = document.createElement("p");
  meta.textContent = `${run.totalChanges} changes · ${run.highRiskChangeCount} high risk`;

  const breakdown = document.createElement("p");
  const changeTypes = Object.entries(run.changeTypeBreakdown ?? {})
    .map(([type, count]) => `${type} ${count}`)
    .join(" / ");
  breakdown.textContent = changeTypes || "No change breakdown available.";

  button.append(title, meta, breakdown);
  button.addEventListener("click", () => {
    renderResult(run.result ?? {});
    setStatus(`Loaded saved analysis ${run.id}.`, "success");
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
    historyListView.append(createEmptyMessage("p", `${providerName} storage is not configured yet.`));
    setHistoryStatus(`${providerName} storage is disabled.`, "neutral");
    return;
  }

  if (!runs.length) {
    historyListView.append(createEmptyMessage("p", "No saved analyses yet."));
    setHistoryStatus(`${providerName} storage connected. Waiting for the first saved run.`, "success");
    return;
  }

  for (const run of runs) {
    historyListView.append(renderHistoryItem(run));
  }
  setHistoryStatus(`${providerName} storage connected. Showing ${runs.length} recent run(s).`, "success");
}

async function loadHistory() {
  try {
    const response = await fetch(HISTORY_ENDPOINT);
    if (!response.ok) {
      throw new Error(`History request failed with ${response.status}`);
    }

    const payload = await response.json();
    renderHistory(payload);
  } catch (error) {
    if (historyListView) {
      historyListView.innerHTML = "";
      historyListView.append(createEmptyMessage("p", "Unable to load analysis history."));
    }
    setHistoryStatus(`History unavailable: ${error.message}`, "error");
  }
}

async function loadHealth() {
  try {
    const response = await fetch(HEALTH_ENDPOINT);
    if (!response.ok) {
      throw new Error(`Health request failed with ${response.status}`);
    }

    latestHealth = await response.json();
  } catch (error) {
    latestHealth = null;
    setSourceStatus(`Source status unavailable: ${error.message}`, "error");
  }
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

function updateSourceControls() {
  const provider = sourceProviderField?.value ?? "local-fixture";
  const usesMcp = provider === "korea-law-mcp";
  const selectedSource = latestRequestedSourceStatus?.requestedProvider === provider ? latestRequestedSourceStatus.source : null;

  if (sourceBeforeGroup) {
    sourceBeforeGroup.hidden = !usesMcp;
  }
  if (sourceAfterGroup) {
    sourceAfterGroup.hidden = !usesMcp;
  }
  if (sourceSearchGroup) {
    sourceSearchGroup.hidden = !usesMcp;
  }

  if (provider === "local-fixture") {
    const localFixtureEnabled = selectedSource?.enabled ?? true;
    setSourceStatus(localFixtureEnabled ? "Bundled sample source ready." : "Bundled sample source is unavailable.", localFixtureEnabled ? "success" : "error");
    setSourceHelp(
      "Uses the repository sample regulation pair. No source IDs are required for the default demo flow.",
      localFixtureEnabled ? "neutral" : "error"
    );
    setSourceSearchStatus("Search is only used for Korea Law MCP lookups.", "neutral");
    renderSourceSearchResults([]);
    return;
  }

  if (selectedSource?.enabled) {
    const toolNames = Array.isArray(selectedSource.detailToolNames) ? selectedSource.detailToolNames.join(" -> ") : "configured detail tool";
    const idArgumentName = selectedSource.idArgumentName ?? "ID";
    const searchToolName = Array.isArray(selectedSource.searchToolNames) ? selectedSource.searchToolNames.join(" -> ") : "search_local_ordinance";
    const searchQueryArgumentName = selectedSource.searchQueryArgumentName ?? "query";

    setSourceStatus("Korea Law MCP request path is configured.", "success");
    setSourceHelp(
      `Search by ordinance name or enter before/after ordinance IDs directly. The server will try ${toolNames} with the ${idArgumentName} argument.`,
      "neutral"
    );
    setSourceSearchStatus(
      `Search uses ${searchToolName} with the ${searchQueryArgumentName} argument. Choose candidates below to fill Before/After IDs.`,
      "neutral"
    );
    return;
  }

  if (selectedSource && !selectedSource.enabled) {
    const missingEnv = formatMissingEnv(selectedSource.missingEnv);
    const detail = missingEnv ? ` Missing: ${missingEnv}.` : "";

    setSourceStatus("Korea Law MCP is not configured for request-level use.", "error");
    setSourceHelp(
      `Set the MCP endpoint configuration before using ordinance IDs.${detail}`,
      "error"
    );
    setSourceSearchStatus("Search is unavailable until Korea Law MCP is configured.", "error");
    renderSourceSearchResults([]);
    return;
  }

  const defaultSource = latestHealth?.source ?? {};
  if (defaultSource.provider === "korea-law-mcp" && defaultSource.enabled) {
    setSourceStatus("Korea Law MCP is configured on the server.", "success");
    setSourceHelp(
      "Search by ordinance name or enter the ordinance IDs for the before and after versions. The server forwards them to the configured MCP tools.",
      "neutral"
    );
    setSourceSearchStatus("Search is ready for Korea Law MCP.", "neutral");
    return;
  }

  setSourceStatus("Korea Law MCP will be selected per request.", "neutral");
  setSourceHelp(
    "Search by ordinance name or enter the ordinance IDs for the before and after versions. The server forwards them to the configured MCP tools.",
    "neutral"
  );
  setSourceSearchStatus("Search the selected ordinance provider to discover usable IDs.", "neutral");
}

async function loadSelectedSourceStatus() {
  const provider = sourceProviderField?.value ?? "local-fixture";

  try {
    const response = await fetch(`${SOURCE_STATUS_ENDPOINT}?provider=${encodeURIComponent(provider)}`);
    if (!response.ok) {
      throw new Error(`Source status request failed with ${response.status}`);
    }

    latestRequestedSourceStatus = await response.json();
  } catch (error) {
    latestRequestedSourceStatus = null;
    setSourceStatus(`Source status unavailable: ${error.message}`, "error");
  }

  updateSourceControls();
}

async function runSourceSearch() {
  const provider = sourceProviderField?.value ?? "local-fixture";
  const query = sourceSearchQueryField?.value.trim() ?? "";

  if (provider !== "korea-law-mcp") {
    setSourceSearchStatus("Search is only available for Korea Law MCP.", "neutral");
    renderSourceSearchResults([]);
    return;
  }

  if (!query) {
    setSourceSearchStatus("Enter an ordinance name or keyword before searching.", "error");
    renderSourceSearchResults([]);
    return;
  }

  setSourceSearchLoading(true);
  setSourceSearchStatus("Searching ordinance candidates...", "neutral");

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
      throw new Error(detail || `Source search failed with ${response.status}`);
    }

    latestSourceSearchResult = await response.json();
    renderSourceSearchResults(latestSourceSearchResult.results ?? []);
    setSourceSearchStatus(
      `Loaded ${(latestSourceSearchResult.results ?? []).length} ordinance candidate(s).`,
      "success"
    );
  } catch (error) {
    latestSourceSearchResult = null;
    renderSourceSearchResults([]);
    setSourceSearchStatus(`Search failed: ${error.message}`, "error");
  } finally {
    setSourceSearchLoading(false);
  }
}

function buildAnalyzePayload() {
  const provider = sourceProviderField?.value ?? "local-fixture";

  if (provider === "local-fixture") {
    return {
      source: {
        provider: "local-fixture"
      }
    };
  }

  const beforeId = sourceBeforeIdField?.value.trim() ?? "";
  const afterId = sourceAfterIdField?.value.trim() ?? "";

  if (!beforeId || !afterId) {
    throw new Error("Before ID and After ID are required for Korea Law MCP.");
  }

  return {
    source: {
      provider: "korea-law-mcp",
      beforeId,
      afterId
    }
  };
}

async function runAnalyze() {
  setLoading(true);
  setStatus("Analyzing regulation changes...", "loading");

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
      throw new Error(detail || `Request failed with ${response.status}`);
    }

    const result = await response.json();
    const normalized = renderResult(result);
    setStatus(`Analysis completed. ${normalized.changes.length} change(s) detected.`, "success");
    await loadHistory();
  } catch (error) {
    renderResult({ changes: [], mapped: [], risks: [], drafts: {} });
    setStatus(`Analysis failed: ${error.message}`, "error");
    await loadHistory();
  } finally {
    setLoading(false);
  }
}

async function init() {
  if (sourceProviderField) {
    sourceProviderField.addEventListener("change", () => {
      setSourceStatus("Checking selected source provider...", "neutral");
      latestSourceSearchResult = null;
      renderSourceSearchResults([]);
      updateSourceControls();
      void loadSelectedSourceStatus();
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
  await loadSelectedSourceStatus();
  await loadHistory();
  await runAnalyze();
}

if (runButton) {
  runButton.addEventListener("click", runAnalyze);
}

void init();
