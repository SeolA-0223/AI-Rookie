import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSourceStatus } from "../shared.js";

const SAMPLE_BEFORE_FILE = fileURLToPath(new URL("../../../../data/samples/regulation_before.json", import.meta.url));
const SAMPLE_AFTER_FILE = fileURLToPath(new URL("../../../../data/samples/regulation_after.json", import.meta.url));

function readSample(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

export function createLocalFixtureLawSource({
  beforeDoc = readSample(SAMPLE_BEFORE_FILE),
  afterDoc = readSample(SAMPLE_AFTER_FILE)
} = {}) {
  const status = buildSourceStatus({
    provider: "local-fixture",
    enabled: true,
    mode: "sample"
  });

  return {
    getSourceStatus() {
      return status;
    },
    async searchRegulations() {
      return {
        results: [],
        meta: {
          provider: "local-fixture",
          mode: "sample"
        }
      };
    },
    async resolveRegulationPair() {
      return {
        beforeDoc,
        afterDoc,
        meta: {
          provider: "local-fixture",
          mode: "sample"
        }
      };
    }
  };
}
