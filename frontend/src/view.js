function createEmptyMessage(tagName, text) {
  const element = document.createElement(tagName);
  element.className = "empty";
  element.textContent = text;
  return element;
}

function setTextContent(element, text) {
  if (!element) {
    return;
  }

  element.textContent = text;
}

function createInfoCard(title, items, tone = "neutral", emptyText = "") {
  const card = document.createElement("article");
  card.className = `provenance-card provenance-${tone}`;

  const heading = document.createElement("h3");
  heading.textContent = title;
  card.append(heading);

  if (!items.length) {
    card.append(createEmptyMessage("p", emptyText));
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

function createSearchMeta(copy, label, value) {
  const line = document.createElement("p");
  line.className = "search-meta";
  line.textContent = `${label}: ${value}`;
  return line;
}

export function renderQuickStart(container, steps = []) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  for (const [index, step] of steps.entries()) {
    const card = document.createElement("article");
    card.className = "step-card";

    const indexLabel = document.createElement("p");
    indexLabel.className = "step-index";
    indexLabel.textContent = `${index + 1}`;

    const title = document.createElement("h3");
    title.textContent = step.title;

    const body = document.createElement("p");
    body.textContent = step.body;

    card.append(indexLabel, title, body);
    container.append(card);
  }
}

export function renderSourceSearchRecommendation(
  container,
  recommendation,
  { copy, formatTimelineLabel, onApplyRecommendation }
) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!recommendation?.before?.id || !recommendation?.after?.id) {
    return;
  }

  const card = document.createElement("article");
  card.className = "recommendation-card";

  const title = document.createElement("h3");
  title.textContent = copy.search.recommendationTitle;

  const reason = document.createElement("p");
  reason.textContent = recommendation.reason || copy.search.recommendationFallbackReason;

  const meta = document.createElement("p");
  meta.className = "recommendation-meta";
  meta.textContent =
    `${copy.search.confidence}: ${recommendation.confidence ?? copy.labels.unknown} / ` +
    `${copy.search.matchCount}: ${recommendation.matchCount ?? 0} / ` +
    `${copy.search.strategy}: ${recommendation.strategy ?? "heuristic"}`;

  const grid = document.createElement("div");
  grid.className = "recommendation-grid";

  for (const blockName of ["before", "after"]) {
    const block = document.createElement("div");
    block.className = "search-result";

    const blockTitle = document.createElement("h3");
    blockTitle.textContent = blockName === "before" ? copy.search.beforeVersion : copy.search.afterVersion;

    const idLine = createSearchMeta(copy, copy.search.idLabel, recommendation[blockName].id);
    const nameLine = document.createElement("p");
    nameLine.textContent = recommendation[blockName].title ?? recommendation[blockName].id;
    const timelineLine = document.createElement("p");
    timelineLine.className = "search-meta";
    timelineLine.textContent = formatTimelineLabel(recommendation[blockName]);

    block.append(blockTitle, idLine, nameLine, timelineLine);
    grid.append(block);
  }

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.className = "secondary-btn";
  applyButton.textContent = copy.buttons.applyRecommendation;
  applyButton.addEventListener("click", () => onApplyRecommendation(recommendation));

  card.append(title, reason, meta, grid, applyButton);
  container.append(card);
}

export function renderSourceSearchResults(
  container,
  results = [],
  { copy, formatTimelineLabel, onUseBefore, onUseAfter }
) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!results.length) {
    container.append(createEmptyMessage("p", copy.search.noResults));
    return;
  }

  for (const result of results) {
    const card = document.createElement("article");
    card.className = "search-result";

    const title = document.createElement("h3");
    title.textContent = result.title ?? result.id ?? copy.labels.unknown;

    const idLine = createSearchMeta(copy, copy.search.idLabel, result.id ?? copy.labels.unknown);

    const metaLine = document.createElement("p");
    metaLine.className = "search-meta";
    metaLine.textContent = [result.jurisdiction, formatTimelineLabel(result)].filter(Boolean).join(" / ");

    const summary = document.createElement("p");
    summary.textContent = result.summary || copy.labels.notAvailable;

    card.append(title, idLine, metaLine, summary);

    if (result.curatedCaseId) {
      const badge = document.createElement("p");
      badge.className = "search-badge";
      badge.textContent = `${copy.search.curatedFallback}: ${result.curatedCaseId}`;
      card.append(badge);
    }

    const reference = document.createElement("p");
    reference.className = "search-meta search-link";

    if (result.referenceUrl) {
      const anchor = document.createElement("a");
      anchor.href = result.referenceUrl;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.textContent = result.referenceUrl;
      reference.append(`${copy.search.sourceLabel}: `, anchor);
    } else {
      reference.textContent = copy.search.referenceMissing;
    }

    const actions = document.createElement("div");
    actions.className = "search-actions";

    const beforeButton = document.createElement("button");
    beforeButton.type = "button";
    beforeButton.className = "secondary-btn";
    beforeButton.textContent = copy.buttons.useAsBefore;
    beforeButton.disabled = !result.id;
    beforeButton.addEventListener("click", () => onUseBefore(result));

    const afterButton = document.createElement("button");
    afterButton.type = "button";
    afterButton.className = "secondary-btn";
    afterButton.textContent = copy.buttons.useAsAfter;
    afterButton.disabled = !result.id;
    afterButton.addEventListener("click", () => onUseAfter(result));

    actions.append(beforeButton, afterButton);
    card.append(reference, actions);
    container.append(card);
  }
}

