function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}

export function readApigeeUrl(): URL {
    const url = new URL(required("ADAPTER_APIGEE_URL"));
    if (url.protocol !== "https:") {
        throw new Error("ADAPTER_APIGEE_URL must use https");
    }
    return url;
}

export function readPort(): number {
    const raw = process.env.PORT ?? "8080";
    const port = Number(raw);
    if (!Number.isInteger(port)) {
        throw new Error("PORT must be an integer");
    }
    return port;
}

export function readMaxRetries(): number {
    const raw = process.env.ADAPTER_MAX_RETRIES ?? "2";
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
        throw new Error("ADAPTER_MAX_RETRIES must be a non-negative integer");
    }
    return value;
}

export function loadConfig() {
    return {
        port: readPort(),
        apigeeUrl: readApigeeUrl(),
        maxRetries: readMaxRetries(),
    };
}
