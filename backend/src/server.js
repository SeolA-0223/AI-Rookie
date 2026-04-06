import http from "node:http";
import { routeRequest } from "./http/app.js";

const PORT = process.env.PORT || 3000;

const server = http.createServer(routeRequest);

server.listen(PORT, () => {
  console.log(`AI-Rookie API running on http://localhost:${PORT}`);
});
