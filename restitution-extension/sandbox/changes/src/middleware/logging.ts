export function logRequest(method: string, url: string, status: number, ms: number): void {
    console.log(JSON.stringify({ method, url, status, ms }));
}

export function logError(error: unknown): void {
    const name = error instanceof Error ? error.name : "Unknown";
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ level: "error", name, message }));
}
