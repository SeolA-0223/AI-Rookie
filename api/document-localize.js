import { handleDocumentLocalize } from "../backend/src/http/app.js";

export default async function handler(req, res) {
  await handleDocumentLocalize(req, res);
}
