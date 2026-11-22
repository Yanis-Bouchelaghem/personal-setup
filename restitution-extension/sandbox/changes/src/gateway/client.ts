import { GatewayError } from "../errors.js";
import { withRetry } from "./retry.js";

export interface GatewayOptions {
    baseUrl: URL;
    token: () => Promise<string>;
    maxRetries?: number;
}

export class GatewayClient {
    constructor(private readonly options: GatewayOptions) {}

    url(path: string): string {
        return new URL(path, this.options.baseUrl).toString();
    }

    async request(path: string, init: RequestInit = {}): Promise<Response> {
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${await this.options.token()}`);
        headers.set("X-Request-Id", crypto.randomUUID());
        const response = await fetch(this.url(path), { ...init, headers });
        if (!response.ok) {
            throw new GatewayError(
                `Gateway returned ${response.status}`,
                response.status,
            );
        }
        return response;
    }

    async json<T>(path: string, init: RequestInit = {}): Promise<T> {
        const attempts = (this.options.maxRetries ?? 2) + 1;
        const response = await withRetry(() => this.request(path, init), {
            attempts,
        });
        return (await response.json()) as T;
    }

    async health(): Promise<boolean> {
        try {
            await this.request("/health");
            return true;
        } catch {
            return false;
        }
    }
}
