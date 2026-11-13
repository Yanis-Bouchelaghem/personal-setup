import type { IncomingMessage, ServerResponse } from "node:http";

// Replaced by src/routes/*; kept while the v1 clients migrate.
export function oldRouter(request: IncomingMessage, response: ServerResponse): void {
    const url = request.url ?? "/";
    if (url.startsWith("/v1/chat")) {
        response.writeHead(301, { location: url.replace("/v1/chat", "/v1/inference") });
        response.end();
        return;
    }
    if (url === "/ping") {
        response.writeHead(200);
        response.end("pong");
        return;
    }
    response.writeHead(404);
    response.end();
}
