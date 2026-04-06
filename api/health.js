import { handleHealth } from "../backend/src/http/app.js";

export default async function handler(req, res) {
  await handleHealth(req, res);
}
