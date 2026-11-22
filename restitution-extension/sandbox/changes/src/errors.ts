export class AdapterError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AdapterError";
    }
}

export class ConfigError extends AdapterError {
    constructor(message: string) {
        super(message);
        this.name = "ConfigError";
    }
}

export class GatewayError extends AdapterError {
    constructor(
        message: string,
        readonly upstreamStatus: number,
    ) {
        super(message);
        this.name = "GatewayError";
    }
}
