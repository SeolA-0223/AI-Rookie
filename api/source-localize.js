import { handleSourceLocalize } from "../backend/src/http/app.js";

export default async function handler(req, res) {
  await handleSourceLocalize(req, res);
}
