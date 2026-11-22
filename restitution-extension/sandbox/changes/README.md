# Gateway adapter

Proxies inference and marketplace calls to the gateway through Apigee.

## Configuration

| Variable | Meaning |
| --- | --- |
| `PORT` | HTTP port, 8080 by default |
| `ADAPTER_APIGEE_URL` | Base URL of the Apigee proxy, https only |
| `ADAPTER_TOKEN` | Bearer token for the gateway |

## Routes

- `POST /v1/inference` forwards the body to the gateway.
- `GET /v1/marketplace` returns the rewritten plugin catalog.

## Retries

The adapter retries gateway responses with a 5xx status, with exponential
backoff starting at 200 ms, for up to `ADAPTER_MAX_RETRIES` extra attempts
(2 by default). 4xx responses are returned to the caller at once.

## Running

```sh
npm run build && node dist/index.js
```
