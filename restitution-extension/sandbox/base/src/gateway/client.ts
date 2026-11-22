import { AdapterError } from "../errors.js";

export interface GatewayOptions {
    baseUrl: URL;
    token: () => Promise<string>;
}

export class GatewayClient {
    constructor(private readonly options: GatewayOptions) {}

    url(path: string): string {
        return new URL(path, this.options.baseUrl).toString();
    }

    async request(path: string, init: RequestInit = {}): Promise<Response> {
        const headers = {
            ...init.headers,
            Authorization: `Bearer ${await this.options.token()}`,
        };
        const response = await fetch(this.url(path), { ...init, headers });
        if (!response.ok) {
            throw new AdapterError(`Gateway returned ${response.status}`);
        }
        return response;
    }

    async json<T>(path: string, init: RequestInit = {}): Promise<T> {
        const response = await this.request(path, init);
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
