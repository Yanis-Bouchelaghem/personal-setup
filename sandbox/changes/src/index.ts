import { createServer } from "node:http";

import { loadConfig } from "./config.js";
import { GatewayClient } from "./gateway/client.js";
import { inferenceRoute } from "./routes/inference.js";

const config = loadConfig();
const client = new GatewayClient({
    baseUrl: config.apigeeUrl,
    token: async () => process.env.ADAPTER_TOKEN ?? "",
    maxRetries: config.maxRetries,
});
const inference = inferenceRoute(client);

const server = createServer((request, response) => {
    if (request.url?.startsWith("/v1/inference")) {
        void inference(request, response);
        return;
    }
    response.writeHead(404);
    response.end();
});

server.listen(config.port);
