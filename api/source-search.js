import { handleSourceSearch } from "../backend/src/http/app.js";

export default async function handler(req, res) {
  await handleSourceSearch(req, res);
}
