const ANALYZE_ENDPOINT = "/api/analyze";
const HISTORY_ENDPOINT = "/api/history?limit=6";
const BUTTON_LABEL = "Run Analysis";
const BUTTON_LOADING_LABEL = "Analyzing...";

const runButton = document.getElementById("analyze-btn");
const statusView = document.getElementById("status-msg");
const historyStatusView = document.getElementById("history-status");
const historyListView = document.getElementById("history-list");

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

function createEmptyMessage(tagName, text) {
  const element = document.createElement(tagName);
  element.className = "empty";
  element.textContent = text;
  return element;
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
  title.textContent = `${formatRunTime(run.createdAt)} · ${run.source === "custom" ? "Custom Input" : "Sample Input"}`;

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

async function runAnalyze() {
  setLoading(true);
  setStatus("Analyzing regulation changes...", "loading");

  try {
    const response = await fetch(ANALYZE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
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

if (runButton) {
  runButton.addEventListener("click", runAnalyze);
}

runAnalyze();
