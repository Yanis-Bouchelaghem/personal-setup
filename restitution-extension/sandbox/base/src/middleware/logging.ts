export function logRequest(method: string, url: string, status: number, ms: number): void {
    console.log(JSON.stringify({ method, url, status, ms }));
}
