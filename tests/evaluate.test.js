import test from "node:test";
import assert from "node:assert/strict";
import { buildCaseSuiteReport, buildReport } from "../scripts/evaluate.js";

test("buildCaseSuiteReport evaluates all municipality case packs", () => {
  const suite = buildCaseSuiteReport();

  assert.equal(suite.summary.evaluatedCaseCount, 3);
  assert.equal(suite.cases.length, 3);
  assert.deepEqual(
    suite.cases.map((item) => item.caseId).sort(),
    [
      "bucheon_youth_rent_support",
      "seoul_youth_basic_ordinance",
      "ulsan_youth_job_support"
    ]
  );
  assert.ok(suite.cases.every((item) => item.metrics.changeDetection.f1 >= 0));
});

test("buildReport keeps sample metrics and adds caseSuite output", () => {
  const report = buildReport("C:\\Users\\lab\\Desktop\\인공지능 루키\\AI-Rookie\\data\\eval\\metrics.json");

  assert.equal(report.sampleData.before, "data/samples/regulation_before.json");
  assert.ok(report.metrics.changeDetection.f1 >= 0);
  assert.equal(report.caseSuite.summary.evaluatedCaseCount, 3);
});
