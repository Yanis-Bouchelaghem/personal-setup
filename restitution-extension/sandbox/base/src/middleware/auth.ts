import type { IncomingMessage } from "node:http";

export function bearerToken(request: IncomingMessage): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return undefined;
    }
    return header.slice("Bearer ".length);
}
