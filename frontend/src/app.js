const sampleResponse = {
  changes: [
    { id: "c1", title: "Age Requirement", changeType: "요건", summary: "Age expanded from 29 to 34" },
    { id: "c2", title: "Required Documents", changeType: "서류", summary: "Income proof added" },
    { id: "c3", title: "Application Deadline", changeType: "기한", summary: "Deadline moved to April 15" },
    { id: "c4", title: "Support Amount", changeType: "금액", summary: "Support increased" }
  ],
  mapped: [
    { changeId: "c1", docs: ["Citizen Guide", "FAQ"] },
    { changeId: "c2", docs: ["Checklist", "FAQ"] },
    { changeId: "c3", docs: ["Citizen Guide", "Internal Notice"] }
  ],
  risks: [
    { changeId: "c1", level: "빨강", reason: "Eligibility guidance risk" },
    { changeId: "c2", level: "노랑", reason: "Document omission risk" },
    { changeId: "c4", level: "파랑", reason: "Low operational risk" }
  ],
  drafts: {
    internalNoticeDraft: "[Internal Notice Draft]\n- Age and document rules updated"
  }
};

function renderSummary(changes) {
  const container = document.getElementById("summary-cards");
  container.innerHTML = changes
    .map(
      (change) => `
      <article class="card">
        <h3>${change.title}</h3>
        <p><strong>${change.changeType}</strong></p>
        <p>${change.summary}</p>
      </article>
    `
    )
    .join("");
}

function renderImpact(mapped) {
  const container = document.getElementById("impact-list");
  container.innerHTML = mapped
    .map((row) => `<li>${row.changeId}: ${row.docs.join(", ")}</li>`)
    .join("");
}

function renderRisks(risks) {
  const container = document.getElementById("risk-list");
  container.innerHTML = risks
    .map((risk) => {
      const cls = risk.level === "빨강" ? "risk-red" : risk.level === "노랑" ? "risk-yellow" : "risk-blue";
      return `<li class="${cls}">${risk.changeId} - ${risk.level}: ${risk.reason}</li>`;
    })
    .join("");
}

function renderDraft(drafts) {
  const draftView = document.getElementById("draft-view");
  draftView.textContent = drafts.internalNoticeDraft;
}

renderSummary(sampleResponse.changes);
renderImpact(sampleResponse.mapped);
renderRisks(sampleResponse.risks);
renderDraft(sampleResponse.drafts);