export function renderProvenanceCards(container, cards = [], { copy }) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  for (const card of cards) {
    container.append(createInfoCard(card.title, card.items ?? [], card.tone ?? "neutral", copy.provenance.empty));
  }
}

export function renderSummaryCards(container, changes = [], { copy, translateChangeType }) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!changes.length) {
    container.append(createEmptyMessage("p", copy.result.emptySummary));
    return;
  }

  for (const change of changes) {
    const card = document.createElement("article");
    card.className = "card";

    const title = document.createElement("h3");
    title.textContent = change.title ?? copy.labels.unknown;

    const meta = document.createElement("p");
    meta.className = "card-meta";
    const strong = document.createElement("strong");
    strong.textContent = translateChangeType(change.changeType);
    meta.append(strong);

    const summary = document.createElement("p");
    summary.textContent = change.summary ?? copy.labels.notAvailable;

    card.append(title, meta, summary);
    container.append(card);
  }
}

export function renderImpactList(container, mapped = [], { copy, changesById }) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!mapped.length) {
    container.append(createEmptyMessage("li", copy.result.emptyImpact));
    return;
  }

  for (const item of mapped) {
    const row = document.createElement("li");
    const impactedDocuments = Array.isArray(item.impactedDocuments)
      ? item.impactedDocuments.map((document) => `${document.title} (${document.score})`)
      : [];
    const legacyDocs = Array.isArray(item.docs) ? item.docs : [];
    const docs = impactedDocuments.length > 0 ? impactedDocuments.join(", ") : legacyDocs.join(", ");
    const title = changesById.get(item.changeId)?.title ?? item.changeId;

    row.textContent = `${title} (${item.changeId}): ${docs || copy.result.noMappedDocuments}`;
    container.append(row);
  }
}

function riskClassForLevel(level) {
  if (level === "빨강" || level === "red") {
    return "risk-red";
  }
  if (level === "노랑" || level === "yellow") {
    return "risk-yellow";
  }
  return "risk-blue";
}

export function renderRiskList(container, risks = [], { copy, translateRiskLevel, changesById }) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!risks.length) {
    container.append(createEmptyMessage("li", copy.result.emptyRisk));
    return;
  }

  for (const item of risks) {
    const level = item.risk?.level ?? item.level ?? copy.labels.unknown;
    const reason = item.risk?.reason ?? item.reason ?? copy.labels.notAvailable;
    const title = changesById.get(item.changeId)?.title ?? item.changeId;

    const row = document.createElement("li");
    row.className = riskClassForLevel(level);
    row.textContent = `${title} (${item.changeId}) - ${translateRiskLevel(level)}: ${reason}`;
    container.append(row);
  }
}

export function renderDraftView(view, drafts = {}, { copy }) {
  if (!view) {
    return;
  }

  const preferredOrder = ["internalNoticeDraft", "citizenGuideDraft", "faqDraft", "comparisonTable"];
  const keys = preferredOrder.filter((key) => typeof drafts[key] === "string");
  const dynamicKeys = Object.keys(drafts).filter((key) => !keys.includes(key));
  const allKeys = [...keys, ...dynamicKeys];

  if (!allKeys.length) {
    view.textContent = copy.result.emptyDraft;
    return;
  }

  view.textContent = allKeys
    .map((key) => `[${copy.result.draftSectionLabels[key] ?? key}]\n${drafts[key]}`)
    .join("\n\n");
}

export function renderHistoryList(container, runs = [], { copy, formatRunTime, describeRunSource, translateChangeType, onSelectRun }) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!runs.length) {
    container.append(createEmptyMessage("p", copy.messages.historyWaiting(copy.labels.loading)));
    return;
  }

  for (const run of runs) {
    const item = document.createElement("article");
    item.className = "history-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-button";

    const title = document.createElement("strong");
    title.textContent = `${formatRunTime(run.createdAt)} | ${describeRunSource(run)}`;

    const meta = document.createElement("p");
    meta.textContent = copy.history.itemMeta(run.totalChanges, run.highRiskChangeCount);

    const breakdown = document.createElement("p");
    const changeTypes = Object.entries(run.changeTypeBreakdown ?? {})
      .map(([type, count]) => `${translateChangeType(type)} ${count}`)
      .join(" / ");
    setTextContent(breakdown, changeTypes || copy.history.emptyBreakdown);

    button.append(title, meta, breakdown);
    button.addEventListener("click", () => onSelectRun(run));
    item.append(button);
    container.append(item);
  }
}
