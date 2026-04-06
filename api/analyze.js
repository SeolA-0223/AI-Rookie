import { handleAnalyze } from "../backend/src/http/app.js";

export default async function handler(req, res) {
  await handleAnalyze(req, res);
}
