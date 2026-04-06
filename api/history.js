import { handleHistory } from "../backend/src/http/app.js";

export default async function handler(req, res) {
  await handleHistory(req, res);
}
