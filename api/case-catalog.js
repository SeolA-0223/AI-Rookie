import { handleCaseCatalog } from "../backend/src/http/app.js";

export default async function handler(req, res) {
  await handleCaseCatalog(req, res);
}
