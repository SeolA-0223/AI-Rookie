import { createPassiveStore } from "../shared.js";

export function createLocalStore() {
  return createPassiveStore({
    provider: "local",
    reason: "storage_disabled"
  });
}
