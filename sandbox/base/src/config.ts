function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}

export function readApigeeUrl(): URL {
    return new URL(required("ADAPTER_APIGEE_URL"));
}

export function readPort(): number {
    const raw = process.env.PORT ?? "8080";
    const port = Number(raw);
    if (!Number.isInteger(port)) {
        throw new Error("PORT must be an integer");
    }
    return port;
}

export function loadConfig() {
    return { port: readPort(), apigeeUrl: readApigeeUrl() };
}
