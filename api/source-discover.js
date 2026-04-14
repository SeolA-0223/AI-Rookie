import { handleSourceDiscover } from "../backend/src/http/app.js";

export default async function handler(req, res) {
  await handleSourceDiscover(req, res);
}
