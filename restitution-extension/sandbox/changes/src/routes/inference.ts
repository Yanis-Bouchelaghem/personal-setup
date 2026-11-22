import type { IncomingMessage, ServerResponse } from "node:http";

import { GatewayClient } from "../gateway/client.js";
import { logError } from "../middleware/logging.js";

export function inferenceRoute(client: GatewayClient) {
    return async (request: IncomingMessage, response: ServerResponse) => {
        try {
            const body = await readBody(request);
            const result = await client.json("/v1/inference", { method: "POST", body });
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify(result));
        } catch (error) {
            logError(error);
            response.writeHead(500, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: "inference failed" }));
        }
    };
}

async function readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
        chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString("utf8");
}
