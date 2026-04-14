import { handleDocumentInspect } from "../backend/src/http/app.js";

export default async function handler(req, res) {
  await handleDocumentInspect(req, res);
}
