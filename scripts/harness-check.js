import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

const REQUIRED_FILES = [
  {
    path: "AGENTS.md",
    fragments: ["# AI-Rookie Harness", "## Pipeline"]
  },
  {
    path: "agents/planner.md",
    fragments: ["# Planner", "## SPEC Structure"]
  },
  {
    path: "agents/generator.md",
    fragments: ["# Generator", "## Deliverables"]
  },
  {
    path: "agents/evaluator.md",
    fragments: ["# Evaluator", "## Evaluation Procedure"]
  },
  {
    path: "agents/evaluation_criteria.md",
    fragments: ["# Evaluation Criteria", "## Weighted Categories"]
  },
  {
    path: "SPEC.md",
    fragments: ["# SPEC", "## Acceptance Criteria"]
  },
  {
    path: "SELF_CHECK.md",
    fragments: ["# SELF_CHECK", "## Open Risks"]
  },
  {
    path: "QA_REPORT.md",
    fragments: ["# QA_REPORT", "## Final Verdict"]
  },
  {
    path: "output/README.md",
    fragments: ["# Output Notes"]
  }
];

function readText(relativePath) {
  const filePath = path.join(REPO_ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`${relativePath} is missing.`);
  }

  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  if (!text.trim()) {
    throw new Error(`${relativePath} is empty.`);
  }

  return text;
}

function main() {
  const errors = [];

  for (const file of REQUIRED_FILES) {
    try {
      const text = readText(file.path);
      for (const fragment of file.fragments) {
        if (!text.includes(fragment)) {
          errors.push(`${file.path} is missing required content: ${fragment}`);
        }
      }

      if (file.path === "AGENTS.md") {
        const lineCount = text.trim().split(/\r?\n/).length;
        if (lineCount > 80) {
          errors.push(`AGENTS.md should stay concise. Current line count: ${lineCount}`);
        }
      }
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length > 0) {
    console.error("[harness:check] Failed");
    errors.forEach((error) => {
      console.error(`- ${error}`);
    });
    process.exit(1);
  }

  console.log("[harness:check] Harness files are present and structurally valid.");
}

main();
