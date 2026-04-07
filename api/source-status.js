import { handleSourceStatus } from "../backend/src/http/app.js";

export default async function handler(req, res) {
  await handleSourceStatus(req, res);
}
